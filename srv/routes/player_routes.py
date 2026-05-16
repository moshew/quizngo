"""
Player routes for QuizNGO Quiz Server.
Handles player join, leave, rejoin, and answer submission.
gamePin is the primary identifier for all room operations.
"""

import re
import time
import uuid
from quart import Blueprint, request, jsonify

from utils.room_utils import (
    emit_to_addins,
    register_player_socket,
    check_game_active,
)


def create_player_routes(
    sio,
    game,
    game_sessions,
    player_registry,
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    players_by_game=None,
):
    """
    Create player routes blueprint.

    Args:
        sio: python-socketio AsyncServer instance
        game: GameLogger instance
        game_sessions: Dict of active game sessions (keyed by gamePin)
        player_registry: Dict of registered players
        client_rooms: Dict mapping socket ID to gamePin
        socket_to_player: Dict mapping socket ID to player UID

    Returns:
        Blueprint with player routes
    """
    player_bp = Blueprint('player', __name__)

    @player_bp.route('/rejoin_player', methods=['POST'])
    async def rejoin_player():
        """Handle player rejoin - reconnect with existing UID"""
        try:
            data = await request.get_json()

            if not data:
                return jsonify({
                    'status': 'error',
                    'message': 'No JSON data provided'
                }), 400

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

            session = game_sessions[player_game_pin]

            # Always send add update on rejoin to ensure add-in has the player
            await emit_to_addins(sio, addin_sockets_by_game, game.logger, 'participant_update', {
                'nick': player_name,
                'icon': player.get('icon', '👤'),
                'type': 'add',
                'user_id': user_id,
                'timestamp': time.time()
            }, game_pin)

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

            # If in answer time, include sync data with remaining time in response
            if game_state == 'answering' and 'currentQuestion' in session:
                response_data['needsSync'] = True
                response_data['syncData'] = session['currentQuestion']
                # Calculate remaining time (same logic as join_player)
                question_data = session['currentQuestion']
                question_wait_time = question_data.get('questionWaitTime', 30)
                answer_started_at = session.get('answerStartedAt', 0)
                elapsed = time.time() - answer_started_at
                remaining = max(0, question_wait_time - elapsed)
                response_data['remainingTime'] = round(remaining, 1)
                game.log(f'⏱️ Mid-question rejoin: {remaining:.1f}s remaining for {player_name}')

            # If socketId provided, register socket to room (room = gamePin)
            if socket_id:
                await sio.enter_room(socket_id, game_pin)
                register_player_socket(
                    client_rooms,
                    socket_to_player,
                    addin_sockets_by_game,
                    player_sockets_by_game,
                    socket_id,
                    game_pin,
                    user_id
                )

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
    async def submit_answer():
        """Handle player answer submission from sim via REST API"""
        try:
            data = await request.get_json()

            if not data:
                return jsonify({
                    'status': 'error',
                    'message': 'No JSON data provided'
                }), 400

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

            # Forward player answers only to add-in sockets (not all players).
            await emit_to_addins(
                sio,
                addin_sockets_by_game,
                game.logger,
                'player_answer',
                data,
                game_pin
            )

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

    async def handle_join_player():
        """Handle player join - called from main API handler"""
        try:
            # Get JSON data from POST request
            data = await request.get_json()
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

            # Check if game has been started by admin (players can only join after admin starts)
            session = game_sessions[game_pin]
            if not session.get('gameStarted', False) or not session.get('active', False):
                game.log(f'🚫 Rejected join attempt - game {game_pin} not started yet')
                return jsonify({
                    'status': 'error',
                    'message': 'Game has not started yet. Please wait for the host.'
                }), 403

            # UID-based rejoin: if client sends a UID, try to recover that specific session
            request_uid = data.get('uid', '').strip()

            if request_uid and request_uid in player_registry:
                existing_player = player_registry[request_uid]
                # Verify the UID belongs to the same game
                if existing_player.get('gamePin') == game_pin:
                    # UID matches — this is a genuine reconnect
                    game.log(f'♻️ Player {name} rejoining with existing UID: {request_uid}')

                    uid = request_uid

                    # Update status
                    player_registry[uid]['connected'] = True
                    player_registry[uid]['reconnectedAt'] = time.time()

                    # Update name/icon if changed
                    player_registry[uid]['nickname'] = name
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

                    await emit_to_addins(sio, addin_sockets_by_game, game.logger, 'participant_update', participant_data, game_pin)

                    # If socketId provided, register socket to room (room = gamePin)
                    if socket_id:
                        await sio.enter_room(socket_id, game_pin)
                        register_player_socket(
                            client_rooms,
                            socket_to_player,
                            addin_sockets_by_game,
                            player_sockets_by_game,
                            socket_id,
                            game_pin,
                            uid
                        )

                    # Build response with game state for mid-game rejoin
                    rejoin_response = {
                        'status': 'success',
                        'uid': uid,
                        'gamePin': game_pin,
                        'message': 'Rejoined successfully'
                    }

                    # Include current game state
                    session = game_sessions.get(game_pin, {})
                    rejoin_response['gameStarted'] = session.get('gameStarted', False)
                    rejoin_response['gameState'] = session.get('currentState', 'waiting')

                    # If mid-question, include sync data with remaining time
                    if session.get('currentState') == 'answering' and 'currentQuestion' in session:
                        question_data = session['currentQuestion']
                        question_wait_time = question_data.get('questionWaitTime', 30)
                        answer_started_at = session.get('answerStartedAt', 0)
                        elapsed = time.time() - answer_started_at
                        remaining = max(0, question_wait_time - elapsed)

                        rejoin_response['needsSync'] = True
                        rejoin_response['syncData'] = question_data
                        rejoin_response['remainingTime'] = round(remaining, 1)
                        game.log(f'⏱️ Mid-question rejoin: {remaining:.1f}s remaining for {name}')

                    return jsonify(rejoin_response)

            # No UID or UID not found — check if name is taken by another player.
            # Iterate only the UIDs in this specific game (O(players in game)).
            game_uids = list(players_by_game.get(game_pin, set()))
            for existing_uid in game_uids:
                player = player_registry.get(existing_uid)
                if player and player.get('nickname') == name:
                    if player.get('connected', False):
                        # Another active player already has this name — reject
                        game.log(f'🚫 Rejected join attempt - name {name} already taken (connected) in game {game_pin}')
                        return jsonify({
                            'status': 'error',
                            'message': {'code': 'NAME_ALREADY_IN_USE', 'params': {'name': name}}
                        }), 409

                    # Disconnected player with the same name — treat as name-based rejoin
                    game.log(f'♻️ Name-based rejoin for disconnected player {name} in game {game_pin}')
                    uid = existing_uid
                    player_registry[uid]['connected'] = True
                    player_registry[uid]['reconnectedAt'] = time.time()
                    if icon:
                        player_registry[uid]['icon'] = icon

                    await emit_to_addins(sio, addin_sockets_by_game, game.logger, 'participant_update', {
                        'nick': name,
                        'icon': player_registry[uid].get('icon', '👤'),
                        'type': 'add',
                        'user_id': uid,
                        'timestamp': time.time()
                    }, game_pin)

                    if socket_id:
                        await sio.enter_room(socket_id, game_pin)
                        register_player_socket(
                            client_rooms,
                            socket_to_player,
                            addin_sockets_by_game,
                            player_sockets_by_game,
                            socket_id,
                            game_pin,
                            uid
                        )

                    rejoin_response = {
                        'status': 'success',
                        'uid': uid,
                        'gamePin': game_pin,
                        'message': 'Rejoined successfully'
                    }
                    session = game_sessions.get(game_pin, {})
                    rejoin_response['gameStarted'] = session.get('gameStarted', False)
                    rejoin_response['gameState'] = session.get('currentState', 'waiting')

                    if session.get('currentState') == 'answering' and 'currentQuestion' in session:
                        question_data = session['currentQuestion']
                        question_wait_time = question_data.get('questionWaitTime', 30)
                        answer_started_at = session.get('answerStartedAt', 0)
                        elapsed = time.time() - answer_started_at
                        remaining = max(0, question_wait_time - elapsed)
                        rejoin_response['needsSync'] = True
                        rejoin_response['syncData'] = question_data
                        rejoin_response['remainingTime'] = round(remaining, 1)
                        game.log(f'⏱️ Mid-question name-rejoin: {remaining:.1f}s remaining for {name}')

                    return jsonify(rejoin_response)

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
            # Keep per-game index in sync.
            players_by_game.setdefault(game_pin, set()).add(uid)

            # Send participant update to add-ins in this specific game room
            participant_data = {
                'nick': name,
                'icon': icon,
                'type': 'add',
                'user_id': uid,
                'timestamp': time.time()
            }

            await emit_to_addins(sio, addin_sockets_by_game, game.logger, 'participant_update', participant_data, game_pin)

            # If socketId provided, register socket to room (room = gamePin)
            if socket_id:
                await sio.enter_room(socket_id, game_pin)
                register_player_socket(
                    client_rooms,
                    socket_to_player,
                    addin_sockets_by_game,
                    player_sockets_by_game,
                    socket_id,
                    game_pin,
                    uid
                )

            # Build response with current game state for mid-game join
            join_response = {
                'status': 'success',
                'uid': uid,
                'gamePin': game_pin
            }

            session = game_sessions.get(game_pin, {})
            join_response['gameStarted'] = session.get('gameStarted', False)
            join_response['gameState'] = session.get('currentState', 'waiting')

            # If mid-question, include sync data with remaining time
            if session.get('currentState') == 'answering' and 'currentQuestion' in session:
                question_data = session['currentQuestion']
                question_wait_time = question_data.get('questionWaitTime', 30)
                answer_started_at = session.get('answerStartedAt', 0)
                elapsed = time.time() - answer_started_at
                remaining = max(0, question_wait_time - elapsed)

                join_response['needsSync'] = True
                join_response['syncData'] = question_data
                join_response['remainingTime'] = round(remaining, 1)
                game.log(f'⏱️ Mid-question join: {remaining:.1f}s remaining for {name}')

            return jsonify(join_response)

        except Exception as e:
            game.log(f'❌ Error in join_player: {str(e)}')
            import traceback
            traceback.print_exc()
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    async def handle_leave_player():
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

            # Remove from registry and per-game index.
            del player_registry[uid]
            players_by_game.get(game_pin, set()).discard(uid)

            # Notify add-in to remove from screen
            if game_pin in game_sessions:
                await emit_to_addins(sio, addin_sockets_by_game, game.logger, 'participant_update', {
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
