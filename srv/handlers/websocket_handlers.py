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

from utils.room_utils import (
    emit_to_addins,
    register_player_socket,
    unregister_socket,
    has_addin_socket,
)


def register_websocket_handlers(
    socketio,
    game,
    connected_clients,
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
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
            register_player_socket(
                client_rooms,
                socket_to_player,
                addin_sockets_by_game,
                player_sockets_by_game,
                request.sid,
                game_pin,
                uid
            )
        except Exception as e:
            game.log(f'❌ Error in register_player_socket: {e}')

    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        connected_clients.discard(request.sid)
        game_pin = client_rooms.get(request.sid)
        user_id = socket_to_player.get(request.sid)
        
        # Track socket type before mutating mappings.
        was_player_socket = user_id is not None
        
        # Check if this socket belongs to a player (sim)
        if was_player_socket:
            # Mark player as disconnected in registry
            if user_id in player_registry:
                player = player_registry[user_id]
                player_name = player.get('nickname', 'Unknown')
                game_pin = player.get('gamePin') or game_pin
                
                player['connected'] = False
                player['disconnectedAt'] = time.time()

                # Send remove update so UI updates
                if game_pin in game_sessions:
                    emit_to_addins(socketio, addin_sockets_by_game, game.logger, 'participant_update', {
                        'nick': player_name,
                        'type': 'remove',
                        'user_id': user_id,
                        'timestamp': time.time()
                    }, game_pin)
        
        # NOW leave Socket.IO room and remove from mapping
        if game_pin is not None:
            leave_room(game_pin)
            unregister_socket(
                client_rooms,
                socket_to_player,
                addin_sockets_by_game,
                player_sockets_by_game,
                request.sid
            )
            
            # Check if this was an add-in socket (NOT a player socket)
            # If add-in disconnects and no other add-in sockets exist for this game, close the game
            if not was_player_socket:
                if not has_addin_socket(addin_sockets_by_game, game_pin):
                    # No more add-in sockets for this game - close it
                    from utils.room_utils import close_game_and_cleanup
                    close_game_and_cleanup(
                        game_sessions, player_registry, client_rooms, socket_to_player,
                        addin_sockets_by_game, player_sockets_by_game,
                        socketio, game_pin, game.logger, reason='addin_closed',
                        game_timeout_controls=game_timeout_controls
                    )
