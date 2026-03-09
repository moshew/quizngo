#!/usr/bin/env python3
"""
QuizNGO Quiz Server – Python Quart/asyncio Implementation

Server-side component for the PowerPoint QuizNGO Add-in.
Deploy to server: see deployment instructions.
"""

import asyncio
import sys
import random
import logging
import argparse
from pathlib import Path

try:
    import uvloop
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
except ImportError:
    pass  # fall back to stdlib asyncio loop

import socketio as sio_module
import psutil
import urllib3
from quart import Quart, request, jsonify
from quart_cors import cors as quart_cors
import socket

# Suppress SSL warnings for self-signed cert (internal srv→LB communication)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Add srv directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))


def get_local_ip():
    """Detect the machine's LAN IP address by connecting to an external target.
    Falls back to localhost if detection fails."""
    try:
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
    default='quiet',
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
        # Keep HTTPS public address for reverse-proxy deployments (TLS terminated upstream).
        SERVER_ADDRESS = cli_args.address
        print(
            f"INFO: --address is HTTPS while local SSL is disabled; "
            f"assuming reverse proxy TLS termination. Using {SERVER_ADDRESS}"
        )

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

# Attach filters to root handlers so they intercept all propagated records.
root_logger = logging.getLogger()
for handler in root_logger.handlers:
    if LOG_VERBOSITY in ('quiet', 'normal'):
        handler.addFilter(HighVolumeLogFilter())

third_party_level = logging.INFO if LOG_VERBOSITY == 'verbose' else logging.WARNING
logging.getLogger('engineio').setLevel(third_party_level)
logging.getLogger('socketio').setLevel(third_party_level)
logging.getLogger('urllib3').setLevel(logging.WARNING)
logging.getLogger('hypercorn').setLevel(third_party_level)


class GameLogger:
    """Game-aware logger that routes messages by severity based on emoji/keyword hints."""
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


# Initialize python-socketio AsyncServer
sio = sio_module.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False,
    ping_interval=60,   # default 25; halve app-level ping overhead at thousands of connections
    ping_timeout=120,   # > ping_interval so client write-loop timeout (max(60,120)+5=125s) gives
                        # a 65s buffer vs the 5s we had with 45; dead-socket detection within 180s
)

# Initialize Quart app
quart_app = Quart(__name__)
quart_app.config['SECRET_KEY'] = 'quizngo_quiz_secret_key_2024'

# Apply CORS to Quart app
quart_app = quart_cors(quart_app, allow_origin='*', allow_headers=['Content-Type', 'access_token'])

# ASGI-level CORS middleware: ensures CORS headers are present on ALL responses,
# including 500 errors generated before Quart's after_request hooks can run.
class CORSMiddleware:
    CORS_HEADERS = [
        (b'access-control-allow-origin', b'*'),
        (b'access-control-allow-headers', b'Content-Type, access_token'),
        (b'access-control-allow-methods', b'GET, POST, OPTIONS'),
    ]

    def __init__(self, asgi_app):
        self.app = asgi_app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        # Handle preflight OPTIONS at ASGI level immediately
        if scope['method'] == 'OPTIONS':
            await send({
                'type': 'http.response.start',
                'status': 204,
                'headers': self.CORS_HEADERS,
            })
            await send({'type': 'http.response.body', 'body': b''})
            return

        async def send_with_cors(message):
            if message['type'] == 'http.response.start':
                existing_names = {h[0].lower() for h in message.get('headers', [])}
                extra = [(k, v) for k, v in self.CORS_HEADERS if k not in existing_names]
                message = {**message, 'headers': list(message.get('headers', [])) + extra}
            await send(message)

        await self.app(scope, receive, send_with_cors)


# Wrap with ASGI middleware (SocketIO handles /socket.io/ paths, Quart handles the rest)
app = CORSMiddleware(sio_module.ASGIApp(sio, quart_app))

# Global state containers
client_rooms = {}        # maps session_id -> gamePin (room name)
socket_to_player = {}    # maps socket_id -> uid
addin_sockets_by_game = {}   # maps gamePin -> set of add-in socket ids
player_sockets_by_game = {}  # maps gamePin -> set of player socket ids
game_sessions = {}       # maps gamePin -> session info
player_registry = {}     # maps uid -> player info
players_by_game = {}     # maps gamePin -> set of uids (O(1) per-game player lookup)
game_timeout_controls = {}   # maps gamePin -> asyncio.Task for auto-close cancellation
addin_grace_timers = {}      # maps gamePin -> asyncio.Task for addin-disconnect grace period

# Initialize logger
game = GameLogger()

# Register WebSocket handlers
register_websocket_handlers(
    sio, game, client_rooms,
    socket_to_player, addin_sockets_by_game, player_sockets_by_game,
    game_sessions, player_registry,
    players_by_game=players_by_game,
    game_timeout_controls=game_timeout_controls,
    addin_grace_timers=addin_grace_timers,
)

# Create and register blueprints
player_bp = create_player_routes(
    sio,
    game,
    game_sessions,
    player_registry,
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    players_by_game=players_by_game,
)
game_bp = create_game_routes(
    sio,
    game,
    game_sessions,
    player_registry,
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    players_by_game=players_by_game,
    game_timeout_controls=game_timeout_controls,
    addin_grace_timers=addin_grace_timers,
)
navigation_bp = create_navigation_routes(sio, game, game_sessions, addin_sockets_by_game)
info_bp = create_info_routes(game, ADMIN_URL, GAME_URL)

quart_app.register_blueprint(player_bp)
quart_app.register_blueprint(game_bp)
quart_app.register_blueprint(navigation_bp)
quart_app.register_blueprint(info_bp)


@quart_app.after_request
async def normalize_message_fields(response):
    """Ensure API responses expose message/reason as structured objects."""
    return normalize_flask_json_response(response)


@quart_app.route('/', methods=['GET', 'POST'])
async def api_handler():
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
            return jsonify({
                'status': 'ok',
                'service': 'quizngo-srv',
                'docs': '/docs'
            })

        # Route to appropriate handler
        if action == 'init':
            game_id = random.randint(100000, 999999)
            return jsonify({'game_id': game_id})

        elif action == 'join_player':
            return await player_bp.handle_join_player()

        elif action == 'leave_player':
            return await player_bp.handle_leave_player()

        elif action == 'register_session':
            return await game_bp.handle_register_session()

        elif action == 'check_active_game':
            return await game_bp.handle_check_active_game()

        elif action == 'create_room':
            return await game_bp.handle_create_room()

        elif action == 'start_game':
            return await game_bp.handle_start_game()

        elif action == 'close_game':
            return await game_bp.handle_close_game()

        elif action == 'next_page' or action == 'next_slide':
            return await navigation_bp.handle_next_slide()

        elif action == 'click_action':
            return await navigation_bp.handle_click_action()

        elif action == 'reset_animations':
            return await navigation_bp.handle_reset_animations()

    except Exception as e:
        game.log(f'Error: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500


# --- Load Balancer Integration ---

async def register_with_lb(initial=False):
    """Register this server with the load balancer.

    Args:
        initial: If True, exit the process on failure (first-time registration).
                 If False, just log a warning (re-registration from heartbeat).
    """
    global lb_server_id
    logger = logging.getLogger(__name__)
    try:
        from utils.lb_client import lb_post, init_lb
        logger.info(f'Attempting to register with Load Balancer at {LB_URL}...')
        data = await lb_post(f'{LB_URL}/api/servers/register', {'address': SERVER_ADDRESS})
        if data.get('status') == 'success':
            lb_server_id = data['server_id']
            logger.info(f'✅ Successfully registered with LB as {lb_server_id}')
            init_lb(LB_URL, lb_server_id)
            if initial:
                asyncio.create_task(heartbeat_loop())
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


async def heartbeat_loop():
    """Push stats to LB every 30 seconds. Re-registers if LB forgot us."""
    logger = logging.getLogger(__name__)
    from utils.lb_client import lb_post
    while True:
        await asyncio.sleep(30)
        if not LB_URL or not lb_server_id:
            break
        try:
            stats = {
                'active_ws_connections': len(sio.eio.sockets),
                'cpu_percent': psutil.cpu_percent(),
                'memory_mb': round(psutil.Process().memory_info().rss / (1024 * 1024), 1),
                'active_games_count': len(game_sessions)
            }
            data = await lb_post(
                f'{LB_URL}/api/servers/{lb_server_id}/heartbeat',
                stats
            )
            if data.get('status') == 'error':
                logger.warning('LB does not recognize us — re-registering...')
                await register_with_lb()
        except Exception as e:
            logger.warning(f'Heartbeat failed: {e}')


@quart_app.before_serving
async def startup():
    """Start background tasks after the server starts listening."""
    async def delayed_lb_registration():
        await asyncio.sleep(2)
        await register_with_lb(True)

    asyncio.create_task(delayed_lb_registration())


if __name__ == '__main__':
    import hypercorn.asyncio
    from hypercorn.config import Config

    print("Starting QuizNGO Quiz Server (Python / asyncio)")
    print("=" * 40)
    print(f"Load Balancer: {LB_URL}")
    print(f"SSL: {'enabled' if USE_SSL else 'disabled'}")
    print(f"Log verbosity: {LOG_VERBOSITY}")
    print("")
    print("⚠️  Server will register with LB in 2 seconds...")
    print("   If LB is not available, server will shut down.")
    print("")
    print("Press Ctrl+C to stop the server")
    print("=" * 40)

    config = Config()
    config.bind = [f"0.0.0.0:{PORT}"]
    config.backlog = 2048
    config.keep_alive_timeout = 120
    # Hypercorn transport-level WS pings are cheap (handled outside Python event
    # loop) and keep TCP connections alive through nginx.  Engine.IO's app-level
    # pings (60 s) are the ones that go through the event loop.
    config.websocket_ping_interval = 30
    config.websocket_ping_timeout = 20

    if USE_SSL:
        certfile = str(CERT_DIR / 'localhost.crt')
        keyfile = str(CERT_DIR / 'localhost.key')
        print(f"SSL enabled - certs from: {CERT_DIR}")
        config.certfile = certfile
        config.keyfile = keyfile

    asyncio.run(hypercorn.asyncio.serve(app, config))
