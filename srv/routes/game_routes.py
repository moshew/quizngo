"""
Game management routes for QuizNGO Quiz Server.
Handles session registration, game lifecycle, and participant acceptance.

NEW ARCHITECTURE:
- gamePin is the PRIMARY identifier (6 digits, generated in Add-in)
- hashId is REMOVED from the system
- WebSocket connects only when game starts, disconnects when game ends
- 30-second reconnection timeout (handled client-side)
"""

import re
import time
from flask import Blueprint, request, jsonify

from utils.room_utils import emit_to_room, check_game_active, close_game_and_cleanup, schedule_game_timeout


# Auto-close policy:
# - Room waiting for admin start: 5 minutes
# - Active started game with guardian: 1 hour
# - Active started game without guardian: 10 minutes
WAITING_ROOM_TIMEOUT_SECONDS = 300
STARTED_GAME_TIMEOUT_SECONDS = 3600
GUARDIAN_LESS_TIMEOUT_SECONDS = 600


def create_game_routes(
    socketio,
    game,
    game_sessions,
    player_registry,
    client_rooms,
    socket_to_player,
    game_timeout_controls=None
):
    """
    Create game management routes blueprint.
    
    Args:
        socketio: Flask-SocketIO instance
        game: GameManager instance
        game_sessions: Dict of active game sessions (keyed by gamePin)
        player_registry: Dict of registered players
        client_rooms: Dict mapping socket ID to gamePin
        socket_to_player: Dict mapping socket ID to player UID
    
    Returns:
        Blueprint with game routes
    """
    game_bp = Blueprint('game', __name__)

    @game_bp.route('/answer_time_started', methods=['POST'])
    def answer_time_started():
        """Handle answer time started via REST API."""
        try:
            data = request.get_json()
            game_pin = data.get('gamePin', 'N/A')
            
            game.log(f'📨 POST /answer_time_started - gamePin: {game_pin}')
            
            if game_pin and game_pin != 'N/A':
                # Update session state
                if game_pin in game_sessions:
                    game_sessions[game_pin]['currentState'] = 'answering'
                    game_sessions[game_pin]['currentQuestion'] = data
                    game_sessions[game_pin]['answerStartedAt'] = time.time()
                    game.log(f'💾 Saved current question state for game {game_pin}')
                
                # Find all players in this game
                players_in_game = [
                    (uid, player) for uid, player in player_registry.items() 
                    if player.get('gamePin') == game_pin and player.get('connected', False)
                ]
                
                if not players_in_game:
                    game.log(f'⚠️ No connected players found in game {game_pin}')
                    return jsonify({
                        'status': 'warning',
                        'message': 'No connected players in game',
                        'gamePin': game_pin
                    })
                
                # Send to each player via room broadcast
                sent_count = emit_to_room(socketio, client_rooms, game.logger, 'answer_time_started', data, game_pin)
                
                game.log(f'✅ Sent answer_time_started to {len(players_in_game)} player(s) in game {game_pin}')
                
                return jsonify({
                    'status': 'success',
                    'message': f'Sent to {len(players_in_game)} player(s)',
                    'gamePin': game_pin,
                    'playerCount': len(players_in_game)
                })
            else:
                game.log(f'⚠️ Warning: No gamePin for answer_time_started')
                return jsonify({
                    'status': 'error',
                    'message': 'Missing gamePin'
                }), 400
            
        except Exception as e:
            game.log(f'❌ Error handling answer_time_started: {e}')
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @game_bp.route('/submit_results', methods=['POST'])
    def submit_results():
        """Receive question results from add-in and broadcast to each player."""
        try:
            data = request.get_json()
            
            game.log(f'📨 POST /submit_results')
            
            if not data:
                game.log('❌ No JSON data received')
                return jsonify({
                    'status': 'error',
                    'message': 'No JSON data provided'
                }), 400
            
            game_pin = data.get('gamePin')
            results = data.get('results', [])
            
            game.log(f'   gamePin: {game_pin}, results: {len(results)} players')
            
            # Clear current question state (answer time ended)
            if game_pin in game_sessions:
                game_sessions[game_pin]['currentState'] = 'results'
                if 'currentQuestion' in game_sessions[game_pin]:
                    del game_sessions[game_pin]['currentQuestion']
                if 'answerStartedAt' in game_sessions[game_pin]:
                    del game_sessions[game_pin]['answerStartedAt']
                game.log(f'💾 Cleared current question state for game {game_pin}')
            
            if not game_pin:
                game.log('❌ Missing gamePin in request')
                return jsonify({
                    'status': 'error',
                    'message': 'Missing gamePin'
                }), 400
            
            if not results:
                game.log('❌ Missing or empty results in request')
                return jsonify({
                    'status': 'error',
                    'message': 'Missing or empty results'
                }), 400

            # Build once per request: O(number_of_sockets).
            # Prevents O(results * sockets) scans under heavy load.
            sid_by_uid = {uid: sid for sid, uid in socket_to_player.items()}
            
            # Send individual results to each player's own socket (not broadcast)
            for result in results:
                user_id = result.get('userId')
                
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
                
                # Resolve socket in O(1) from prebuilt mapping.
                target_sid = sid_by_uid.get(user_id)
                
                if target_sid:
                    socketio.emit('player_results', player_data, to=target_sid)
                    game.log(f'   → {result.get("nickname")}: Rank #{result.get("rank")}, Score: {result.get("cumulativeScore")} (socket: {target_sid})')
                else:
                    game.log(f'   ⚠️ No socket found for {result.get("nickname")} (uid: {user_id}), skipping')
            
            game.log(f'✅ Results sent to {len(results)} player(s)')
            
            return jsonify({
                'status': 'success',
                'message': f'Results sent to {len(results)} player(s)',
                'gamePin': game_pin
            })
            
        except Exception as e:
            game.log(f'❌ Error handling submit_results: {e}')
            import traceback
            traceback.print_exc()
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @game_bp.route('/sim_gamePIN', methods=['GET'])
    def get_active_game_pins():
        """Get list of all game PINs (including those not started yet) for the simulator and LB cleanup"""
        try:
            all_pins = []

            # Return ALL sessions, including those with active=False (waiting for admin to start)
            # This prevents LB from cleaning up valid PINs that haven't been started yet
            for game_pin, session in game_sessions.items():
                all_pins.append({
                    'gamePin': game_pin,
                    'timestamp': session.get('timestamp'),
                    'active': session.get('active', False),
                    'gameStarted': session.get('gameStarted', False)
                })

            return jsonify({
                'status': 'success',
                'count': len(all_pins),
                'games': all_pins
            })
            
        except Exception as e:
            game.log(f'❌ Error getting active game PINs: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': f'Error: {str(e)}'
            }), 500

    def handle_register_session():
        """Handle session registration - called from main API handler.
        
        NEW: gamePin is the primary identifier. hashId is no longer used.
        The Add-in generates the gamePin and registers the session.
        """
        try:
            game_pin = request.args.get('game_pin')
            
            game.log(f'📨 POST /register_session - game_pin: {game_pin}')
            
            if not game_pin:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing game_pin'
                }), 400
            
            # Validate and sanitize
            game_pin = re.sub(r'[^0-9]', '', game_pin)
            
            if len(game_pin) != 6:
                return jsonify({
                    'status': 'error',
                    'message': 'Game PIN must be 6 digits'
                }), 400
            
            # Clean up previous game session if exists
            if game_pin in game_sessions:
                game.log(f'🧹 Cleaning up previous game session: {game_pin}')
                close_game_and_cleanup(
                    game_sessions, player_registry, client_rooms, socket_to_player,
                    socketio, game_pin, game.logger, reason='new_session',
                    game_timeout_controls=game_timeout_controls
                )
            
            # Store session with gamePin as the key
            game_sessions[game_pin] = {
                'gamePin': game_pin,
                'timestamp': time.time(),
                'active': True,
                'gameStarted': False
            }
            
            # Schedule auto-close while waiting for room creation/start.
            schedule_game_timeout(
                game_sessions, player_registry, client_rooms, socket_to_player,
                socketio, game_pin, game.logger,
                timeout_seconds=WAITING_ROOM_TIMEOUT_SECONDS,
                game_timeout_controls=game_timeout_controls
            )
            
            game.log(f'✅ Session registered: PIN={game_pin}')
            
            return jsonify({
                'status': 'success',
                'message': 'Session registered successfully',
                'gamePin': game_pin
            })
            
        except Exception as e:
            game.log(f'❌ Error in register_session: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    def handle_check_active_game():
        """Handle check active game - called from main API handler"""
        try:
            game_pin = request.args.get('game_pin')
            
            if not game_pin:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing game_pin'
                }), 400
            
            # Validate and sanitize game_pin
            game_pin = re.sub(r'[^0-9]', '', game_pin)
            
            if len(game_pin) != 6:
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid game PIN length'
                }), 400
            
            # Check if session exists
            # Returns active=true if session exists (admin needs this to connect)
            # The gameStarted field tells whether players can join
            if game_pin in game_sessions:
                session = game_sessions[game_pin]
                game.log(f'✅ Game session found for PIN {game_pin} (started: {session.get("gameStarted", False)})')
                
                return jsonify({
                    'status': 'success',
                    'active': True,
                    'gamePin': game_pin,
                    'timestamp': session.get('timestamp'),
                    'gameStarted': session.get('gameStarted', False),
                    'language': session.get('language', 'en')
                })
            else:
                game.log(f'ℹ️ No active game for PIN {game_pin}')
                return jsonify({
                    'status': 'success',
                    'active': False,
                    'gamePin': game_pin
                })
                
        except Exception as e:
            game.log(f'❌ Error in check_active_game: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @game_bp.route('/register_room', methods=['POST'])
    def register_room():
        """REST endpoint to register a socket to a room by gamePin (for add-in).
        
        This registers the socket to the room for receiving events.
        gamePin is the primary identifier.
        """
        try:
            data = request.get_json()
            socket_id = data.get('socketId')
            game_pin = data.get('gamePin')
            
            game.log(f'📨 POST /register_room - socketId: {socket_id}, gamePin: {game_pin}')
            
            if not socket_id or not game_pin:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing socketId or gamePin'
                }), 400
            
            # Join Socket.IO room using gamePin as room name
            socketio.server.enter_room(socket_id, game_pin, namespace='/')
            
            # Track in our mapping
            client_rooms[socket_id] = game_pin
            
            # Check if there's an active game session
            has_active_game = game_pin in game_sessions and game_sessions[game_pin].get('active', False)
            
            game.log(f'✅ Client {socket_id} joined room: {game_pin} via REST')
            game.log(f'   Active game: {has_active_game}')
            
            response_data = {
                'status': 'success',
                'gamePin': game_pin,
                'socketId': socket_id,
                'hasActiveGame': has_active_game
            }
            
            return jsonify(response_data)
            
        except Exception as e:
            game.log(f'❌ Error in register_room: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    def handle_close_game():
        """Handle close game - called from main API handler"""
        try:
            game_pin = request.args.get('game_pin')
            
            if not game_pin:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing game_pin'
                }), 400
            
            # Validate and sanitize game_pin
            game_pin = re.sub(r'[^0-9]', '', game_pin)
            
            if len(game_pin) != 6:
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid game PIN length'
                }), 400
            
            # Check if session exists
            if game_pin not in game_sessions:
                game.log(f'⚠️ Cannot close game - session {game_pin} not found')
                return jsonify({
                    'status': 'error',
                    'message': 'Game session not found'
                }), 404
            
            # Use centralized cleanup function
            close_game_and_cleanup(
                game_sessions, player_registry, client_rooms, socket_to_player,
                socketio, game_pin, game.logger, reason='manual',
                game_timeout_controls=game_timeout_controls
            )
            
            return jsonify({
                'status': 'success',
                'message': 'Game closed successfully and all players removed',
                'gamePin': game_pin
            })
            
        except Exception as e:
            game.log(f'❌ Error in close_game: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    def handle_create_room():
        """Create a room with a game PIN.

        This is called from the Add-in when "Activate Game" is clicked.
        Room is created but NOT active yet - players cannot join until Admin starts the game.
        """
        try:
            game_pin = request.args.get('game_pin')
            
            game.log(f'📨 GET /create_room - game_pin: {game_pin}')
            
            if not game_pin:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing game_pin'
                }), 400
            
            # Validate and sanitize
            game_pin = re.sub(r'[^0-9]', '', game_pin)
            
            if len(game_pin) != 6:
                return jsonify({
                    'status': 'error',
                    'message': 'Game PIN must be 6 digits'
                }), 400
            
            # Clean up previous game session if exists
            if game_pin in game_sessions:
                game.log(f'🧹 Cleaning up previous game session: {game_pin}')
                close_game_and_cleanup(
                    game_sessions, player_registry, client_rooms, socket_to_player,
                    socketio, game_pin, game.logger, reason='new_session',
                    game_timeout_controls=game_timeout_controls
                )
            
            # Get optional language parameter
            language = request.args.get('language', 'en')

            # Create room with gamePin as the key
            # Room is NOT active until admin clicks "Start Game"
            game_sessions[game_pin] = {
                'gamePin': game_pin,
                'timestamp': time.time(),
                'active': False,
                'gameStarted': False,
                'language': language
            }
            
            # Schedule auto-close after 5 minutes while waiting for admin to start.
            schedule_game_timeout(
                game_sessions, player_registry, client_rooms, socket_to_player,
                socketio, game_pin, game.logger,
                timeout_seconds=WAITING_ROOM_TIMEOUT_SECONDS,
                game_timeout_controls=game_timeout_controls
            )
            
            game.log(f'✅ Room created: PIN={game_pin} (waiting for admin to start game)')
            
            return jsonify({
                'status': 'success',
                'message': 'Room created successfully',
                'gamePin': game_pin,
                'gameStarted': False
            })
            
        except Exception as e:
            game.log(f'❌ Error in create_room: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    def handle_start_game():
        """Start the game - called from Admin when "Start Game" button is clicked.

        This performs:
        1. Marks the game as started
        2. Sends WebSocket event to Add-in to initialize game state
        """
        try:
            game_pin = request.args.get('game_pin')
            
            game.log(f'📨 GET /start_game - game_pin: {game_pin}')
            
            if not game_pin:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing game_pin'
                }), 400
            
            # Validate and sanitize
            game_pin = re.sub(r'[^0-9]', '', game_pin)
            
            if len(game_pin) != 6:
                return jsonify({
                    'status': 'error',
                    'message': 'Game PIN must be 6 digits'
                }), 400
            
            # Check if room exists
            if game_pin not in game_sessions:
                return jsonify({
                    'status': 'error',
                    'message': 'Room not found. Add-in must create room first.'
                }), 404
            
            session = game_sessions[game_pin]
            
            # Check if already started
            if session.get('gameStarted', False):
                return jsonify({
                    'status': 'warning',
                    'message': 'Game already started',
                    'gamePin': game_pin
                })
            
            # Mark game as started AND active (players can now join)
            session['gameStarted'] = True
            session['active'] = True
            session['startedAt'] = time.time()

            # Guardian socket is registered in client_rooms but not mapped in
            # socket_to_player (player sockets are mapped there).
            has_guardian = any(
                gpin == game_pin and sid not in socket_to_player
                for sid, gpin in client_rooms.items()
            )
            timeout_seconds = (
                STARTED_GAME_TIMEOUT_SECONDS
                if has_guardian
                else GUARDIAN_LESS_TIMEOUT_SECONDS
            )

            # Replace waiting-room timeout with guardian-aware started timeout.
            schedule_game_timeout(
                game_sessions, player_registry, client_rooms, socket_to_player,
                socketio, game_pin, game.logger,
                timeout_seconds=timeout_seconds,
                game_timeout_controls=game_timeout_controls
            )
            
            game.log(f'✅ Game started and activated: PIN={game_pin}')
            
            # Emit event to Add-in to initialize game state
            emit_to_room(socketio, client_rooms, game.logger, 'game_started', {
                'gamePin': game_pin,
                'action': 'initialize_game'
            }, game_pin)
            
            return jsonify({
                'status': 'success',
                'message': 'Game started successfully',
                'gamePin': game_pin
            })
            
        except Exception as e:
            game.log(f'❌ Error in start_game: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    # Attach handlers to blueprint for access from main API handler
    game_bp.handle_register_session = handle_register_session
    game_bp.handle_check_active_game = handle_check_active_game
    game_bp.handle_close_game = handle_close_game
    game_bp.handle_create_room = handle_create_room
    game_bp.handle_start_game = handle_start_game

    return game_bp
