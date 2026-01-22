"""
Game management routes for Kahoot Quiz Server.
Handles session registration, game lifecycle, and participant acceptance.
"""

import re
import time
from flask import Blueprint, request, jsonify

from utils.room_utils import emit_to_room, check_game_active, close_game_and_cleanup, schedule_game_timeout


def create_game_routes(socketio, game, game_sessions, player_registry, client_rooms, socket_to_player, data_dir=None):
    """
    Create game management routes blueprint.
    
    Args:
        socketio: Flask-SocketIO instance
        game: GameManager instance
        game_sessions: Dict of active game sessions
        player_registry: Dict of registered players
        client_rooms: Dict mapping socket ID to hash ID
        socket_to_player: Dict mapping socket ID to player UID
        data_dir: Path to data directory for saved presentations
    
    Returns:
        Blueprint with game routes
    """
    game_bp = Blueprint('game', __name__)

    @game_bp.route('/answer_time_started', methods=['POST'])
    def answer_time_started():
        """Handle answer time started via REST API."""
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
                
                # Send to each player via room broadcast
                sent_count = emit_to_room(socketio, client_rooms, game.logger, 'answer_time_started', data, hash_id)
                
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
                
                emit_to_room(socketio, client_rooms, game.logger, 'player_results', player_data, hash_id)
                
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

    @game_bp.route('/sim_gamePIN', methods=['GET'])
    def get_active_game_pins():
        """Get list of all active game PINs for the simulator"""
        try:
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

    def handle_register_session():
        """Handle session registration - called from main API handler"""
        try:
            hash_id = request.args.get('hash_id')
            game_pin = request.args.get('game_pin')
            
            game.log(f'📨 POST /register_session - hash_id: {hash_id}, game_pin: {game_pin}')
            
            if not hash_id or not game_pin:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing hash_id or game_pin'
                }), 400
            
            # Validate and sanitize
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
                close_game_and_cleanup(
                    game_sessions, player_registry, client_rooms, socket_to_player,
                    socketio, hash_id, game.logger, reason='new_session'
                )
            
            # Store session
            game_sessions[hash_id] = {
                'gamePin': game_pin,
                'timestamp': time.time(),
                'active': True,
                'acceptingParticipants': False
            }
            
            # Schedule auto-close after 1 hour
            schedule_game_timeout(
                game_sessions, player_registry, client_rooms, socket_to_player,
                socketio, hash_id, game.logger
            )
            
            game.log(f'✅ Session registered: hash={hash_id}, PIN={game_pin}')
            game.log(f'📊 Current client_rooms: {client_rooms}')
            
            # Notify add-in in this game room
            clients_in_room = sum(1 for h in client_rooms.values() if h == hash_id)
            game.log(f'🔍 Clients in room {hash_id}: {clients_in_room}')
            
            sent = emit_to_room(socketio, client_rooms, game.logger, 'game_pin_registered', {
                'gamePin': game_pin,
                'hashId': hash_id,
                'timestamp': time.time()
            }, hash_id)
            
            game.log(f'✅ Session registered, sent game_pin_registered to {sent} client(s)')
            
            # Also reset presentation to first slide
            game.log(f'📍 Resetting to first slide for game: {hash_id}')
            
            reset_command = {
                'action': 'go_to_first_slide',
                'timestamp': time.time(),
                'hashId': hash_id
            }
            
            reset_sent = emit_to_room(socketio, client_rooms, game.logger, 'slide_navigation', reset_command, hash_id)
            
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

    def handle_start_accepting_participants():
        """Handle start accepting participants - called from main API handler"""
        try:
            hash_id = request.args.get('hash_id')
            
            if not hash_id:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing hash_id'
                }), 400
            
            if not check_game_active(game_sessions, hash_id):
                return jsonify({
                    'status': 'no_game',
                    'message': 'No active game session - waiting for game to start',
                    'game_closed': True
                }), 200  # Return 200 to avoid browser console error
            
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

    def handle_stop_accepting_participants():
        """Handle stop accepting participants - called from main API handler"""
        try:
            hash_id = request.args.get('hash_id')
            
            if not hash_id:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing hash_id'
                }), 400
            
            if not check_game_active(game_sessions, hash_id):
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

    def handle_check_active_game():
        """Handle check active game - called from main API handler"""
        try:
            hash_id = request.args.get('hash_id')
            
            if not hash_id:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing hash_id'
                }), 400
            
            # Validate and sanitize hash_id
            hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
            
            if len(hash_id) < 8 or len(hash_id) > 20:
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid hash ID length'
                }), 400
            
            # Check if this presentation exists (has saved data)
            saved_files_dir = data_dir / 'saved_presentations'
            save_file = saved_files_dir / f'{hash_id}.json'
            presentation_exists = save_file.exists()
            
            # Check if session exists and is active
            if hash_id in game_sessions and game_sessions[hash_id].get('active', False):
                session = game_sessions[hash_id]
                game.log(f'✅ Active game found for hash {hash_id}')
                
                return jsonify({
                    'status': 'success',
                    'active': True,
                    'presentationExists': presentation_exists,
                    'gamePin': session.get('gamePin'),
                    'timestamp': session.get('timestamp'),
                    'hashId': hash_id
                })
            else:
                game.log(f'ℹ️ No active game for hash {hash_id}, presentation exists: {presentation_exists}')
                return jsonify({
                    'status': 'success',
                    'active': False,
                    'presentationExists': presentation_exists,
                    'hashId': hash_id
                })
                
        except Exception as e:
            game.log(f'❌ Error in check_active_game: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @game_bp.route('/register_room', methods=['POST'])
    def register_room():
        """REST endpoint to register a socket to a room by hash ID (for add-in).
        
        This just registers the socket to the room for receiving events.
        It does NOT require an active game - the add-in can be connected and waiting
        for the admin to start a game.
        """
        try:
            data = request.get_json()
            socket_id = data.get('socketId')
            hash_id = data.get('hashId')
            
            game.log(f'📨 POST /register_room - socketId: {socket_id}, hashId: {hash_id}')
            
            if not socket_id or not hash_id:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing socketId or hashId'
                }), 400
            
            # Join Socket.IO room using socketio.server API
            # This allows the add-in to receive events when admin starts a game
            socketio.server.enter_room(socket_id, hash_id, namespace='/')
            
            # Track in our mapping
            client_rooms[socket_id] = hash_id
            
            # Check if there's an active game session
            has_active_game = hash_id in game_sessions and game_sessions[hash_id].get('active', False)
            
            game.log(f'✅ Client {socket_id} joined room (hash): {hash_id} via REST')
            game.log(f'   Active game: {has_active_game}')
            
            response_data = {
                'status': 'success',
                'hashId': hash_id,
                'socketId': socket_id,
                'hasActiveGame': has_active_game
            }
            
            # If there's an active game, include the game PIN
            if has_active_game:
                response_data['gamePin'] = game_sessions[hash_id].get('gamePin')
            
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
            hash_id = request.args.get('hash_id')
            
            if not hash_id:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing hash_id'
                }), 400
            
            # Validate and sanitize hash_id
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
            close_game_and_cleanup(
                game_sessions, player_registry, client_rooms, socket_to_player,
                socketio, hash_id, game.logger, reason='manual'
            )
            
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

    # Attach handlers to blueprint for access from main API handler
    game_bp.handle_register_session = handle_register_session
    game_bp.handle_start_accepting_participants = handle_start_accepting_participants
    game_bp.handle_stop_accepting_participants = handle_stop_accepting_participants
    game_bp.handle_check_active_game = handle_check_active_game
    game_bp.handle_close_game = handle_close_game

    return game_bp
