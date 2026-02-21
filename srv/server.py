#!/usr/bin/env python3
"""
QuizNGO Quiz Server - Python Flask Implementation

Server-side component for the PowerPoint QuizNGO Add-in
Run locally for testing: python server.py
Deploy to server: see deployment instructions
"""

import os

# On Windows, eventlet uses select(), which has a low FD cap and can crash
# under high WebSocket connection counts.
SOCKETIO_ASYNC_MODE = 'threading'
if os.name != 'nt':
    try:
        # IMPORTANT: if enabled, monkey patch should happen before other imports.
        import eventlet
        eventlet.monkey_patch()
        SOCKETIO_ASYNC_MODE = 'eventlet'
    except Exception as exc:
        print(f"WARNING: eventlet unavailable, falling back to threading mode: {exc}")

import sys
import random
import logging
import argparse
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
import socket
import requests as http_requests
import urllib3
import psutil

# Suppress SSL warnings for self-signed cert (internal srv→LB communication)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Add srv directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))


def get_local_ip():
    """Detect the machine's LAN IP address by connecting to an external target.
    Falls back to localhost if detection fails."""
    try:
        # Connect to a public DNS address (no data is actually sent)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(1)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return 'localhost'


# --- CLI Arguments ---
parser = argparse.ArgumentParser(description='QuizNGO Quiz Server')
parser.add_argument('--port', type=int, default=5001, help='Port to run on (default: 5001)')
parser.add_argument('--lb-url', type=str, default=None, help='Load balancer URL (e.g., http://192.168.31.22:5000). Auto-detects LAN IP if not provided.')
parser.add_argument('--address', type=str, default=None, help='This server\'s public address (e.g., http://192.168.31.22:5001)')
parser.add_argument('--admin-url', type=str, default=None, help='Admin client base URL (e.g., http://192.168.31.22:3002)')
parser.add_argument('--game-url', type=str, default=None, help='Game client base URL (e.g., http://192.168.31.22:8080)')
parser.add_argument(
    '--log-verbosity',
    choices=['quiet', 'normal', 'verbose'],
    default=os.getenv('QUIZNGO_LOG_VERBOSITY', 'quiet'),
    help='Logging verbosity: quiet=warnings/errors only, normal=important info, verbose=debug'
)
parser.add_argument('--ssl', action='store_true', default=False, help='Enable HTTPS (default: disabled)')
parser.add_argument('--no-ssl', dest='ssl', action='store_false', help='Disable HTTPS (default)')
parser.add_argument('--cert-dir', type=str, default=None, help='Directory containing localhost.crt and localhost.key (default: ~/.office-addin-dev-certs)')
cli_args = parser.parse_args()

PORT = cli_args.port
LOCAL_IP = get_local_ip()
USE_SSL = cli_args.ssl
CERT_DIR = Path(cli_args.cert_dir) if cli_args.cert_dir else Path.home() / '.office-addin-dev-certs'
PROTOCOL = 'https' if USE_SSL else 'http'
LB_URL = cli_args.lb_url or f'{PROTOCOL}://localhost:5000'
SERVER_ADDRESS = cli_args.address or f'{PROTOCOL}://{LOCAL_IP}:{PORT}'
ADMIN_URL = cli_args.admin_url or f'http://{LOCAL_IP}:3002'
GAME_URL = cli_args.game_url or f'http://{LOCAL_IP}:8080'
LOG_VERBOSITY = (cli_args.log_verbosity or 'quiet').lower()
lb_server_id = None  # Set after registration with LB

# Prevent protocol mismatch between announced server address and actual listener mode.
if cli_args.address:
    if USE_SSL and cli_args.address.startswith('http://'):
        SERVER_ADDRESS = cli_args.address.replace('http://', 'https://', 1)
        print(f"WARNING: --address used http:// while SSL is enabled. Using {SERVER_ADDRESS}")
    elif not USE_SSL and cli_args.address.startswith('https://'):
        SERVER_ADDRESS = cli_args.address.replace('https://', 'http://', 1)
        print(f"WARNING: --address used https:// while SSL is disabled. Using {SERVER_ADDRESS}")

from handlers.websocket_handlers import register_websocket_handlers
from routes.player_routes import create_player_routes
from routes.game_routes import create_game_routes
from routes.navigation_routes import create_navigation_routes
from routes.info_routes import create_info_routes
from utils.response_normalizer import normalize_flask_json_response

# Configuration
LOG_DIR = Path(__file__).parent / 'logs'
LOG_FILE = LOG_DIR / 'quizngo.log'
LOG_LEVELS = {
    'quiet': logging.WARNING,
    'normal': logging.INFO,
    'verbose': logging.DEBUG
}
LOG_LEVEL = LOG_LEVELS.get(LOG_VERBOSITY, logging.WARNING)

# High-volume messages that can flood logs under load.
HIGH_VOLUME_LOG_PATTERNS = (
    'POST /submit_answer',
    'POST /answer_time_started',
    'POST /submit_results',
    'POST /register_room - socketId',
    'POST /rejoin -',
    'WS ->',
    'WS ← connect',
    'WS ← disconnect',
    'Answer from ',
    'Player joining:',
    'Registered player in registry',
    'Player joined, participant_update sent',
    'Player rejoined, participant_update sent',
    'Registered socket ',
    'No socket found for',
    'Saved current question state',
    'Cleared current question state',
    'Auto-close worker stopped for game',
)


class HighVolumeLogFilter(logging.Filter):
    """Drop very noisy INFO/DEBUG records for quieter production logs."""

    def filter(self, record):
        if LOG_VERBOSITY == 'verbose':
            return True
        if record.levelno >= logging.WARNING:
            return True
        msg = record.getMessage()
        return not any(token in msg for token in HIGH_VOLUME_LOG_PATTERNS)

# Create log directory if it doesn't exist
LOG_DIR.mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# Suppress high-volume request/access logs and websocket chatter unless verbose.
if LOG_VERBOSITY in ('quiet', 'normal'):
    root_logger = logging.getLogger()
    for handler in root_logger.handlers:
        handler.addFilter(HighVolumeLogFilter())

third_party_level = logging.INFO if LOG_VERBOSITY == 'verbose' else logging.WARNING
logging.getLogger('werkzeug').setLevel(third_party_level)
logging.getLogger('engineio').setLevel(third_party_level)
logging.getLogger('socketio').setLevel(third_party_level)
logging.getLogger('urllib3').setLevel(logging.WARNING)


class GameLogger:
    """Simple logger wrapper to replace GameManager"""
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def log(self, message):
        text = str(message)
        lowered = text.lower()

        if '❌' in text or lowered.startswith('error') or ' exception' in lowered:
            self.logger.error(text)
            return

        if '⚠️' in text or '🚫' in text or ' warning' in lowered or ' failed' in lowered:
            self.logger.warning(text)
            return

        self.logger.info(text)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'quizngo_quiz_secret_key_2024'

# Initialize SocketIO
socketio = SocketIO(app, 
    cors_allowed_origins="*",
    async_mode=SOCKETIO_ASYNC_MODE,
    logger=False,
    engineio_logger=False
)

# Configure CORS
CORS(app, 
     origins="*",
     allow_headers=["Content-Type", "access_token"],
     expose_headers=["Content-Type"]
)

# Global state containers
connected_clients = set()
client_rooms = {}  # maps session_id -> gamePin (room name)
socket_to_player = {}  # maps socket_id -> uid
addin_sockets_by_game = {}  # maps gamePin -> set of add-in socket ids
player_sockets_by_game = {}  # maps gamePin -> set of player socket ids
game_sessions = {}  # maps gamePin -> session info
player_registry = {}  # maps uid -> player info
game_timeout_controls = {}  # maps gamePin -> threading.Event for auto-close cancellation

# Initialize logger (replaces GameManager)
game = GameLogger()

# Register WebSocket handlers
register_websocket_handlers(
    socketio, game, connected_clients, client_rooms,
    socket_to_player, addin_sockets_by_game, player_sockets_by_game,
    game_sessions, player_registry,
    game_timeout_controls=game_timeout_controls
)

# Create and register blueprints
player_bp = create_player_routes(
    socketio,
    game,
    game_sessions,
    player_registry,
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game
)
game_bp = create_game_routes(
    socketio,
    game,
    game_sessions,
    player_registry,
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    game_timeout_controls=game_timeout_controls
)
navigation_bp = create_navigation_routes(socketio, game, game_sessions, addin_sockets_by_game)
info_bp = create_info_routes(game, ADMIN_URL, GAME_URL)

app.register_blueprint(player_bp)
app.register_blueprint(game_bp)
app.register_blueprint(navigation_bp)
app.register_blueprint(info_bp)


@app.after_request
def normalize_message_fields(response):
    """Ensure API responses expose message/reason as structured objects."""
    return normalize_flask_json_response(response)


@app.route('/', methods=['GET', 'POST'])
def api_handler():
    """Handle API requests via query parameters"""
    try:
        # Determine action from query parameters
        if 'init' in request.args:
            action = 'init'
        elif 'join_player' in request.args:
            action = 'join_player'
        elif 'leave_player' in request.args:
            action = 'leave_player'
        elif 'register_session' in request.args:
            action = 'register_session'
        elif 'check_active_game' in request.args:
            action = 'check_active_game'
        elif 'create_room' in request.args:
            action = 'create_room'
        elif 'start_game' in request.args:
            action = 'start_game'
        elif 'close_game' in request.args:
            action = 'close_game'
        elif 'next_page' in request.args:
            action = 'next_page'
        elif 'next_slide' in request.args:
            action = 'next_slide'
        elif 'click_action' in request.args:
            action = 'click_action'
        elif 'reset_animations' in request.args:
            action = 'reset_animations'
        else:
            # Default: show docs
            return info_bp.view_functions['info.docs']()
        
        # Route to appropriate handler
        if action == 'init':
            game_id = random.randint(100000, 999999)
            return jsonify({'game_id': game_id})
        
        elif action == 'join_player':
            return player_bp.handle_join_player()
        
        elif action == 'leave_player':
            return player_bp.handle_leave_player()
        
        elif action == 'register_session':
            return game_bp.handle_register_session()
        
        elif action == 'check_active_game':
            return game_bp.handle_check_active_game()
        
        elif action == 'create_room':
            return game_bp.handle_create_room()
        
        elif action == 'start_game':
            return game_bp.handle_start_game()
        
        elif action == 'close_game':
            return game_bp.handle_close_game()
        
        elif action == 'next_page' or action == 'next_slide':
            return navigation_bp.handle_next_slide()
        
        elif action == 'click_action':
            return navigation_bp.handle_click_action()
        
        elif action == 'reset_animations':
            return navigation_bp.handle_reset_animations()
    
    except Exception as e:
        game.log(f'Error: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500


# --- Load Balancer Integration ---

def register_with_lb(initial=False):
    """Register this server with the load balancer.

    Args:
        initial: If True, exit the process on failure (first-time registration).
                 If False, just log a warning (re-registration from heartbeat).
    """
    global lb_server_id
    logger = logging.getLogger(__name__)
    try:
        logger.info(f'Attempting to register with Load Balancer at {LB_URL}...')
        resp = http_requests.post(f'{LB_URL}/api/servers/register', json={
            'address': SERVER_ADDRESS
        }, timeout=5, verify=False)
        data = resp.json()
        if data.get('status') == 'success':
            lb_server_id = data['server_id']
            logger.info(f'✅ Successfully registered with LB as {lb_server_id}')

            # Initialize lb_client module with LB info
            from utils.lb_client import init_lb
            init_lb(LB_URL, lb_server_id)

            if initial:
                start_heartbeat()
        else:
            logger.error(f'❌ LB registration failed: {data}')
            if initial:
                sys.exit(1)
    except Exception as e:
        logger.error(f'❌ Failed to connect to Load Balancer: {e}')
        if initial:
            logger.error(f'Cannot reach Load Balancer at {LB_URL}. Please ensure:')
            logger.error(f'  1. Load Balancer is running: cd srv-lb && python server.py')
            logger.error(f'  2. URL is correct: {LB_URL}')
            logger.error(f'  3. Network/firewall allows connection')
            logger.error(f'')
            logger.error(f'Shutting down server.')
            sys.exit(1)


def start_heartbeat():
    """Push stats to LB every 30 seconds. Re-registers if LB forgot us."""
    def heartbeat_worker():
        while True:
            socketio.sleep(30)
            if not LB_URL or not lb_server_id:
                break
            try:
                stats = {
                    'active_ws_connections': len(connected_clients),
                    'cpu_percent': psutil.cpu_percent(),
                    'memory_mb': round(psutil.Process().memory_info().rss / (1024 * 1024), 1),
                    'active_games_count': len(game_sessions)
                }
                resp = http_requests.post(
                    f'{LB_URL}/api/servers/{lb_server_id}/heartbeat',
                    json=stats, timeout=5, verify=False
                )
                if resp.status_code == 404:
                    logging.getLogger(__name__).warning('LB does not recognize us — re-registering...')
                    register_with_lb()
            except Exception as e:
                logging.getLogger(__name__).warning(f'Heartbeat failed: {e}')
    socketio.start_background_task(heartbeat_worker)


def notify_lb_game_ended(game_pin):
    """Notify LB that a game PIN is no longer active. Best-effort."""
    if not LB_URL or not lb_server_id:
        return
    try:
        http_requests.post(
            f'{LB_URL}/api/servers/{lb_server_id}/game-ended',
            json={'game_pin': game_pin},
            timeout=5, verify=False
        )
    except Exception:
        pass  # Best effort - stale cleanup will handle it


if __name__ == '__main__':
    print("Starting QuizNGO Quiz Server (Python)")
    print("=" * 40)
    print(f"Server will run on: {SERVER_ADDRESS}")
    print(f"API Documentation: {SERVER_ADDRESS}/docs")
    print(f"Load Balancer: {LB_URL}")
    print(f"Server Address: {SERVER_ADDRESS}")
    print(f"SSL: {'enabled' if USE_SSL else 'disabled'}")
    print(f"Log verbosity: {LOG_VERBOSITY}")
    print("")
    print("⚠️  Server will register with LB in 2 seconds...")
    print("   If LB is not available, server will shut down.")
    print("")
    print("Press Ctrl+C to stop the server")
    print("=" * 40)

    if SOCKETIO_ASYNC_MODE == 'threading':
        print("SocketIO async mode: threading (Windows-safe)")
    else:
        print("SocketIO async mode: eventlet")

    def delayed_lb_registration():
        socketio.sleep(2)
        register_with_lb(True)

    # Register with LB after a short delay (let server start first)
    socketio.start_background_task(delayed_lb_registration)

    run_kwargs = {
        'debug': False,
        'host': '0.0.0.0',
        'port': PORT
    }

    if USE_SSL:
        certfile = str(CERT_DIR / 'localhost.crt')
        keyfile = str(CERT_DIR / 'localhost.key')
        print(f"SSL enabled - certs from: {CERT_DIR}")
        run_kwargs['certfile'] = certfile
        run_kwargs['keyfile'] = keyfile
        socketio.run(app, **run_kwargs)
    else:
        socketio.run(app, **run_kwargs)
