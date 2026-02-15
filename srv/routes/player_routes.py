"""
Player routes for Kahoot Quiz Server.
Handles player join, leave, rejoin, and answer submission.
Uses gamePin as primary identifier for all room operations.
"""

import re
import time
import uuid
from flask import Blueprint, request, jsonify

from utils.room_utils import emit_to_room, check_game_active


def create_player_routes(socketio, game, game_sessions, player_registry, client_rooms, socket_to_player):
    """
    Create player routes blueprint.
    
    Args:
        socketio: Flask-SocketIO instance
        game: GameManager instance
        game_sessions: Dict of active game sessions (keyed by gamePin)
        player_registry: Dict of registered players
        client_rooms: Dict mapping socket ID to gamePin
        socket_to_player: Dict mapping socket ID to player UID
    
    Returns:
        Blueprint with player routes
    """
    player_bp = Blueprint('player', __name__)

    @player_bp.route('/rejoin_player', methods=['POST'])
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
            
            # Get userId, gamePin and optional socketId from data
            user_id = data.get('userId')
            game_pin = data.get('gamePin', '').strip()
            socket_id = data.get('socketId', '').strip()  # Optional: for registering socket to room
            
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
            player_game_pin = player['gamePin']
            
            # Verify game is still active
            if player_game_pin not in game_sessions or not game_sessions[player_game_pin].get('active', False):
                game.log(f'❌ Game {player_game_pin} is not active')
                return jsonify({
                    'status': 'error',
                    'message': 'Game is no longer active'
                }), 404
            
            # Verify game PIN matches player's game
            if player_game_pin != game_pin:
                game.log(f'❌ Game PIN mismatch for {player_name}')
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid game PIN'
                }), 403
            
            # Reconnect the player
            player_registry[user_id]['connected'] = True
            player_registry[user_id]['reconnectedAt'] = time.time()
            
            game.log(f'✅ Player {player_name} (UID: {user_id}) reconnected to game {game_pin}')
            
            session = game_sessions[player_game_pin]
            
            # Always send add update on rejoin to ensure add-in has the player
            emit_to_room(socketio, client_rooms, game.logger, 'participant_update', {
                'nick': player_name,
                'icon': player.get('icon', '👤'),
                'type': 'add',
                'user_id': user_id,
                'timestamp': time.time()
            }, game_pin)
            
            game.log(f'📢 Sent add update for reconnected player {player_name}')
            
            # Check current game state and send appropriate status
            game_state = session.get('currentState', 'waiting')
            
            response_data = {
                'status': 'success',
                'message': 'Reconnected successfully',
                'userId': user_id,
                'nickname': player_name,
                'gamePin': game_pin,
                'gameState': game_state
            }
            
            # If in answer time, include sync data in response
            if game_state == 'answering' and 'currentQuestion' in session:
                response_data['needsSync'] = True
                response_data['syncData'] = session['currentQuestion']
            
            # If socketId provided, register socket to room (room = gamePin)
            if socket_id:
                socketio.server.enter_room(socket_id, game_pin, namespace='/')
                client_rooms[socket_id] = game_pin
                # Link socket to player for disconnect handling
                socket_to_player[socket_id] = user_id
                game.log(f'🔗 Registered socket {socket_id} to room {game_pin} and linked to player {user_id}')
            
            return jsonify(response_data)
            
        except Exception as e:
            game.log(f'❌ Error handling player rejoin: {e}')
            import traceback
            traceback.print_exc()
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @player_bp.route('/submit_answer', methods=['POST'])
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
            
            # Get userId from data - REQUIRED
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
            
            # Get gamePin from player registry
            game_pin = player['gamePin']
            
            game.log(f'✅ Answer from {player["nickname"]} (UID: {user_id}) in game {game_pin}')
            
            # Broadcast answer to add-in in this game room via WebSocket
            emit_to_room(socketio, client_rooms, game.logger, 'player_answer', data, game_pin)
            
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

    def handle_join_player():
        """Handle player join - called from main API handler"""
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
            socket_id = data.get('socketId', '').strip()  # Optional: for registering socket to room
            
            if not game_pin or not name:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing game_pin or name'
                }), 400
            
            # Sanitize inputs
            game_pin = re.sub(r'[^0-9]', '', game_pin)
            
            if len(game_pin) != 6:
                return jsonify({
                    'status': 'error',
                    'message': 'Game PIN must be 6 digits'
                }), 400
            
            # Check if game exists with this gamePin (direct lookup)
            if game_pin not in game_sessions:
                return jsonify({
                    'status': 'error',
                    'message': f'No active game found with PIN {game_pin}'
                }), 404
            
            # Check for existing player with same name in this game (Rejoin logic)
            existing_uid = None
            for uid, player in player_registry.items():
                if player.get('gamePin') == game_pin and player.get('nickname') == name:
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
                    
                    uid = existing_uid
                    
                    # Update status
                    player_registry[uid]['connected'] = True
                    player_registry[uid]['reconnectedAt'] = time.time()
                    
                    # If icon changed, update it
                    if icon:
                        player_registry[uid]['icon'] = icon
                    
                    # Send ADD event to add-in
                    participant_data = {
                        'nick': name,
                        'icon': player_registry[uid].get('icon', '👤'),
                        'type': 'add',
                        'user_id': uid,
                        'timestamp': time.time()
                    }
                    
                    sent = emit_to_room(socketio, client_rooms, game.logger, 'participant_update', participant_data, game_pin)
                    game.log(f'✅ Player rejoined, participant_update sent to {sent} client(s)')
                    
                    # If socketId provided, register socket to room (room = gamePin)
                    if socket_id:
                        socketio.server.enter_room(socket_id, game_pin, namespace='/')
                        client_rooms[socket_id] = game_pin
                        # Link socket to player for disconnect handling
                        socket_to_player[socket_id] = uid
                        game.log(f'🔗 Registered socket {socket_id} to room {game_pin} and linked to player {uid}')
                    
                    return jsonify({
                        'status': 'success',
                        'uid': uid,
                        'gamePin': game_pin,
                        'message': 'Rejoined successfully'
                    })

            # Check if game is active
            if not check_game_active(game_sessions, game_pin):
                game.log(f'🚫 Rejected join attempt - game {game_pin} is closed')
                return jsonify({
                    'status': 'warning',
                    'message': 'This game has been closed. Please ask the teacher to start a new game.',
                    'game_closed': True
                }), 403
            
            # Generate unique user ID (uid)
            uid = str(uuid.uuid4())
            
            # Register player in player registry (gamePin is primary identifier)
            player_registry[uid] = {
                'nickname': name,
                'icon': icon,
                'gamePin': game_pin,
                'connected': True,
                'joinedAt': time.time()
            }
            
            game.log(f'👥 Player joining: {name} (UID: {uid}) to game PIN: {game_pin}')
            game.log(f'💾 Registered player in registry: {player_registry[uid]}')
            
            # Send participant update to add-ins in this specific game room
            participant_data = {
                'nick': name,
                'icon': icon,
                'type': 'add',
                'user_id': uid,
                'timestamp': time.time()
            }
            
            sent = emit_to_room(socketio, client_rooms, game.logger, 'participant_update', participant_data, game_pin)
            
            game.log(f'✅ Player joined, participant_update sent to {sent} client(s)')
            
            # If socketId provided, register socket to room (room = gamePin)
            if socket_id:
                socketio.server.enter_room(socket_id, game_pin, namespace='/')
                client_rooms[socket_id] = game_pin
                # Link socket to player for disconnect handling
                socket_to_player[socket_id] = uid
                game.log(f'🔗 Registered socket {socket_id} to room {game_pin} and linked to player {uid}')
            
            return jsonify({
                'status': 'success',
                'uid': uid,
                'gamePin': game_pin
            })
            
        except Exception as e:
            game.log(f'❌ Error in join_player: {str(e)}')
            import traceback
            traceback.print_exc()
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    def handle_leave_player():
        """Handle player leave - called from main API handler"""
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
            game_pin = player['gamePin']
            
            game.log(f'👋 Player disconnecting: {player_name} (UID: {uid})')
            
            # Remove from registry
            del player_registry[uid]
            game.log(f'🗑️ Removed player {player_name} from registry')

            # Notify add-in to remove from screen
            if game_pin in game_sessions:
                emit_to_room(socketio, client_rooms, game.logger, 'participant_update', {
                    'nick': player_name,
                    'type': 'remove',
                    'user_id': uid,
                    'timestamp': time.time()
                }, game_pin)

            return jsonify({
                'status': 'success',
                'message': 'Player removed',
                'removed': True
            })
            
        except Exception as e:
            game.log(f'❌ Error in leave_player: {str(e)}')
            import traceback
            traceback.print_exc()
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    # Attach handlers to blueprint for access from main API handler
    player_bp.handle_join_player = handle_join_player
    player_bp.handle_leave_player = handle_leave_player

    return player_bp
