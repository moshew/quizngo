"""
Game management routes for Kahoot Quiz Server.
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


def create_game_routes(socketio, game, game_sessions, player_registry, client_rooms, socket_to_player):
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
            
            # Broadcast individual results to each player
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
                
                emit_to_room(socketio, client_rooms, game.logger, 'player_results', player_data, game_pin)
                
                game.log(f'   → {result.get("nickname")}: Rank #{result.get("rank")}, Score: {result.get("cumulativeScore")}')
            
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
        """Get list of all active game PINs for the simulator"""
        try:
            active_pins = []
            
            for game_pin, session in game_sessions.items():
                if session.get('active', False):
                    active_pins.append({
                        'gamePin': game_pin,
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
                    socketio, game_pin, game.logger, reason='new_session'
                )
            
            # Store session with gamePin as the key
            game_sessions[game_pin] = {
                'gamePin': game_pin,
                'timestamp': time.time(),
                'active': True,
                'acceptingParticipants': False
            }
            
            # Schedule auto-close after 1 hour
            schedule_game_timeout(
                game_sessions, player_registry, client_rooms, socket_to_player,
                socketio, game_pin, game.logger
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

    def handle_start_accepting_participants():
        """Handle start accepting participants - called from main API handler"""
        try:
            game_pin = request.args.get('game_pin')
            
            if not game_pin:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing game_pin'
                }), 400
            
            if not check_game_active(game_sessions, game_pin):
                return jsonify({
                    'status': 'no_game',
                    'message': 'No active game session - waiting for game to start',
                    'game_closed': True
                }), 200  # Return 200 to avoid browser console error
            
            # Enable participant acceptance
            game_sessions[game_pin]['acceptingParticipants'] = True
            game.log(f'✅ Started accepting participants for game {game_pin}')
            
            return jsonify({
                'status': 'success',
                'message': 'Now accepting participants',
                'gamePin': game_pin
            })
            
        except Exception as e:
            game.log(f'❌ Error in start_accepting_participants: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    def handle_stop_accepting_participants():
        """Handle stop accepting participants - called from main API handler"""
        try:
            game_pin = request.args.get('game_pin')
            
            if not game_pin:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing game_pin'
                }), 400
            
            if not check_game_active(game_sessions, game_pin):
                return jsonify({
                    'status': 'warning',
                    'message': 'Game session is not active or does not exist',
                    'game_closed': True
                }), 403
            
            # Disable participant acceptance
            game_sessions[game_pin]['acceptingParticipants'] = False
            game.log(f'🛑 Stopped accepting participants for game {game_pin}')
            
            return jsonify({
                'status': 'success',
                'message': 'Stopped accepting participants',
                'gamePin': game_pin
            })
            
        except Exception as e:
            game.log(f'❌ Error in stop_accepting_participants: {str(e)}')
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
            
            # Check if session exists and is active
            if game_pin in game_sessions and game_sessions[game_pin].get('active', False):
                session = game_sessions[game_pin]
                game.log(f'✅ Active game found for PIN {game_pin}')
                
                return jsonify({
                    'status': 'success',
                    'active': True,
                    'gamePin': game_pin,
                    'timestamp': session.get('timestamp'),
                    'gameStarted': session.get('gameStarted', False)
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
                socketio, game_pin, game.logger, reason='manual'
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
        """Create a room with a game PIN but don't start accepting participants yet.
        
        This is called from the Add-in when "Activate Game" is clicked.
        The room is created but register_session and start_accepting_participants
        are NOT called - they will be called when Admin clicks "Start Game".
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
                    socketio, game_pin, game.logger, reason='new_session'
                )
            
            # Create room with gamePin as the key (but NOT accepting participants yet)
            game_sessions[game_pin] = {
                'gamePin': game_pin,
                'timestamp': time.time(),
                'active': True,
                'acceptingParticipants': False,  # NOT accepting until admin starts game
                'gameStarted': False  # Game not started until admin clicks "Start Game"
            }
            
            # Schedule auto-close after 1 hour
            schedule_game_timeout(
                game_sessions, player_registry, client_rooms, socket_to_player,
                socketio, game_pin, game.logger
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
        2. Starts accepting participants
        3. Sends WebSocket event to Add-in to initialize game state
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
            
            # Mark game as started (but NOT accepting participants yet - that happens on opening slide)
            session['gameStarted'] = True
            session['startedAt'] = time.time()
            # Note: acceptingParticipants stays False until Add-in reaches opening slide
            
            game.log(f'✅ Game started: PIN={game_pin}')
            
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
    game_bp.handle_start_accepting_participants = handle_start_accepting_participants
    game_bp.handle_stop_accepting_participants = handle_stop_accepting_participants
    game_bp.handle_check_active_game = handle_check_active_game
    game_bp.handle_close_game = handle_close_game
    game_bp.handle_create_room = handle_create_room
    game_bp.handle_start_game = handle_start_game

    return game_bp
