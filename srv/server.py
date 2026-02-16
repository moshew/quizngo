#!/usr/bin/env python3
"""
QuizNGO Quiz Server - Python Flask Implementation

Server-side component for the PowerPoint QuizNGO Add-in
Run locally for testing: python server.py
Deploy to server: see deployment instructions
"""

# IMPORTANT: eventlet monkey patch must be at the very top, before any other imports
import eventlet
eventlet.monkey_patch()

import sys
import random
import logging
import argparse
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
import requests as http_requests
import psutil

# Add srv directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# --- CLI Arguments ---
parser = argparse.ArgumentParser(description='QuizNGO Quiz Server')
parser.add_argument('--port', type=int, default=5001, help='Port to run on (default: 5001)')
parser.add_argument('--lb-url', type=str, default=None, help='Load balancer URL (e.g., http://localhost:5000)')
parser.add_argument('--address', type=str, default=None, help='This server\'s public address (e.g., http://192.168.31.22:5001)')
cli_args = parser.parse_args()

PORT = cli_args.port
LB_URL = cli_args.lb_url
SERVER_ADDRESS = cli_args.address or f'http://localhost:{PORT}'
lb_server_id = None  # Set after registration with LB

from handlers.websocket_handlers import register_websocket_handlers
from routes.player_routes import create_player_routes
from routes.game_routes import create_game_routes
from routes.navigation_routes import create_navigation_routes
from routes.info_routes import create_info_routes

# Configuration
LOG_DIR = Path(__file__).parent / 'logs'
LOG_FILE = LOG_DIR / 'quizngo.log'

# Create log directory if it doesn't exist
LOG_DIR.mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)


class GameLogger:
    """Simple logger wrapper to replace GameManager"""
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def log(self, message):
        self.logger.info(message)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'quizngo_quiz_secret_key_2024'

# Initialize SocketIO
socketio = SocketIO(app, 
    cors_allowed_origins="*",
    async_mode='eventlet',
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
game_sessions = {}  # maps gamePin -> session info
player_registry = {}  # maps uid -> player info

# Initialize logger (replaces GameManager)
game = GameLogger()

# Register WebSocket handlers
register_websocket_handlers(
    socketio, game, connected_clients, client_rooms,
    socket_to_player, game_sessions, player_registry
)

# Create and register blueprints
player_bp = create_player_routes(socketio, game, game_sessions, player_registry, client_rooms, socket_to_player)
game_bp = create_game_routes(socketio, game, game_sessions, player_registry, client_rooms, socket_to_player)
navigation_bp = create_navigation_routes(socketio, game, game_sessions, client_rooms)
info_bp = create_info_routes(game)

app.register_blueprint(player_bp)
app.register_blueprint(game_bp)
app.register_blueprint(navigation_bp)
app.register_blueprint(info_bp)


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

def register_with_lb():
    """Register this server with the load balancer."""
    global lb_server_id
    if not LB_URL:
        return

    logger = logging.getLogger(__name__)
    try:
        logger.info(f'Attempting to register with Load Balancer at {LB_URL}...')
        resp = http_requests.post(f'{LB_URL}/api/servers/register', json={
            'address': SERVER_ADDRESS
        }, timeout=5)
        data = resp.json()
        if data.get('status') == 'success':
            lb_server_id = data['server_id']
            logger.info(f'✅ Successfully registered with LB as {lb_server_id}')

            # Initialize lb_client module with LB info
            from utils.lb_client import init_lb
            init_lb(LB_URL, lb_server_id)

            start_heartbeat()
        else:
            logger.error(f'❌ LB registration failed: {data}')
            logger.error(f'Load Balancer is not accepting registration. Shutting down.')
            sys.exit(1)
    except Exception as e:
        logger.error(f'❌ Failed to connect to Load Balancer: {e}')
        logger.error(f'Cannot reach Load Balancer at {LB_URL}. Please ensure:')
        logger.error(f'  1. Load Balancer is running: cd srv-lb && python server.py')
        logger.error(f'  2. URL is correct: {LB_URL}')
        logger.error(f'  3. Network/firewall allows connection')
        logger.error(f'')
        logger.error(f'Shutting down server.')
        sys.exit(1)


def start_heartbeat():
    """Push stats to LB every 30 seconds."""
    def heartbeat_worker():
        while True:
            eventlet.sleep(30)
            if not LB_URL or not lb_server_id:
                break
            try:
                stats = {
                    'active_ws_connections': len(connected_clients),
                    'cpu_percent': psutil.cpu_percent(),
                    'memory_mb': round(psutil.Process().memory_info().rss / (1024 * 1024), 1),
                    'active_games_count': len(game_sessions)
                }
                http_requests.post(
                    f'{LB_URL}/api/servers/{lb_server_id}/heartbeat',
                    json=stats, timeout=5
                )
            except Exception as e:
                logging.getLogger(__name__).warning(f'Heartbeat failed: {e}')
    eventlet.spawn(heartbeat_worker)


def notify_lb_game_ended(game_pin):
    """Notify LB that a game PIN is no longer active. Best-effort."""
    if not LB_URL or not lb_server_id:
        return
    try:
        http_requests.post(
            f'{LB_URL}/api/servers/{lb_server_id}/game-ended',
            json={'game_pin': game_pin},
            timeout=5
        )
    except Exception:
        pass  # Best effort - stale cleanup will handle it


if __name__ == '__main__':
    print("Starting QuizNGO Quiz Server (Python)")
    print("=" * 40)
    print(f"Server will run on: http://localhost:{PORT}")
    print(f"API Documentation: http://localhost:{PORT}/docs")
    if LB_URL:
        print(f"Load Balancer: {LB_URL}")
        print(f"Server Address: {SERVER_ADDRESS}")
        print("")
        print("⚠️  Load Balancer mode enabled")
        print("   Server will register with LB in 2 seconds...")
        print("   If LB is not available, server will shut down.")
    else:
        print("")
        print("✅ Standalone mode (no Load Balancer)")
    print("")
    print("Press Ctrl+C to stop the server")
    print("=" * 40)

    # Register with LB after a short delay (let server start first)
    if LB_URL:
        eventlet.spawn_after(2, register_with_lb)

    socketio.run(app, debug=False, host='0.0.0.0', port=PORT)
