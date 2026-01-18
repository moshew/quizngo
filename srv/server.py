#!/usr/bin/env python3
"""
Kahoot Quiz Server - Python Flask Implementation

Server-side component for the PowerPoint Kahoot Add-in
Run locally for testing: python server.py
Deploy to server: see deployment instructions
"""

# IMPORTANT: eventlet monkey patch must be at the very top, before any other imports
import eventlet
eventlet.monkey_patch()

import sys
import random
import logging
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO

# Add srv directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from models.game_manager import GameManager
from handlers.websocket_handlers import register_websocket_handlers
from routes.player_routes import create_player_routes
from routes.game_routes import create_game_routes
from routes.presentation_routes import create_presentation_routes
from routes.navigation_routes import create_navigation_routes
from routes.info_routes import create_info_routes

# Configuration
DATA_DIR = Path(__file__).parent / 'data'
LOG_DIR = Path(__file__).parent / 'logs'
GAME_DATA_FILE = DATA_DIR / 'game_data.json'
LOG_FILE = LOG_DIR / 'kahoot.log'

# Create directories if they don't exist
DATA_DIR.mkdir(exist_ok=True)
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

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'kahoot_quiz_secret_key_2024'

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
client_rooms = {}  # maps session_id -> hash_id
socket_to_player = {}  # maps socket_id -> uid
game_sessions = {}  # maps hash_id -> session info
player_registry = {}  # maps uid -> player info

# Initialize game manager
game = GameManager(GAME_DATA_FILE)

# Register WebSocket handlers
register_websocket_handlers(
    socketio, game, connected_clients, client_rooms,
    socket_to_player, game_sessions, player_registry
)

# Create and register blueprints
player_bp = create_player_routes(socketio, game, game_sessions, player_registry, client_rooms, socket_to_player)
game_bp = create_game_routes(socketio, game, game_sessions, player_registry, client_rooms, socket_to_player, DATA_DIR)
presentation_bp = create_presentation_routes(game, DATA_DIR)
navigation_bp = create_navigation_routes(socketio, game, game_sessions, client_rooms)
info_bp = create_info_routes(game)

app.register_blueprint(player_bp)
app.register_blueprint(game_bp)
app.register_blueprint(presentation_bp)
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
        elif 'start_accepting_participants' in request.args:
            action = 'start_accepting_participants'
        elif 'stop_accepting_participants' in request.args:
            action = 'stop_accepting_participants'
        elif 'check_active_game' in request.args:
            action = 'check_active_game'
        elif 'close_game' in request.args:
            action = 'close_game'
        elif 'next_page' in request.args:
            action = 'next_page'
        elif 'next_slide' in request.args:
            action = 'next_slide'
        elif 'get_users' in request.args:
            action = 'get_users'
        elif 'get_time' in request.args:
            action = 'get_time'
        elif 'status' in request.args:
            action = 'status'
        elif 'reset' in request.args:
            action = 'reset'
        elif 'start' in request.args:
            action = 'start'
        elif 'stop' in request.args:
            action = 'stop'
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
        
        elif action == 'start_accepting_participants':
            return game_bp.handle_start_accepting_participants()
        
        elif action == 'stop_accepting_participants':
            return game_bp.handle_stop_accepting_participants()
        
        elif action == 'check_active_game':
            return game_bp.handle_check_active_game()
        
        elif action == 'close_game':
            return game_bp.handle_close_game()
        
        elif action == 'next_page' or action == 'next_slide':
            return navigation_bp.handle_next_slide()
        
        elif action == 'get_users':
            users = game.get_user_count()
            return str(users)
        
        elif action == 'get_time':
            time_remaining = game.get_time_remaining()
            return str(time_remaining)
        
        elif action == 'status':
            status = game.get_game_status()
            return jsonify(status)
        
        elif action == 'reset':
            game_data = game.reset_game()
            return jsonify({
                'status': 'reset',
                'message': 'Game has been reset',
                'data': game_data
            })
        
        elif action == 'start':
            return jsonify({
                'status': 'error',
                'message': 'Legacy timer endpoint is no longer supported.'
            }), 410
        
        elif action == 'stop':
            return jsonify({
                'status': 'error',
                'message': 'Legacy timer endpoint is no longer supported.'
            }), 410
        
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


if __name__ == '__main__':
    print("🎯 Starting Kahoot Quiz Server (Python)")
    print("=" * 40)
    print("Server will run on: http://localhost:5000")
    print("API Documentation: http://localhost:5000/docs")
    print("Participants Widget: http://localhost:5000/participants_widget")
    print("WebSocket URL: ws://localhost:5000")
    print("")
    print("Available endpoints:")
    print("  /?init          - Initialize game")
    print("  /?next_slide    - Next slide")
    print("  /?click_action  - Simulate spacebar press")
    print("  /?get_users     - Get user count")
    print("  /?get_time      - Get time remaining")
    print("  /?status        - Get full status")
    print("  /?reset         - Reset game")
    print("  /save           - Save presentation data (POST)")
    print("  /load           - Load presentation data (POST)")
    print("")
    print("WebSocket Events:")
    print("  participant_update - Participant add/remove")
    print("  player_answer      - Player answer submission")
    print("  player_results     - Question results")
    print("  slide_navigation   - Navigation commands")
    print("  game_closed        - Game closed notification")
    print("")
    print("Press Ctrl+C to stop the server")
    print("=" * 40)
    
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
