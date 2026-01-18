"""
WebSocket event handlers for Kahoot Quiz Server.
Handles Socket.IO events: connect, disconnect.
Room registration is handled via REST API.
"""

import time
from flask import request
from flask_socketio import emit, leave_room

from utils.room_utils import emit_to_room


def register_websocket_handlers(socketio, game, connected_clients, client_rooms, 
                                 socket_to_player, game_sessions, player_registry):
    """
    Register all WebSocket event handlers.
    
    Args:
        socketio: Flask-SocketIO instance
        game: GameManager instance
        connected_clients: Set of connected client socket IDs
        client_rooms: Dict mapping socket ID to hash ID
        socket_to_player: Dict mapping socket ID to player UID
        game_sessions: Dict of active game sessions
        player_registry: Dict of registered players
    """
    
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
                    emit_to_room(socketio, client_rooms, game.logger, 'participant_update', {
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
            
            # Check if this was an add-in socket (NOT a player socket)
            # If add-in disconnects and no other add-in sockets exist for this hash, close the game
            if request.sid not in socket_to_player:
                # This was NOT a player - likely an add-in
                # Check if any other non-player sockets exist for this hash
                other_addin_sockets = [
                    sid for sid, h_id in client_rooms.items()
                    if h_id == hash_id and sid not in socket_to_player
                ]
                
                if not other_addin_sockets:
                    # No more add-in sockets for this game - close it
                    game.log(f'🔌 Add-in disconnected for game {hash_id} - closing game and notifying players')
                    
                    from utils.room_utils import close_game_and_cleanup
                    close_game_and_cleanup(
                        game_sessions, player_registry, client_rooms, socket_to_player,
                        socketio, hash_id, game.logger, reason='addin_closed'
                    )
        else:
            game.log(f'Client disconnected: {request.sid}')


