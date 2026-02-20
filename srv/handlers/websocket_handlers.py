"""
WebSocket event handlers for QuizNGO Quiz Server.
Handles Socket.IO events: connect, disconnect.
Room registration is handled via REST API.

NEW ARCHITECTURE:
- gamePin is the PRIMARY identifier (6 digits, generated in Add-in)
- hashId is REMOVED from the system
- WebSocket connects only when game starts, disconnects when game ends
- Rooms are identified by gamePin
"""

import time
from flask import request
from flask_socketio import emit, leave_room

from utils.room_utils import emit_to_room


def register_websocket_handlers(
    socketio,
    game,
    connected_clients,
    client_rooms,
    socket_to_player,
    game_sessions,
    player_registry,
    game_timeout_controls=None
):
    """
    Register all WebSocket event handlers.
    
    Args:
        socketio: Flask-SocketIO instance
        game: GameManager instance
        connected_clients: Set of connected client socket IDs
        client_rooms: Dict mapping socket ID to gamePin
        socket_to_player: Dict mapping socket ID to player UID
        game_sessions: Dict of active game sessions (keyed by gamePin)
        player_registry: Dict of registered players
    """
    
    @socketio.on('connect')
    def handle_connect():
        """Handle client connection"""
        try:
            connected_clients.add(request.sid)
            game.log(f'📡 WS ← connect: {request.sid}')
            
            # Send connection acknowledgment
            emit('status_update', {'connected': True})
        except Exception as e:
            game.log(f'❌ Error in connect handler: {e}')
            import traceback
            traceback.print_exc()

    @socketio.on('register_player_socket')
    def handle_register_player_socket(data):
        """Called by simulator player sockets after joining via HTTP join_player.

        Registers the socket to the game room and links it to the player UID
        so that disconnect events correctly mark the player as disconnected
        rather than triggering the add-in auto-close logic.
        """
        try:
            from flask_socketio import join_room
            uid      = (data.get('uid')      or '').strip()
            game_pin = (data.get('gamePin')  or '').strip()

            if not uid or not game_pin:
                return
            if game_pin not in game_sessions:
                return
            if uid not in player_registry:
                return
            if player_registry[uid].get('gamePin') != game_pin:
                return

            join_room(game_pin)
            client_rooms[request.sid]    = game_pin
            socket_to_player[request.sid] = uid
            game.log(f'🔗 Player socket {request.sid} registered to game {game_pin} (uid: {uid})')
        except Exception as e:
            game.log(f'❌ Error in register_player_socket: {e}')

    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        connected_clients.discard(request.sid)
        game.log(f'📡 WS ← disconnect: {request.sid}')
        
        # Track socket type before mutating mappings.
        was_player_socket = request.sid in socket_to_player
        
        # Check if this socket belongs to a player (sim)
        if was_player_socket:
            user_id = socket_to_player[request.sid]
            
            # Mark player as disconnected in registry
            if user_id in player_registry:
                player = player_registry[user_id]
                player_name = player.get('nickname', 'Unknown')
                game_pin = player.get('gamePin')
                
                player['connected'] = False
                player['disconnectedAt'] = time.time()
                
                game.log(f'👋 Player WebSocket disconnected: {player_name} (UID: {user_id})')
                game.log(f'📝 Player {player_name} marked as disconnected (can reconnect)')
                
                # Send remove update so UI updates
                if game_pin in game_sessions:
                    emit_to_room(socketio, client_rooms, game.logger, 'participant_update', {
                        'nick': player_name,
                        'type': 'remove',
                        'user_id': user_id,
                        'timestamp': time.time()
                    }, game_pin)
                    # Player stays in registry as disconnected so they can rejoin
                    game.log(f'📝 Player {player_name} kept in registry for potential rejoin')
            
            # Remove socket->player mapping
            del socket_to_player[request.sid]
        
        # NOW leave Socket.IO room and remove from mapping
        if request.sid in client_rooms:
            game_pin = client_rooms[request.sid]
            leave_room(game_pin)
            del client_rooms[request.sid]
            game.log(f'🚪 Client left room {game_pin}: {request.sid}')
            
            # Check if this was an add-in socket (NOT a player socket)
            # If add-in disconnects and no other add-in sockets exist for this game, close the game
            if not was_player_socket:
                # This was NOT a player - likely an add-in
                # Check if any other non-player sockets exist for this game
                other_addin_sockets = [
                    sid for sid, g_pin in client_rooms.items()
                    if g_pin == game_pin and sid not in socket_to_player
                ]
                
                if not other_addin_sockets:
                    # No more add-in sockets for this game - close it
                    game.log(f'🔌 Add-in disconnected for game {game_pin} - closing game and notifying players')
                    
                    from utils.room_utils import close_game_and_cleanup
                    close_game_and_cleanup(
                        game_sessions, player_registry, client_rooms, socket_to_player,
                        socketio, game_pin, game.logger, reason='addin_closed',
                        game_timeout_controls=game_timeout_controls
                    )
        else:
            game.log(f'Client disconnected: {request.sid}')

