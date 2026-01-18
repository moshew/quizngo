#!/usr/bin/env python3
"""
Kahoot Quiz Server - Python Flask Implementation

Server-side component for the PowerPoint Kahoot Add-in
Run locally for testing: python app.py
Deploy to server: see deployment instructions
"""

from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import os
import time
import random
import threading
from datetime import datetime
import logging
from pathlib import Path
import qrcode
from io import BytesIO

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'kahoot_quiz_secret_key_2024'

# Initialize SocketIO
socketio = SocketIO(app, 
    cors_allowed_origins="*",  # Allow all origins for development
    logger=False,
    engineio_logger=False
)

# Configure CORS - allow custom headers
CORS(app, 
     origins="*",  # Allow all origins for development
     allow_headers=["Content-Type", "access_token"],  # Explicitly allow access_token header
     expose_headers=["Content-Type"]
)

# Configuration
DATA_DIR = Path(__file__).parent / 'data'
LOG_DIR = Path(__file__).parent / 'logs'
GAME_DATA_FILE = DATA_DIR / 'game_data.json'
LOG_FILE = LOG_DIR / 'kahoot.log'

# Note: Hash generation is now done client-side in add-in
# The server only receives and validates the hash ID

# Game settings
DEFAULT_SLIDE_TIME = 30
MIN_USERS = 1
MAX_USERS = 100
USER_FLUCTUATION_RANGE = 3

# WebSocket settings
connected_clients = set()

# Hash-based room system: maps session_id -> hash_id
client_rooms = {}  # e.g., {'session123': 'a65445f6664e', 'session456': 'f049ebb08096'}

# Socket ID to player UID mapping: maps socket_id -> uid
# This allows us to find which player disconnected when a WebSocket closes
socket_to_player = {}  # e.g., {'socket_abc': 'uid-123-456'}

# Game sessions: maps hash_id -> session info
game_sessions = {}  # e.g., {'a65445f6664e': {'sessionId': '123456', 'timestamp': 1234567890}}

# Player registry: maps uid -> player info
# Structure: {'uid123': {'nickname': 'name', 'hashId': 'abc123', 'connected': True, 'joinedAt': 1234567890}}
player_registry = {}

# Auto-close timeout (1 hour in seconds)
GAME_TIMEOUT = 3600

def check_game_active(hash_id):
    """Check if a game session is active"""
    if hash_id not in game_sessions:
        return False
    return game_sessions[hash_id].get('active', False)

def schedule_game_timeout(hash_id):
    """Schedule automatic game closure after 1 hour"""
    def timeout_worker():
        time.sleep(GAME_TIMEOUT)
        
        # Check if game is still active
        if hash_id in game_sessions and game_sessions[hash_id].get('active', False):
            game.log(f'⏰ Auto-closing game {hash_id} after {GAME_TIMEOUT}s timeout')
            
            # Close game and clean up players
            close_game_and_cleanup(hash_id, reason='timeout')
    
    timeout_thread = threading.Thread(target=timeout_worker)
    timeout_thread.daemon = True
    timeout_thread.start()
    game.log(f'⏰ Scheduled auto-close for game {hash_id} in {GAME_TIMEOUT}s (1 hour)')

def close_game_and_cleanup(hash_id, reason='manual'):
    """
    Close a game session and remove all associated players.
    
    Args:
        hash_id: The game hash ID to close
        reason: Reason for closure (e.g., 'manual', 'timeout', 'ended')
    """
    if hash_id not in game_sessions:
        game.log(f'⚠️ Cannot close game {hash_id} - not found')
        return
    
    # Mark as inactive
    game_sessions[hash_id]['active'] = False
    game_sessions[hash_id]['closedAt'] = time.time()
    game_sessions[hash_id]['closedReason'] = reason
    
    # Notify clients BEFORE cleanup, to ensure they receive the message
    try:
        emit_to_room('game_closed', {
            'hashId': hash_id,
            'timestamp': time.time(),
            'message': f'Game closed due to {reason}',
            'reason': reason
        }, hash_id)
    except Exception as e:
        game.log(f'⚠️ Error sending game_closed event: {e}')

    # --- Perform data cleanup (players, sockets) ---
    
    # Remove all players from this session
    players_to_remove = [
        uid for uid, player in list(player_registry.items())
        if player.get('hashId') == hash_id
    ]
    
    for uid in players_to_remove:
        # Get name safely
        player_name = 'Unknown'
        if uid in player_registry:
            player_name = player_registry[uid].get('nickname', 'Unknown')
            del player_registry[uid]
    
    # Clear socket mappings for clients associated with this game hash
    sockets_to_remove = [
        sid for sid, h_id in list(client_rooms.items())
        if h_id == hash_id
    ]
    
    for sid in sockets_to_remove:
        # Properly remove from Socket.IO room to prevent receiving future events
        # if the room is reused (register_session with same hash_id)
        try:
            leave_room(hash_id, sid=sid)
        except Exception:
            pass # Ignore errors if socket already disconnected
            
        if sid in socket_to_player:
            del socket_to_player[sid]
        if sid in client_rooms:
            del client_rooms[sid]
            
    game.log(f'🧹 Data cleanup for {hash_id}: Removed {len(players_to_remove)} players and {len(sockets_to_remove)} sockets')
    game.log(f'🔒 Game {hash_id} closed. Reason: {reason}')

def emit_to_room(event, data, target_hash_id):
    """
    Emit a message only to clients in a specific room (hash ID).
    
    Args:
        event: The event name
        data: The data to send
        target_hash_id: The hash ID of the room to send to
    
    Returns:
        Number of clients the message was sent to
    """
    # Socket.IO handles room membership automatically
    # When a socket disconnects, it's automatically removed from all rooms
    # So we can just emit to the room - only connected clients will receive it
    
    # Count active clients in this room (from our tracking)
    # Note: This is an approximation - the actual count is managed by Socket.IO
    tracked_count = sum(1 for hash_id in client_rooms.values() if hash_id == target_hash_id)
    
    # Always emit to the room - Socket.IO will handle delivery to connected clients only
    socketio.emit(event, data, room=target_hash_id)
    
    game.log(f'📤 WS → {event} to room {target_hash_id} (~{tracked_count} tracked client(s))')
    
    return tracked_count

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

class GameManager:
    """Game Manager Class for Kahoot Quiz Server"""
    
    def __init__(self):
        self.data_file = GAME_DATA_FILE
        self.logger = logging.getLogger(__name__)
    
    def log(self, message):
        """Write to log file"""
        self.logger.info(message)
    
    def load_game_data(self):
        """Load game data from file"""
        if not self.data_file.exists():
            return self.get_default_game_data()
        
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data
        except (json.JSONDecodeError, FileNotFoundError) as e:
            self.log(f'Error loading game data: {e}, using defaults')
            return self.get_default_game_data()
    
    def save_game_data(self, data):
        """Save game data to file"""
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            self.log(f'Error saving game data: {e}')
            return False
    
    def get_default_game_data(self):
        """Get default game data"""
        return {
            'initialized': False,
            'current_slide': 0,
            'users': 0,
            'time_remaining': DEFAULT_SLIDE_TIME,
            'game_started': False,
            'start_time': None,
            'slide_start_time': None,
            'total_slides': 0,
            'game_id': f'kahoot_{int(time.time())}',
            'created_at': datetime.now().isoformat()
        }
    
    def initialize_game(self):
        """Initialize new game"""
        data = self.get_default_game_data()
        data.update({
            'initialized': True,
            'game_started': True,
            'start_time': time.time(),
            'current_slide': 1,
            'slide_start_time': time.time(),
            'users': random.randint(5, 25),
            'time_remaining': DEFAULT_SLIDE_TIME
        })
        
        self.save_game_data(data)
        self.log(f"Game initialized with ID: {data['game_id']}, Users: {data['users']}")
        
        return data
    
    def next_slide(self):
        """Move to next slide"""
        data = self.load_game_data()
        
        # If not initialized, just use basic defaults without full initialization
        if not data['initialized']:
            data['current_slide'] = data.get('current_slide', 0)
            data['users'] = data.get('users', 10)  # Default user count
            data['time_remaining'] = DEFAULT_SLIDE_TIME
            data['slide_start_time'] = time.time()
        
        data['current_slide'] += 1
        data['slide_start_time'] = time.time()
        data['time_remaining'] = DEFAULT_SLIDE_TIME
        
        # Keep user count stable or slight change
        if 'users' not in data or data['users'] == 0:
            data['users'] = 10  # Default
        else:
            # Small user fluctuation
            change = random.randint(-2, 3)
            data['users'] = max(1, data['users'] + change)
        
        self.save_game_data(data)
        self.log(f"Moved to slide {data['current_slide']}, Users: {data['users']}")
        
        return data
    
    def get_user_count(self):
        """Get current user count"""
        data = self.load_game_data()
        
        if not data['initialized']:
            return 0
        
        # Simulate slight fluctuations
        fluctuation = random.randint(-1, 2)
        data['users'] = max(MIN_USERS, min(MAX_USERS, data['users'] + fluctuation))
        
        self.save_game_data(data)
        return data['users']
    
    def get_time_remaining(self):
        """Get time remaining for current slide"""
        data = self.load_game_data()
        
        if not data['initialized'] or not data['slide_start_time']:
            return DEFAULT_SLIDE_TIME
        
        elapsed = time.time() - data['slide_start_time']
        time_remaining = max(0, DEFAULT_SLIDE_TIME - elapsed)
        
        data['time_remaining'] = time_remaining
        self.save_game_data(data)
        
        return int(time_remaining)
    
    def get_game_status(self):
        """Get full game status"""
        data = self.load_game_data()
        
        # Add calculated fields
        data['uptime'] = int(time.time() - data['start_time']) if data['start_time'] else 0
        data['slide_elapsed'] = int(time.time() - data['slide_start_time']) if data['slide_start_time'] else 0
        data['server_time'] = datetime.now().isoformat()
        
        return data
    
    def reset_game(self):
        """Reset game"""
        data = self.get_default_game_data()
        self.save_game_data(data)
        self.log("Game reset")
        return data

# Initialize game manager
game = GameManager()

# Timer functions - REMOVED (no longer used)
# Previously used for incrementing user count during game
# Now using participant_update for real-time participant tracking

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    try:
        connected_clients.add(request.sid)
        game.log(f'📡 WS ← connect: {request.sid}')
        
        # Send current status to newly connected client
        game_data = game.get_game_status()
        
        emit('status_update', {
            'users': game_data['users'],
            'current_slide': game_data['current_slide']
        })
    except Exception as e:
        game.log(f'❌ Error in connect handler: {e}')
        import traceback
        traceback.print_exc()

@socketio.on('register_room')
def handle_register_room(data):
    """Register client with a specific hash ID (room)"""
    hash_id = data.get('hashId')
    game.log(f'📡 WS ← register_room: hashId={hash_id}')
    if hash_id:
        # Join Socket.IO room
        join_room(hash_id)
        
        # Track in our mapping
        client_rooms[request.sid] = hash_id
        
        game.log(f'✅ Client {request.sid} joined room (hash): {hash_id}')
        emit('room_registered', {'hashId': hash_id, 'status': 'success'})
    else:
        game.log(f'❌ Client {request.sid} failed to register - no hashId provided')
        emit('room_registered', {'status': 'error', 'message': 'No hashId provided'})

@socketio.on('register_room_by_pin')
def handle_register_room_by_pin(data):
    """Register client (sim) with a game PIN - find hash ID and join room"""
    try:
        game_pin = data.get('gamePin')
        user_id = data.get('userId')  # Optional: sim can send userId to link socket to player
        
        game.log(f'📡 WS ← register_room_by_pin: PIN={game_pin}, userId={user_id}')
        if not game_pin:
            game.log(f'❌ Client {request.sid} failed to register - no gamePin provided')
            emit('room_registered', {'status': 'error', 'message': 'No gamePin provided'})
            return
        
        # Find hash_id for this game_pin
        hash_id = None
        for h_id, session in game_sessions.items():
            if session.get('gamePin') == game_pin:
                hash_id = h_id
                break
        
        if not hash_id:
            game.log(f'❌ Client {request.sid} failed to register - no session found for PIN {game_pin}')
            emit('room_registered', {'status': 'error', 'message': f'No active game found with PIN {game_pin}'})
            return
        
        # Join Socket.IO room
        join_room(hash_id)
        
        # Track in our mapping
        client_rooms[request.sid] = hash_id
        
        # If userId provided, link this socket to the player
        if user_id and user_id in player_registry:
            socket_to_player[request.sid] = user_id
            player = player_registry[user_id]
            game.log(f'🔗 Linked socket {request.sid} to player {user_id}')
            
            # Check if player needs to sync with current game state (reconnection during game)
            if player.get('needsAnswerTimeSync', False):
                # Player reconnected during answer time - send them the current question
                session = game_sessions.get(hash_id, {})
                if session.get('currentState') == 'answering' and 'currentQuestion' in session:
                    question_data = session['currentQuestion']
                    game.log(f'📤 Sending answer_time_started sync to reconnected player {user_id}')
                    emit('answer_time_started', question_data)
                    
                # Clear the flag
                player['needsAnswerTimeSync'] = False
        
        game.log(f'✅ Sim client {request.sid} joined room (hash): {hash_id} via PIN: {game_pin}')
        emit('room_registered', {'hashId': hash_id, 'gamePin': game_pin, 'status': 'success'})
        
    except Exception as e:
        game.log(f'❌ Error in register_room_by_pin: {e}')
        import traceback
        traceback.print_exc()
        emit('room_registered', {'status': 'error', 'message': str(e)})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    connected_clients.discard(request.sid)
    game.log(f'📡 WS ← disconnect: {request.sid}')
    
    # Get room info before leaving
    hash_id_from_room = client_rooms.get(request.sid)
    
    # Check if this socket belongs to a player (sim)
    if request.sid in socket_to_player:
        user_id = socket_to_player[request.sid]
        
        # Mark player as disconnected in registry
        if user_id in player_registry:
            player = player_registry[user_id]
            player_name = player.get('nickname', 'Unknown')
            hash_id = player.get('hashId')
            
            player['connected'] = False
            player['disconnectedAt'] = time.time()
            
            game.log(f'👋 Player WebSocket disconnected: {player_name} (UID: {user_id})')
            game.log(f'📝 Player {player_name} marked as disconnected (can reconnect)')
            
            # Logic for sending participant_update on disconnect:
            # - If in Lobby (Opening slide/acceptingParticipants=True): Send 'remove' update so UI updates
            # - If in Game (answering/results): Do NOT send update, allow reconnection without disrupting game state
            should_send_remove = False
            
            if hash_id in game_sessions:
                if game_sessions[hash_id].get('acceptingParticipants', False):
                    # We are in the lobby, user should be removed from screen
                    should_send_remove = True
                    game.log(f'📢 Lobby active - sending remove update for {player_name}')
                    
                    # Also remove from registry so they must join anew (not reconnect)
                    if user_id in player_registry:
                        del player_registry[user_id]
                        game.log(f'🗑️ Removed player {player_name} from registry (Lobby disconnect)')
                else:
                    # We are in game, user might reconnect
                    game.log(f'🤫 Game active - NOT sending remove update (allow reconnect) for {player_name}')
            
            if should_send_remove:
                emit_to_room('participant_update', {
                    'nick': player_name,
                    'type': 'remove',
                    'user_id': user_id,
                    'timestamp': time.time()
                }, hash_id)
        
        # Remove socket->player mapping
        del socket_to_player[request.sid]
    
    # NOW leave Socket.IO room and remove from mapping
    if request.sid in client_rooms:
        hash_id = client_rooms[request.sid]
        leave_room(hash_id)
        del client_rooms[request.sid]
        game.log(f'🚪 Client left room {hash_id}: {request.sid}')
    else:
        game.log(f'Client disconnected: {request.sid}')

@socketio.on('participant_update')
def handle_participant_update(data):
    """Handle participant add/remove updates - room-aware"""
    try:
        game.log(f'📡 WS ← participant_update: {data}')
        
        # Get hash ID from data or from sender's room
        hash_id = data.get('hashId')
        if not hash_id and request.sid in client_rooms:
            hash_id = client_rooms[request.sid]
        
        if hash_id:
            # Broadcast to specific room only (add-in)
            emit_to_room('participant_update', data, hash_id)
            game.log(f'Sent participant update to room {hash_id}: {data["nick"]} {data["type"]}')
        else:
            # Fallback: broadcast to all if no hash ID
            game.log(f'Warning: No hash ID for participant_update, broadcasting to all')
            socketio.emit('participant_update', data)
        
    except Exception as e:
        game.log(f'Error handling participant update: {e}')

# user_update handler removed - no longer used
# Participants are now tracked via participant_update events only

@app.route('/rejoin_player', methods=['POST'])
def rejoin_player():
    """Handle player rejoin - reconnect with existing UID"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data provided'
            }), 400
        
        game.log(f'📨 POST /rejoin - {data}')
        
        # Get userId and gamePin from data
        user_id = data.get('userId')
        game_pin = data.get('gamePin', '').strip()
        
        if not user_id or not game_pin:
            return jsonify({
                'status': 'error',
                'message': 'Missing userId or gamePin'
            }), 400
        
        # Verify player exists in registry
        if user_id not in player_registry:
            game.log(f'❌ Player UID {user_id} not found in registry')
            return jsonify({
                'status': 'error',
                'message': 'Player not found. Please join the game again.'
            }), 404
        
        player = player_registry[user_id]
        player_name = player['nickname']
        hash_id = player['hashId']
        
        # Verify game is still active
        if hash_id not in game_sessions or not game_sessions[hash_id].get('active', False):
            game.log(f'❌ Game {hash_id} is not active')
            return jsonify({
                'status': 'error',
                'message': 'Game is no longer active'
            }), 404
        
        # Verify game PIN matches
        session = game_sessions[hash_id]
        if session['gamePin'] != game_pin:
            game.log(f'❌ Game PIN mismatch for {player_name}')
            return jsonify({
                'status': 'error',
                'message': 'Invalid game PIN'
            }), 403
        
        # Reconnect the player
        player_registry[user_id]['connected'] = True
        player_registry[user_id]['reconnectedAt'] = time.time()
        
        game.log(f'✅ Player {player_name} (UID: {user_id}) reconnected to game {hash_id}')
        
        # Always send add update on rejoin to ensure add-in has the player
        # (especially if they were removed during lobby disconnect)
        emit_to_room('participant_update', {
            'nick': player_name,
            'icon': player.get('icon', '👤'),
            'type': 'add',
            'user_id': user_id,
            'timestamp': time.time()
        }, hash_id)
        
        if session.get('acceptingParticipants', False):
             game.log(f'📢 Lobby active - sent add update for reconnected player {player_name}')
        else:
             game.log(f'📢 Game active - sent add update for reconnected player {player_name} (restoring if removed)')
        
        # Check current game state and send appropriate status
        game_state = session.get('currentState', 'waiting')
        
        response_data = {
            'status': 'success',
            'message': 'Reconnected successfully',
            'userId': user_id,
            'nickname': player_name,
            'hashId': hash_id,
            'gameState': game_state
        }
        
        # If in answer time, send the current question info via WebSocket
        # The WebSocket connection will be established by the client after this response
        if game_state == 'answering':
            # Store that this player needs to receive answer_time_started
            # We'll send it when they register their WebSocket
            player['needsAnswerTimeSync'] = True
            response_data['needsSync'] = True
        
        return jsonify(response_data)
        
    except Exception as e:
        game.log(f'❌ Error handling player rejoin: {e}')
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/submit_answer', methods=['POST'])
def submit_answer():
    """Handle player answer submission from sim via REST API"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data provided'
            }), 400
        
        game.log(f'📨 POST /submit_answer - {data}')
        
        # Get userId from data - REQUIRED (no longer accepting gamePin)
        user_id = data.get('userId')
        
        if not user_id:
            game.log(f'❌ Missing userId in player answer')
            return jsonify({
                'status': 'error',
                'message': 'Missing userId'
            }), 400
        
        # Verify player exists in registry
        if user_id not in player_registry:
            game.log(f'❌ Player UID {user_id} not found in registry')
            return jsonify({
                'status': 'error',
                'message': 'Player not found. Please rejoin the game.'
            }), 404
        
        player = player_registry[user_id]
        
        # Check if player is connected
        if not player.get('connected', False):
            game.log(f'⚠️ Player {player["nickname"]} (UID: {user_id}) is disconnected')
            return jsonify({
                'status': 'error',
                'message': 'Player is disconnected. Please reconnect.'
            }), 403
        
        # Get hash_id from player registry (already stored)
        hash_id = player['hashId']
        
        # Note: No need to check check_game_active here because:
        # - If game is closed, all players are deleted from player_registry
        # - So we would have returned 404 above already
        
        game.log(f'✅ Answer from {player["nickname"]} (UID: {user_id}) in game {hash_id}')
        
        # Broadcast answer to add-in in this game room via WebSocket
        emit_to_room('player_answer', data, hash_id)
        
        return jsonify({
            'status': 'success',
            'message': 'Answer received and forwarded'
        })
        
    except Exception as e:
        game.log(f'❌ Error handling player answer: {e}')
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@socketio.on('player_answer')
def handle_player_answer(data):
    """Handle player answer submission from sim (deprecated - use REST API)"""
    try:
        game.log(f'📡 WS ← player_answer: {data}')
        
        # Get hash ID from data or from sender's room
        hash_id = data.get('hashId')
        if not hash_id and request.sid in client_rooms:
            hash_id = client_rooms[request.sid]
        
        if hash_id:
            # Forward answer to add-in in this game room
            emit_to_room('player_answer', data, hash_id)
        else:
            # Fallback: broadcast to all if no hash_id
            game.log(f'Warning: No hash ID for player_answer, broadcasting to all')
            socketio.emit('player_answer', data)
        
    except Exception as e:
        game.log(f'Error handling player answer: {e}')

@app.route('/debug_save_location.html')
def debug_save_location():
    """Serve the save location debug page"""
    return send_from_directory('.', 'debug_save_location.html')

@app.route('/participants_widget')
def serve_participants_widget():
    """Serve the participants widget HTML for embedding in PowerPoint slides"""
    html_content = """
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>משתתפים פעילים</title>
        <style>
            body {
                font-family: "Segoe UI", "Segoe UI Web (West European)", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif;
                background-color: #f3f2f1;
                padding: 15px;
                margin: 0;
                direction: rtl;
                border-radius: 4px;
                border: 2px solid #0078d4;
                height: 100vh;
                box-sizing: border-box;
                overflow: hidden;
            }
            
            h4 {
                margin: 0 0 10px 0;
                text-align: center;
                color: #0078d4;
                font-size: 14px;
                font-weight: bold;
            }
            
            .participants-container {
                min-height: 80px;
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 6px;
                align-items: flex-start;
                margin-bottom: 10px;
            }
            
            .participant-item {
                background: linear-gradient(135deg, #0078d4, #106ebe);
                color: white;
                padding: 6px 10px;
                border-radius: 18px;
                font-size: 12px;
                font-weight: bold;
                box-shadow: 0 2px 6px rgba(0,120,212,0.3);
                transition: all 0.3s ease;
                animation: slideIn 0.3s ease-out;
                white-space: nowrap;
            }
            
            .stats {
                text-align: center;
                font-size: 11px;
                color: #666;
                font-weight: bold;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: scale(0.8) translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            .no-participants {
                color: #666;
                font-style: italic;
                text-align: center;
                padding: 15px;
                font-size: 12px;
            }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js"></script>
    </head>
    <body>
        <h4>משתתפים פעילים</h4>
        <div class="participants-container" id="participantsContainer">
            <div class="no-participants">מחכים למשתתפים...</div>
        </div>
        <div class="stats">
            סה"כ משתתפים: <span id="totalCount">0</span>
        </div>

        <script>
            let participantsList = [];
            
            // Initialize Socket.IO connection
            const socket = io('http://localhost:5000');
            
            socket.on('connect', function() {
                console.log('🌐 Widget connected to server');
            });
            
            socket.on('participant_update', function(data) {
                console.log('👥 Widget participant update received:', data);
                handleParticipantUpdate(data);
            });
            
            function handleParticipantUpdate(data) {
                const { nick, type, total } = data;
                
                if (type === 'add') {
                    if (!participantsList.includes(nick)) {
                        participantsList.push(nick);
                        addParticipantToUI(nick);
                    }
                } else if (type === 'remove') {
                    const index = participantsList.indexOf(nick);
                    if (index > -1) {
                        participantsList.splice(index, 1);
                        removeParticipantFromUI(nick);
                    }
                }
                
                updateStats();
            }
            
            function addParticipantToUI(nickname) {
                const container = document.getElementById('participantsContainer');
                
                // Remove "no participants" message if present
                const noParticipants = container.querySelector('.no-participants');
                if (noParticipants) {
                    noParticipants.remove();
                }
                
                // Create participant element
                const participantDiv = document.createElement('div');
                participantDiv.className = 'participant-item';
                participantDiv.textContent = nickname;
                participantDiv.setAttribute('data-participant', nickname);
                
                container.appendChild(participantDiv);
            }
            
            function removeParticipantFromUI(nickname) {
                const container = document.getElementById('participantsContainer');
                const participantDiv = container.querySelector('[data-participant="' + nickname + '"]');
                
                if (participantDiv) {
                    participantDiv.remove();
                }
                
                // Show "no participants" message if empty
                if (participantsList.length === 0) {
                    const noParticipants = document.createElement('div');
                    noParticipants.className = 'no-participants';
                    noParticipants.textContent = 'מחכים למשתתפים...';
                    container.appendChild(noParticipants);
                }
            }
            
            function updateStats() {
                document.getElementById('totalCount').textContent = participantsList.length;
            }
        </script>
    </body>
    </html>
    """
    return html_content

@app.route('/docs')
def index():
    """API documentation page"""
    status = game.get_game_status()
    
    html = f"""
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <title>Kahoot Quiz Server API</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; direction: rtl; }}
            .endpoint {{ background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }}
            .url {{ font-family: monospace; background: #e0e0e0; padding: 5px; border-radius: 3px; }}
            .status {{ padding: 10px; background: #d4edda; border-radius: 5px; margin: 20px 0; }}
            .python-note {{ padding: 10px; background: #cce5ff; border-radius: 5px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <h1>🎯 Kahoot Quiz Server API (Python)</h1>
        
        <div class="python-note">
            <strong>🐍 Python Server</strong><br>
            זהו שרת פייתון לבדיקה מקומית.<br>
            הפעל עם: <code>python app.py</code><br>
            השרת רץ על: <code>http://localhost:5000</code>
        </div>
        
        <div class="status">
            <strong>סטטוס שרת:</strong> פעיל<br>
            <strong>גרסה:</strong> 1.0.0 (Python)<br>
            <strong>זמן שרת:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br>
            <strong>משחק מאותחל:</strong> {'כן' if status['initialized'] else 'לא'}
        </div>
        
        <h2>נקודות קצה זמינות (Endpoints)</h2>
        
        <div class="note" style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
            <h4 style="margin-top: 0;">� הערה חשובה - מבנה המערכת</h4>
            <p><strong>מזהה משחק (Hash ID):</strong> מזהה ייחודי המחושב מנתיב קובץ המצגת (12 תווים הקסדצימליים)</p>
            <p><strong>קוד משחק (Game PIN):</strong> קוד בן 6 ספרות שמשתתפים משתמשים בו כדי להצטרף למשחק</p>
            <p><strong>מזהה משתתף (UID):</strong> מזהה ייחודי שהשרת מייצר לכל משתתף בעת ההצטרפות</p>
        </div>
        
        <h3>🎮 ניהול משחק</h3>
        
        <div class="endpoint">
            <h3>🎯 רישום סשן משחק</h3>
            <div class="url">GET /?register_session&amp;hash_id=HASH&amp;game_pin=PIN</div>
            <p>רושם סשן משחק חדש עם hash_id (מזהה מצגת) ו-game_pin (קוד כניסה למשחק)</p>
            <p><strong>מבצע גם:</strong> איפוס המצגת לשקף הראשון אוטומטית + תזמון סגירה אוטומטית אחרי שעה</p>
            <p><strong>דוגמה:</strong> <code>/?register_session&hash_id=00007236196d&game_pin=123456</code></p>
        </div>
        
        <div class="endpoint">
            <h3>🔍 בדיקת קיום משחק פעיל</h3>
            <div class="url">GET /?check_active_game&amp;hash_id=HASH</div>
            <p>בודק אם קיים משחק פעיל עבור ה-hash_id הנתון</p>
            <p><strong>מחזיר:</strong> <code>{"status": "success", "active": true/false, "gamePin": "123456"}</code></p>
            <p><strong>שימוש:</strong> Admin קורא לזה בטעינה כדי להצטרף למשחק קיים במקום ליצור חדש</p>
            <p><strong>דוגמה:</strong> <code>/?check_active_game&hash_id=00007236196d</code></p>
        </div>
        
        <div class="endpoint">
            <h3>🔒 סגירת משחק</h3>
            <div class="url">GET /?close_game&amp;hash_id=HASH</div>
            <p>סוגר משחק פעיל (מסמן אותו כ-inactive)</p>
            <p><strong>נקרא אוטומטית:</strong> כשמגיעים לשקף האחרון במצגת (add-in קורא לזה)</p>
            <p><strong>נקרא גם:</strong> אוטומטית אחרי שעה (timeout)</p>
            <p><strong>דוגמה:</strong> <code>/?close_game&hash_id=00007236196d</code></p>
        </div>
        
        <h3>👥 ניהול משתתפים</h3>
        
        <div class="endpoint">
            <h3>🚪 התחל קבלת משתתפים</h3>
            <div class="url">GET /?start_accepting_participants&amp;hash_id=HASH</div>
            <p><strong>נקרא אוטומטית:</strong> כשנכנסים לשקף "פתיחה"</p>
            <p>מאפשר קבלת משתתפים חדשים למשחק</p>
        </div>
        
        <div class="endpoint">
            <h3>🚫 הפסק קבלת משתתפים</h3>
            <div class="url">GET /?stop_accepting_participants&amp;hash_id=HASH</div>
            <p><strong>נקרא אוטומטית:</strong> כשעוברים לשקף הבא אחרי "פתיחה"</p>
            <p>חוסם קבלת משתתפים חדשים (מחזיר שגיאה 403)</p>
        </div>
        
        <div class="endpoint">
            <h3>➕ הצטרפות משתתף</h3>
            <div class="url">POST /?join_player</div>
            <p><strong>JSON Body:</strong> <code>{{"game_pin": "123456", "name": "שם"}}</code></p>
            <p><strong>מחזיר:</strong> <code>{{"status": "success", "uid": "unique-id-123"}}</code></p>
            <p>ה-uid מיוצר על-ידי השרת ונשלח בכל בקשה עתידית ב-header: <code>access_token: uid</code></p>
            <p>מוסיף משתתף למשחק (רק אם המשחק בשקף "פתיחה")</p>
        </div>
        
        <div class="endpoint">
            <h3>➖ ניתוק משתתף</h3>
            <div class="url">POST /?leave_player&amp;uid=UID</div>
            <p><strong>Query Params:</strong> <code>uid</code> - ה-UID שהתקבל בהצטרפות</p>
            <p><strong>Body:</strong> לא נדרש</p>
            <p><strong>דוגמה:</strong> <code>/?leave_player&uid=abc-123-def</code></p>
            <p>מסיר משתתף מהמשחק</p>
        </div>
        
        <h3>🧭 ניווט ובקרה</h3>
        
        <div class="endpoint">
            <h3>➡️ מעבר לשקף הבא</h3>
            <div class="url">GET /?next_page&amp;hash_id=HASH (או /?next_slide)</div>
            <p>שולח פקודת WebSocket ל-add-in לעבור לשקף הבא במצגת</p>
            <p><strong>דוגמה:</strong> <code>/?next_slide&hash_id=00007236196d</code></p>
        </div>
        
        <h3>📊 מידע ונתונים</h3>
        
        <div class="endpoint">
            <h3>� סטטוס מלא</h3>
            <div class="url">GET /?status</div>
            <p>מחזיר את כל נתוני המשחק בפורמט JSON</p>
        </div>
        
        <div class="endpoint">
            <h3>🎮 מידע על משחק</h3>
            <div class="url">GET /game-info/HASH_ID</div>
            <p>מחזיר מידע על משחק כולל URL לאדמין וקוד QR</p>
        </div>
        
        <div class="endpoint">
            <h3>� קוד QR לאדמין</h3>
            <div class="url">GET /qr-code/HASH_ID</div>
            <p>מחזיר תמונת QR לכניסת אדמין (פורט 3002)</p>
            <p><strong>דוגמה:</strong> <code>/qr-code/00007236196d</code></p>
        </div>
        
        <div class="endpoint">
            <h3>📱 קוד QR לשחקנים</h3>
            <div class="url">GET /qr-code-player/GAME_PIN</div>
            <p>מחזיר תמונת QR לכניסת שחקנים (פורט 8080)</p>
            <p><strong>דוגמה:</strong> <code>/qr-code-player/123456</code> או <code>/qr-code-player/123-456</code></p>
        </div>
        
        <h3>💾 שמירה וטעינה</h3>
        
        <div class="endpoint">
            <h3>� שמירת מצגת</h3>
            <div class="url">POST /save</div>
            <p><strong>JSON Body:</strong> <code>{{"hashId": "HASH", "data": {{...}}}}</code></p>
            <p>שומר נתוני מצגת לפי hash ID</p>
            <p><strong>מבנה הנתונים:</strong> slideTypeData (מסודר לפי UUID של שקפים), presentationSettings</p>
            <p><strong>מיקום:</strong> <code>srv/data/saved_presentations/{{hash_id}}.json</code></p>
        </div>
        
        <div class="endpoint">
            <h3>� טעינת מצגת</h3>
            <div class="url">POST /load</div>
            <p><strong>JSON Body:</strong> <code>{{"hashId": "HASH"}}</code></p>
            <p>טוען נתוני מצגת שמורים לפי hash ID</p>
        </div>
        
        <h3>🔌 WebSocket Events</h3>
        
        <div class="endpoint">
            <h3>� אירועים זמינים</h3>
            <div class="url">ws://localhost:5000</div>
            <p><strong>participant_update:</strong> עדכון על הוספה/הסרה של משתתף בודד (נשלח רק ל-add-in)</p>
            <p><strong>player_answer:</strong> תשובת שחקן מה-sim (נשלח רק ל-add-in)</p>
            <p><strong>player_results:</strong> תוצאות שאלה (נשלח רק ל-sim הספציפי)</p>
            <p><strong>slide_navigation:</strong> פקודות ניווט בין שקפים (נשלח רק ל-add-in)</p>
            <p><strong>game_pin_registered:</strong> אישור רישום קוד משחק (נשלח רק ל-add-in)</p>
            <p><strong>game_closed:</strong> סגירת משחק (נשלח לכל מי שבחדר המשחק)</p>
        </div>
        
        <h2>מידע נוכחי</h2>
        <pre>{json.dumps(status, indent=2, ensure_ascii=False)}</pre>
        
        <hr>
        <p><small>Kahoot Quiz Server API v1.0 (Python) - תוכנן לעבודה עם PowerPoint Add-in</small></p>
    </body>
    </html>
    """
    return html

@app.route('/save', methods=['POST'])
def save_presentation():
    """
    Save presentation data by presentation path.
    
    The client sends the full presentation path, and the server creates
    a unique hash ID from it. This ensures:
    - Consistency: Same path always gets same hash
    - Security: Hash generation controlled by server
    - Uniqueness: Different paths get different hashes
    
    IMPORTANT: This server does NOT cache presentation data in memory.
    All data is saved directly to files (data/saved_presentations/{hash_id}.json).
    The slideTypeData is stored with slide IDs (UUIDs) as keys, NOT slide numbers.
    This ensures slide types persist even if slides are reordered.
    """
    try:
        data = request.get_json()
        
        print("=" * 50)
        print("📥 SAVE REQUEST RECEIVED:")
        print("Full JSON received:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print("=" * 50)
        
        # Check for required fields - now expecting hashId instead of presentationPath
        if not data or 'hashId' not in data or 'data' not in data:
            print("❌ ERROR: Missing hashId or data in request")
            return jsonify({
                'status': 'error',
                'message': 'Missing hashId or data in request'
            }), 400
        
        hash_id = data['hashId']
        presentation_data = data['data']
        
        print(f"📋 Extracted data:")
        print(f"  Hash ID (from client): {hash_id}")
        
        # VALIDATION: Check if hash ID is valid
        if not hash_id or not isinstance(hash_id, str) or hash_id.strip() == '':
            print("❌ ERROR: Invalid hash ID")
            return jsonify({
                'status': 'error',
                'message': 'Invalid hash ID'
            }), 400
        
        # Additional sanitization for extra safety
        import re
        hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
        
        if len(hash_id) < 8 or len(hash_id) > 20:
            print(f"❌ ERROR: Hash ID length out of range: {len(hash_id)}")
            return jsonify({
                'status': 'error',
                'message': 'Invalid hash ID length'
            }), 400
        
        print(f"  Hash ID (sanitized): {hash_id}")
        print(f"  Presentation data keys: {list(presentation_data.keys()) if presentation_data else 'None'}")
        if 'gameState' in presentation_data:
            print(f"  Game state keys: {list(presentation_data['gameState'].keys())}")
            if 'slideTypeData' in presentation_data['gameState']:
                slide_type_data = presentation_data['gameState']['slideTypeData']
                print(f"  📝 Slide type data (keyed by UUID):")
                print(f"     Total slides with types: {len(slide_type_data)}")
                print(f"     Slide IDs: {list(slide_type_data.keys())}")
                print(f"     Full data: {json.dumps(slide_type_data, indent=4, ensure_ascii=False)}")
        
        # Ensure the saved files directory exists
        saved_files_dir = DATA_DIR / 'saved_presentations'
        saved_files_dir.mkdir(exist_ok=True)
        
        # Save the data as hash_id.json (NO CACHE - direct to file)
        # IMPORTANT: saved_files_dir is ALWAYS srv/data/saved_presentations/
        # hash_id is generated by server from path (secure)
        save_file = saved_files_dir / f'{hash_id}.json'
        
        # Final safety check: make sure save_file is inside saved_files_dir
        if not str(save_file.resolve()).startswith(str(saved_files_dir.resolve())):
            print(f"❌ SECURITY ERROR: Attempted path traversal!")
            print(f"   Attempted path: {save_file}")
            print(f"   Allowed directory: {saved_files_dir}")
            return jsonify({
                'status': 'error',
                'message': 'Invalid file path'
            }), 400
        
        # Update presentation_data with hash_id
        if isinstance(presentation_data, dict):
            presentation_data['hashId'] = hash_id
        
        with open(save_file, 'w', encoding='utf-8') as f:
            json.dump(presentation_data, f, indent=2, ensure_ascii=False)
        
        game.log(f'✅ Saved presentation data to {save_file}')
        game.log(f'   Hash ID (from client): {hash_id}')
        game.log(f'   No cache used - data saved directly to file')
        
        return jsonify({
            'status': 'success',
            'message': 'Presentation saved successfully',
            'hashId': hash_id,
            'file': str(save_file)
        })
        
    except Exception as e:
        game.log(f'❌ Error saving presentation: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'Error saving presentation: {str(e)}'
        }), 500

@app.route('/list_saved_files', methods=['GET'])
def list_saved_files():
    """List all saved presentation files"""
    try:
        saved_files_dir = DATA_DIR / 'saved_presentations'
        
        # Ensure directory exists
        if not saved_files_dir.exists():
            return jsonify({
                'status': 'info',
                'files': [],
                'directory': str(saved_files_dir),
                'message': 'Directory does not exist yet'
            })
        
        # Get all JSON files
        files = list(saved_files_dir.glob('*.json'))
        
        # Get file details
        file_details = []
        for file in files:
            file_info = {
                'name': file.name,
                'size': file.stat().st_size,
                'modified': file.stat().st_mtime
            }
            
            # Try to read file content for more info
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if 'gameState' in data and 'slideTypeData' in data['gameState']:
                        file_info['slides'] = len(data['gameState']['slideTypeData'])
            except:
                file_info['slides'] = 'unknown'
            
            file_details.append(file_info)
        
        return jsonify({
            'status': 'success',
            'count': len(files),
            'files': [f['name'] for f in file_details],
            'details': file_details,
            'directory': str(saved_files_dir.absolute()),
            'message': f'Found {len(files)} saved presentation(s)'
        })
        
    except Exception as e:
        game.log(f'Error listing saved files: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'Error listing files: {str(e)}'
        }), 500

@app.route('/sim_gamePIN', methods=['GET'])
def get_active_game_pins():
    """Get list of all active game PINs for the simulator"""
    try:
        # Return all active game sessions with their PINs
        active_pins = []
        
        for hash_id, session in game_sessions.items():
            if session.get('active', False):
                active_pins.append({
                    'gamePin': session.get('gamePin'),
                    'hashId': hash_id,
                    'timestamp': session.get('timestamp'),
                    'acceptingParticipants': session.get('acceptingParticipants', False)
                })
        
        game.log(f'📋 Retrieved {len(active_pins)} active game PINs for simulator')
        
        return jsonify({
            'status': 'success',
            'count': len(active_pins),
            'games': active_pins
        })
        
    except Exception as e:
        game.log(f'❌ Error getting active game PINs: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'Error: {str(e)}'
        }), 500

@app.route('/answer_time_started', methods=['POST'])
def answer_time_started():
    """
    Handle answer time started via REST API.
    Sends individual answer_time_started event to each player (sim) in the game.
    """
    try:
        data = request.get_json()
        hash_id = data.get('hashId', 'N/A')
        
        game.log(f'📨 POST /answer_time_started - hashId: {hash_id}')
        
        if hash_id and hash_id != 'N/A':
            # Update session state
            if hash_id in game_sessions:
                game_sessions[hash_id]['currentState'] = 'answering'
                game_sessions[hash_id]['currentQuestion'] = data
                game.log(f'💾 Saved current question state for game {hash_id}')
            
            # Find all players in this game
            players_in_game = [
                (uid, player) for uid, player in player_registry.items() 
                if player.get('hashId') == hash_id and player.get('connected', False)
            ]
            
            if not players_in_game:
                game.log(f'⚠️ No connected players found in game {hash_id}')
                return jsonify({
                    'status': 'warning',
                    'message': 'No connected players in game',
                    'hashId': hash_id
                })
            
            # Send to each player individually via room broadcast
            # (Each sim WebSocket is in the room, will receive the event)
            sent_count = emit_to_room('answer_time_started', data, hash_id)
            
            game.log(f'✅ Sent answer_time_started to {len(players_in_game)} player(s) in game {hash_id}')
            
            return jsonify({
                'status': 'success',
                'message': f'Sent to {len(players_in_game)} player(s)',
                'hashId': hash_id,
                'playerCount': len(players_in_game)
            })
        else:
            game.log(f'⚠️ Warning: No hash ID for answer_time_started')
            return jsonify({
                'status': 'error',
                'message': 'Missing hashId'
            }), 400
        
    except Exception as e:
        game.log(f'❌ Error handling answer_time_started: {e}')
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/submit_results', methods=['POST'])
def submit_results():
    """
    Receive question results from add-in and broadcast individual results to each player.
    Each player receives their own results via WebSocket.
    """
    try:
        data = request.get_json()
        
        # Log what we received
        game.log(f'📨 POST /submit_results')
        
        if not data:
            game.log('❌ No JSON data received')
            return jsonify({
                'status': 'error',
                'message': 'No JSON data provided'
            }), 400
        
        hash_id = data.get('hashId')
        results = data.get('results', [])
        
        game.log(f'   hashId: {hash_id}, results: {len(results)} players')
        
        # Clear current question state (answer time ended)
        if hash_id in game_sessions:
            game_sessions[hash_id]['currentState'] = 'results'
            if 'currentQuestion' in game_sessions[hash_id]:
                del game_sessions[hash_id]['currentQuestion']
            game.log(f'💾 Cleared current question state for game {hash_id}')
        
        if not hash_id:
            game.log('❌ Missing hashId in request')
            return jsonify({
                'status': 'error',
                'message': 'Missing hashId'
            }), 400
        
        if not results:
            game.log('❌ Missing or empty results in request')
            return jsonify({
                'status': 'error',
                'message': 'Missing or empty results'
            }), 400
        
        # Broadcast individual results to each player
        for result in results:
            user_id = result.get('userId')
            
            # Prepare player-specific data
            player_data = {
                'userId': user_id,
                'nickname': result.get('nickname'),
                'questionScore': result.get('questionScore'),
                'cumulativeScore': result.get('cumulativeScore'),
                'rank': result.get('rank'),
                'isCorrect': result.get('isCorrect'),
                'answered': result.get('answered'),
                'timestamp': data.get('timestamp')
            }
            
            # Send to all sims in this game room (they will filter by userId)
            emit_to_room('player_results', player_data, hash_id)
            
            game.log(f'   → {result.get("nickname")}: Rank #{result.get("rank")}, Score: {result.get("cumulativeScore")}')
        
        game.log(f'✅ Results sent to {len(results)} player(s)')
        
        return jsonify({
            'status': 'success',
            'message': f'Results sent to {len(results)} player(s)',
            'hashId': hash_id
        })
        
    except Exception as e:
        game.log(f'❌ Error handling submit_results: {e}')
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/game-info/<hash_id>', methods=['GET'])
def get_game_info(hash_id):
    """
    Get game information including QR code for a specific game hash.
    This supports multiple games running in parallel by hash ID.
    
    Args:
        hash_id: The game hash ID
        
    Returns:
        JSON with game URL and QR code data
    """
    try:
        print("=" * 50)
        print(f"📋 GAME INFO REQUEST for hash: {hash_id}")
        
        # Validate hash ID
        if not hash_id or not isinstance(hash_id, str) or hash_id.strip() == '':
            return jsonify({
                'status': 'error',
                'message': 'Invalid hash ID'
            }), 400
        
        # Sanitize hash ID
        import re
        hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
        
        if len(hash_id) < 8 or len(hash_id) > 20:
            return jsonify({
                'status': 'error',
                'message': 'Invalid hash ID length'
            }), 400
        
        # Build admin URL (for QR code in "Start Game" button)
        # Admin joins via port 3002 with hashId
        # TODO: Make this configurable via environment variable
        admin_url = f'http://192.168.31.22:3002/{hash_id}'
        
        game.log(f'✅ Generated game info for hash: {hash_id}')
        game.log(f'   Admin URL: {admin_url}')
        
        return jsonify({
            'status': 'success',
            'hashId': hash_id,
            'adminUrl': admin_url,
            'qrCodeUrl': f'/qr-code/{hash_id}'  # QR for admin (port 3002)
        })
        
    except Exception as e:
        game.log(f'❌ Error generating game info: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'Error: {str(e)}'
        }), 500

@app.route('/qr-code/<hash_id>', methods=['GET'])
def get_qr_code(hash_id):
    """
    Generate and return QR code image for admin (uses hash_id).
    
    Args:
        hash_id: The game hash ID
        
    Returns:
        PNG image of QR code
    """
    try:
        # Validate and sanitize hash ID
        import re
        hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
        
        if len(hash_id) < 8 or len(hash_id) > 20:
            return "Invalid hash ID", 400
        
        # Build admin URL (port 3002)
        admin_url = f'http://192.168.31.22:3002/{hash_id}'
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(admin_url)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="#0078d4", back_color="white")
        
        # Save to BytesIO
        img_io = BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)
        
        game.log(f'✅ Generated QR code for admin with hash: {hash_id}')
        
        return send_file(img_io, mimetype='image/png', as_attachment=False)
        
    except Exception as e:
        game.log(f'❌ Error generating QR code: {str(e)}')
        return f"Error generating QR code: {str(e)}", 500

@app.route('/qr-code-player/<game_pin>', methods=['GET'])
def get_qr_code_player(game_pin):
    """
    Generate and return QR code image for players (uses game_pin).
    This is for the opening slide - players scan to join the game.
    
    Args:
        game_pin: The 6-digit game PIN (e.g., "123456" or "123-456")
        
    Returns:
        PNG image of QR code
    """
    try:
        # Validate and sanitize game PIN
        import re
        game_pin_clean = re.sub(r'[^0-9]', '', game_pin)
        
        if len(game_pin_clean) != 6:
            return "Invalid game PIN - must be 6 digits", 400
        
        # Format as XXX-XXX
        formatted_pin = f'{game_pin_clean[:3]}-{game_pin_clean[3:]}'
        
        # Build player URL (port 8080)
        player_url = f'http://192.168.31.22:8080/{formatted_pin}'
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(player_url)
        qr.make(fit=True)
        
        # Create image with different color for player QR (green)
        img = qr.make_image(fill_color="#16a085", back_color="white")
        
        # Save to BytesIO
        img_io = BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)
        
        game.log(f'✅ Generated player QR code for game PIN: {formatted_pin}')
        
        return send_file(img_io, mimetype='image/png', as_attachment=False)
        
    except Exception as e:
        game.log(f'❌ Error generating player QR code: {str(e)}')
        return f"Error generating QR code: {str(e)}", 500

@app.route('/load', methods=['POST'])
def load_presentation():
    """
    Load presentation data by hash ID.
    
    The client generates the hash ID from the presentation path and sends it directly.
    
    IMPORTANT: This server does NOT cache presentation data in memory.
    All data is loaded directly from files (data/saved_presentations/{hash_id}.json).
    The slideTypeData will be loaded with slide IDs (UUIDs) as keys, NOT slide numbers.
    This ensures the client can restore slide types by ID regardless of slide order.
    """
    try:
        data = request.get_json()
        
        if not data or 'hashId' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing hashId in request'
            }), 400
        
        hash_id = data['hashId']
        
        print("=" * 50)
        print("📂 LOAD REQUEST RECEIVED:")
        print(f"  Hash ID (from client): {hash_id}")
        
        # VALIDATION: Check if hash ID is valid
        if not hash_id or not isinstance(hash_id, str) or hash_id.strip() == '':
            print("❌ ERROR: Invalid hash ID")
            return jsonify({
                'status': 'error',
                'message': 'Invalid hash ID'
            }), 400
        
        # Additional sanitization for extra safety
        import re
        hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
        
        if len(hash_id) < 8 or len(hash_id) > 20:
            print(f"❌ ERROR: Hash ID length out of range: {len(hash_id)}")
            return jsonify({
                'status': 'error',
                'message': 'Invalid hash ID length'
            }), 400
        
        print(f"  Hash ID (sanitized): {hash_id}")
        
        # Look for the saved file by Hash ID (NO CACHE - direct from file)
        saved_files_dir = DATA_DIR / 'saved_presentations'
        save_file = saved_files_dir / f'{hash_id}.json'
        
        # Final safety check: make sure save_file is inside saved_files_dir
        if not str(save_file.resolve()).startswith(str(saved_files_dir.resolve())):
            print(f"❌ SECURITY ERROR: Attempted path traversal!")
            print(f"   Attempted path: {save_file}")
            print(f"   Allowed directory: {saved_files_dir}")
            return jsonify({
                'status': 'error',
                'message': 'Invalid file path'
            }), 400
        
        if not save_file.exists():
            print(f"❌ No saved file found: {save_file}")
            game.log(f'No saved data found for hash ID: {hash_id}')
            return jsonify({
                'status': 'error',
                'message': 'No saved data found for this presentation'
            }), 404
        
        # Load the data directly from file (NO CACHE)
        with open(save_file, 'r', encoding='utf-8') as f:
            presentation_data = json.load(f)
        
        # Log what we loaded
        if 'gameState' in presentation_data and 'slideTypeData' in presentation_data['gameState']:
            slide_type_data = presentation_data['gameState']['slideTypeData']
            print(f"  📝 Loaded slide type data (keyed by UUID):")
            print(f"     Total slides with types: {len(slide_type_data)}")
            print(f"     Slide IDs: {list(slide_type_data.keys())}")
            print(f"     Full data: {json.dumps(slide_type_data, indent=4, ensure_ascii=False)}")
        
        print("=" * 50)
        
        game.log(f'✅ Loaded presentation data from {save_file}')
        game.log(f'   Hash ID (from client): {hash_id}')
        game.log(f'   No cache used - data loaded directly from file')
        
        return jsonify({
            'status': 'success',
            'message': 'Presentation loaded successfully',
            'hashId': hash_id,
            'data': presentation_data,
            'file': str(save_file)
        })
        
    except Exception as e:
        game.log(f'❌ Error loading presentation: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'Error loading presentation: {str(e)}'
        }), 500

@app.route('/', methods=['GET', 'POST'])
def api_handler():
    """Handle API requests"""
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
            return index()
        
        # Handle different actions
        if action == 'init':
            # Generate random 6-digit game ID
            game_id = random.randint(100000, 999999)
            return jsonify({
                'game_id': game_id
            })
        
        elif action == 'join_player':
            # Player joins game by game PIN
            try:
                # Get JSON data from POST request
                data = request.get_json()
                if not data:
                    return jsonify({
                        'status': 'error',
                        'message': 'No JSON data provided'
                    }), 400
                
                game_pin = data.get('game_pin', '').strip()
                name = data.get('name', '').strip()
                icon = data.get('icon', '').strip()
                
                if not game_pin or not name:
                    return jsonify({
                        'status': 'error',
                        'message': 'Missing game_pin or name'
                    }), 400
                
                # Sanitize inputs
                import re
                game_pin = re.sub(r'[^0-9]', '', game_pin)
                
                if len(game_pin) != 6:
                    return jsonify({
                        'status': 'error',
                        'message': 'Game PIN must be 6 digits'
                    }), 400
                
                # Find hash_id for this game_pin
                hash_id = None
                for h_id, session in game_sessions.items():
                    if session.get('gamePin') == game_pin:
                        hash_id = h_id
                        break
                
                if not hash_id:
                    return jsonify({
                        'status': 'error',
                        'message': f'No active game found with PIN {game_pin}'
                    }), 404
                
                # Check for existing player with same name in this game (Rejoin logic)
                existing_uid = None
                for uid, player in player_registry.items():
                    if player.get('hashId') == hash_id and player.get('nickname') == name:
                        existing_uid = uid
                        break
                
                if existing_uid:
                    # Player exists - check if connected
                    if player_registry[existing_uid].get('connected', False):
                        # Currently connected - reject (Name taken)
                        game.log(f'🚫 Rejected join attempt - name {name} already taken and connected')
                        return jsonify({
                            'status': 'error',
                            'message': f'The name "{name}" is already in use.'
                        }), 409
                    else:
                        # Disconnected - Allow REJOIN (Recover session)
                        game.log(f'♻️ Player {name} rejoining with existing UID: {existing_uid}')
                        
                        # Use existing UID
                        uid = existing_uid
                        
                        # Update status
                        player_registry[uid]['connected'] = True
                        player_registry[uid]['reconnectedAt'] = time.time()
                        
                        # If icon changed, update it
                        if icon:
                            player_registry[uid]['icon'] = icon
                        
                        # Send ADD event to add-in (to ensure they are restored in UI/logic)
                        participant_data = {
                            'nick': name,
                            'icon': player_registry[uid].get('icon', '👤'),
                            'type': 'add',
                            'user_id': uid,
                            'timestamp': time.time()
                        }
                        
                        sent = emit_to_room('participant_update', participant_data, hash_id)
                        game.log(f'✅ Player rejoined, participant_update sent to {sent} client(s)')
                        
                        return jsonify({
                            'status': 'success',
                            'uid': uid,
                            'message': 'Rejoined successfully'
                        })

                # Check if game is active
                if not check_game_active(hash_id):

                    game.log(f'🚫 Rejected join attempt - game {hash_id} is closed')
                    return jsonify({
                        'status': 'warning',
                        'message': 'This game has been closed. Please ask the teacher to start a new game.',
                        'game_closed': True
                    }), 403
                
                # Check if session is accepting participants
                session = game_sessions[hash_id]
                if not session.get('acceptingParticipants', False):
                    game.log(f'🚫 Rejected join attempt - session {hash_id} not accepting participants')
                    return jsonify({
                        'status': 'error',
                        'message': 'Game is not accepting participants yet. Please wait for the game to start.'
                    }), 403
                
                # Generate unique user ID (uid)
                import uuid
                uid = str(uuid.uuid4())
                
                # Register player in player registry
                player_registry[uid] = {
                    'nickname': name,
                    'icon': icon,
                    'hashId': hash_id,
                    'gamePin': game_pin,
                    'connected': True,
                    'joinedAt': time.time()
                }
                
                game.log(f'👥 Player joining: {name} (UID: {uid}) to game PIN: {game_pin} (hash: {hash_id})')
                game.log(f'💾 Registered player in registry: {player_registry[uid]}')
                
                # Send participant update to add-ins in this specific game room
                participant_data = {
                    'nick': name,
                    'icon': icon,
                    'type': 'add',
                    'user_id': uid,
                    'timestamp': time.time()
                }
                
                sent = emit_to_room('participant_update', participant_data, hash_id)
                
                game.log(f'✅ Player joined, participant_update sent to {sent} client(s)')
                
                return jsonify({
                    'status': 'success',
                    'uid': uid
                })
                
            except Exception as e:
                game.log(f'❌ Error in join_player: {str(e)}')
                import traceback
                traceback.print_exc()
                return jsonify({
                    'status': 'error',
                    'message': str(e)
                }), 500
        
        elif action == 'leave_player':
            # Player disconnects (mark as disconnected but don't delete)
            # Note: WebSocket disconnect also triggers this automatically
            # This endpoint allows explicit disconnect via REST API
            try:
                # Try to get UID from query param first, then from header
                uid = request.args.get('uid', '').strip() or request.headers.get('access_token', '').strip()
                
                if not uid:
                    return jsonify({
                        'status': 'error',
                        'message': 'Missing uid parameter or access_token header'
                    }), 400
                
                # Check if player exists in registry
                if uid not in player_registry:
                    game.log(f'⚠️ Player UID {uid} not found in registry')
                    return jsonify({
                        'status': 'error',
                        'message': 'Player not found'
                    }), 404
                
                player = player_registry[uid]
                player_name = player['nickname']
                hash_id = player['hashId']
                
                game.log(f'👋 Player disconnecting: {player_name} (UID: {uid})')
                
                # Check if we are in Lobby (acceptingParticipants=True)
                # If so, remove player permanently so they can join fresh
                should_remove_permanently = False
                if hash_id in game_sessions and game_sessions[hash_id].get('acceptingParticipants', False):
                    should_remove_permanently = True
                
                if should_remove_permanently:
                    # Remove from registry
                    del player_registry[uid]
                    game.log(f'🗑️ Removed player {player_name} from registry (Lobby disconnect)')
                    
                    # Notify add-in to remove from screen
                    emit_to_room('participant_update', {
                        'nick': player_name,
                        'type': 'remove',
                        'user_id': uid,
                        'timestamp': time.time()
                    }, hash_id)
                    
                    return jsonify({
                        'status': 'success',
                        'message': 'Player removed permanently (Lobby)',
                        'removed': True
                    })
                else:
                    # Mark as disconnected (but keep in registry)
                    player_registry[uid]['connected'] = False
                    player_registry[uid]['disconnectedAt'] = time.time()
                    
                    game.log(f'📝 Player {player_name} marked as disconnected (can reconnect)')
                    
                    # NOTE: We do NOT send participant_update here!
                    # Reason: Player can reconnect during gameplay, add-in should keep waiting
                    # for the original number of participants
                    
                    return jsonify({
                        'status': 'success',
                        'message': 'Player disconnected (can reconnect)',
                        'removed': False
                    })
                
            except Exception as e:
                game.log(f'❌ Error in leave_player: {str(e)}')
                import traceback
                traceback.print_exc()
                return jsonify({
                    'status': 'error',
                    'message': str(e)
                }), 500
        
        elif action == 'register_session':
            # Admin registers a new game session
            try:
                hash_id = request.args.get('hash_id')
                game_pin = request.args.get('game_pin')
                
                if not hash_id or not game_pin:
                    return jsonify({
                        'status': 'error',
                        'message': 'Missing hash_id or game_pin'
                    }), 400
                
                # Validate and sanitize hash_id
                import re
                hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
                game_pin = re.sub(r'[^0-9]', '', game_pin)
                
                if len(hash_id) < 8 or len(hash_id) > 20:
                    return jsonify({
                        'status': 'error',
                        'message': 'Invalid hash_id length'
                    }), 400
                
                if len(game_pin) != 6:
                    return jsonify({
                        'status': 'error',
                        'message': 'Game PIN must be 6 digits'
                    }), 400
                
                # Clean up previous game session if exists
                if hash_id in game_sessions:
                    game.log(f'🧹 Cleaning up previous game session: {hash_id}')
                    
                    # Close properly to notify existing players
                    close_game_and_cleanup(hash_id, reason='new_session')
                
                # Store session
                game_sessions[hash_id] = {
                    'gamePin': game_pin,
                    'timestamp': time.time(),
                    'active': True,
                    'acceptingParticipants': False  # Initially not accepting
                }
                
                # Schedule auto-close after 1 hour
                schedule_game_timeout(hash_id)
                
                game.log(f'✅ Session registered: hash={hash_id}, PIN={game_pin}')
                game.log(f'📊 Current client_rooms: {client_rooms}')
                
                # Notify add-in in this game room
                clients_in_room = sum(1 for h in client_rooms.values() if h == hash_id)
                game.log(f'🔍 Clients in room {hash_id}: {clients_in_room}')
                
                sent = emit_to_room('game_pin_registered', {
                    'gamePin': game_pin,
                    'hashId': hash_id,
                    'timestamp': time.time()
                }, hash_id)
                
                game.log(f'✅ Session registered, sent game_pin_registered to {sent} client(s)')
                
                # Also reset presentation to first slide (integrated logic)
                game.log(f'📍 Resetting to first slide for game: {hash_id}')
                
                reset_command = {
                    'action': 'go_to_first_slide',
                    'timestamp': time.time(),
                    'hashId': hash_id
                }
                
                reset_sent = emit_to_room('slide_navigation', reset_command, hash_id)
                
                return jsonify({
                    'status': 'success',
                    'message': 'Session registered successfully',
                    'hashId': hash_id,
                    'gamePin': game_pin,
                    'resetSent': reset_sent > 0
                })
                
            except Exception as e:
                game.log(f'❌ Error in register_session: {str(e)}')
                return jsonify({
                    'status': 'error',
                    'message': str(e)
                }), 500
        
        elif action == 'start_accepting_participants':
            # Start accepting participants for a game session
            try:
                hash_id = request.args.get('hash_id')
                
                if not hash_id:
                    return jsonify({
                        'status': 'error',
                        'message': 'Missing hash_id'
                    }), 400
                
                if not check_game_active(hash_id):
                    return jsonify({
                        'status': 'warning',
                        'message': 'Game session is not active or does not exist',
                        'game_closed': True
                    }), 403
                
                # Enable participant acceptance
                game_sessions[hash_id]['acceptingParticipants'] = True
                game.log(f'✅ Started accepting participants for session {hash_id}')
                
                return jsonify({
                    'status': 'success',
                    'message': 'Now accepting participants',
                    'hashId': hash_id
                })
                
            except Exception as e:
                game.log(f'❌ Error in start_accepting_participants: {str(e)}')
                return jsonify({
                    'status': 'error',
                    'message': str(e)
                }), 500
        
        elif action == 'stop_accepting_participants':
            # Stop accepting participants for a game session
            try:
                hash_id = request.args.get('hash_id')
                
                if not hash_id:
                    return jsonify({
                        'status': 'error',
                        'message': 'Missing hash_id'
                    }), 400
                
                if not check_game_active(hash_id):
                    return jsonify({
                        'status': 'warning',
                        'message': 'Game session is not active or does not exist',
                        'game_closed': True
                    }), 403
                
                # Disable participant acceptance
                game_sessions[hash_id]['acceptingParticipants'] = False
                game.log(f'🛑 Stopped accepting participants for session {hash_id}')
                
                return jsonify({
                    'status': 'success',
                    'message': 'Stopped accepting participants',
                    'hashId': hash_id
                })
                
            except Exception as e:
                game.log(f'❌ Error in stop_accepting_participants: {str(e)}')
                return jsonify({
                    'status': 'error',
                    'message': str(e)
                }), 500
        
        elif action == 'next_page' or action == 'next_slide':
            try:
                # Get hash_id from request (sent by admin)
                hash_id = request.args.get('hash_id')
                
                if not hash_id:
                    game.log('⚠️ Next slide request without hash_id - broadcasting to all')
                    # Fallback: broadcast to all if no hash_id (for backwards compatibility)
                    slide_command = {
                        'action': 'go_to_next_slide',
                        'timestamp': time.time()
                    }
                    socketio.emit('slide_navigation', slide_command)
                    
                    return jsonify({
                        'status': 'success',
                        'message': 'Next slide command sent to all clients',
                        'action': 'go_to_next_slide'
                    })
                
                # Validate and sanitize hash_id
                import re
                hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
                
                if len(hash_id) < 8 or len(hash_id) > 20:
                    return jsonify({
                        'status': 'error',
                        'message': 'Invalid hash ID length'
                    }), 400
                
                # Check if game is active
                if not check_game_active(hash_id):
                    game.log(f'⚠️ Next slide request for inactive game {hash_id}')
                    return jsonify({
                        'status': 'warning',
                        'message': 'Game session is not active or has been closed',
                        'game_closed': True
                    }), 200
                
                # Send WebSocket message ONLY to add-ins in this specific game room
                slide_command = {
                    'action': 'go_to_next_slide',
                    'timestamp': time.time(),
                    'hashId': hash_id
                }
                
                # Use emit_to_room to send only to clients in this game
                sent_count = emit_to_room('slide_navigation', slide_command, hash_id)
                
                if sent_count > 0:
                    game.log(f'✅ Next slide command sent to {sent_count} client(s) in game {hash_id}')
                    return jsonify({
                        'status': 'success',
                        'message': f'Next slide command sent to {sent_count} client(s) in game {hash_id}',
                        'action': 'go_to_next_slide',
                        'hashId': hash_id,
                        'clientsNotified': sent_count
                    })
                else:
                    game.log(f'⚠️ No clients found in game {hash_id}')
                    return jsonify({
                        'status': 'warning',
                        'message': f'No clients connected to game {hash_id}',
                        'hashId': hash_id
                    }), 404
                    
            except Exception as e:
                game.log(f'❌ Error in next_slide: {str(e)}')
                return jsonify({'status': 'error', 'message': str(e)}), 400
        
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
            # Legacy timer start - no longer supported
            return jsonify({
                'status': 'error',
                'message': 'Legacy timer endpoint is no longer supported. Use participant_update events instead.'
            }), 410  # 410 Gone
        
        elif action == 'stop':
            # Legacy timer stop - no longer supported
            return jsonify({
                'status': 'error',
                'message': 'Legacy timer endpoint is no longer supported.'
            }), 410  # 410 Gone
        
        elif action == 'click_action':
            try:
                game.log('Spacebar simulation request received')
                
                # Send WebSocket message to add-in to simulate spacebar press
                spacebar_command = {
                    'action': 'simulate_click',
                    'timestamp': time.time()
                }
                
                # Broadcast spacebar command to all connected clients (including add-in)
                socketio.emit('click_navigation', spacebar_command)
                
                game.log('Spacebar simulation command sent to add-in via WebSocket')
                
                return jsonify({
                    'status': 'success',
                    'message': 'Spacebar simulation command sent to add-in',
                    'action': 'simulate_click'
                })
                
            except Exception as e:
                game.log(f'Error in click_action endpoint: {str(e)}')
                return jsonify({
                    'status': 'error',
                    'message': f'Server error in click_action: {str(e)}'
                }), 500
        
        elif action == 'reset_animations':
            try:
                game.log('Reset animations request received')
                
                # Send WebSocket message to add-in to reset animation state
                reset_command = {
                    'action': 'reset_animations',
                    'timestamp': time.time()
                }
                
                # Broadcast reset command to all connected clients (including add-in)
                socketio.emit('animation_reset', reset_command)
                
                game.log('Animation reset command sent to add-in via WebSocket')
                
                return jsonify({
                    'status': 'success',
                    'message': 'Animation reset command sent to add-in',
                    'action': 'reset_animations'
                })
                
            except Exception as e:
                game.log(f'Error in reset_animations endpoint: {str(e)}')
                return jsonify({
                    'status': 'error',
                    'message': f'Server error in reset_animations: {str(e)}'
                }), 500
        
        elif action == 'check_active_game':
            # Check if an active game exists for the given hash_id
            try:
                hash_id = request.args.get('hash_id')
                
                if not hash_id:
                    return jsonify({
                        'status': 'error',
                        'message': 'Missing hash_id'
                    }), 400
                
                # Validate and sanitize hash_id
                import re
                hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
                
                if len(hash_id) < 8 or len(hash_id) > 20:
                    return jsonify({
                        'status': 'error',
                        'message': 'Invalid hash ID length'
                    }), 400
                
                # Check if session exists and is active
                if hash_id in game_sessions and game_sessions[hash_id].get('active', False):
                    session = game_sessions[hash_id]
                    game.log(f'✅ Active game found for hash {hash_id}')
                    
                    return jsonify({
                        'status': 'success',
                        'active': True,
                        'gamePin': session.get('gamePin'),
                        'timestamp': session.get('timestamp'),
                        'hashId': hash_id
                    })
                else:
                    game.log(f'❌ No active game found for hash {hash_id}')
                    return jsonify({
                        'status': 'success',
                        'active': False,
                        'hashId': hash_id
                    })
                    
            except Exception as e:
                game.log(f'❌ Error in check_active_game: {str(e)}')
                return jsonify({
                    'status': 'error',
                    'message': str(e)
                }), 500
        
        elif action == 'close_game':
            # Close an active game session and clean up all players
            try:
                hash_id = request.args.get('hash_id')
                
                if not hash_id:
                    return jsonify({
                        'status': 'error',
                        'message': 'Missing hash_id'
                    }), 400
                
                # Validate and sanitize hash_id
                import re
                hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
                
                if len(hash_id) < 8 or len(hash_id) > 20:
                    return jsonify({
                        'status': 'error',
                        'message': 'Invalid hash ID length'
                    }), 400
                
                # Check if session exists
                if hash_id not in game_sessions:
                    game.log(f'⚠️ Cannot close game - session {hash_id} not found')
                    return jsonify({
                        'status': 'error',
                        'message': 'Game session not found'
                    }), 404
                
                # Use centralized cleanup function
                close_game_and_cleanup(hash_id, reason='manual')
                
                return jsonify({
                    'status': 'success',
                    'message': 'Game closed successfully and all players removed',
                    'hashId': hash_id
                })
                
            except Exception as e:
                game.log(f'❌ Error in close_game: {str(e)}')
                return jsonify({
                    'status': 'error',
                    'message': str(e)
                }), 500
    
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
    print("  /?next_page     - Next slide (also /?next_slide)")
    print("  /?click_action  - Simulate spacebar press (animations/next slide)")
    print("  /?get_users     - Get user count")
    print("  /?get_time      - Get time remaining")
    print("  /?status        - Get full status")
    print("  /?reset         - Reset game")
    print("  /?start[&time=X] - Start timer (default 30s)")
    print("  /?stop          - Stop timer")
    print("  /save           - Save presentation data by Window ID (POST)")
    print("  /load           - Load presentation data by Window ID (POST)")
    print("")
    print("WebSocket Events (sent to add-in):")
    print("  participant_update - Individual participant add/remove (→ add-in)")
    print("  player_answer   - Player answer submission (→ add-in)")
    print("  player_results  - Question results (→ sim)")
    print("  slide_navigation - Next slide navigation commands (→ add-in)")
    print("  click_navigation - Click simulation commands (→ add-in)")
    print("  game_closed     - Game closed notification (→ all in room)")
    print("")
    print("Press Ctrl+C to stop the server")
    print("=" * 40)
    
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)

