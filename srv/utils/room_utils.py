"""
Room utilities for managing game sessions and WebSocket rooms.
"""

import time
import threading


def check_game_active(game_sessions, hash_id):
    """Check if a game session is active"""
    if hash_id not in game_sessions:
        return False
    return game_sessions[hash_id].get('active', False)


def schedule_game_timeout(game_sessions, player_registry, client_rooms, socket_to_player, 
                          socketio, hash_id, logger, timeout_seconds=3600):
    """Schedule automatic game closure after timeout (default 1 hour)"""
    from flask_socketio import leave_room
    
    def timeout_worker():
        time.sleep(timeout_seconds)
        
        # Check if game is still active
        if hash_id in game_sessions and game_sessions[hash_id].get('active', False):
            logger.info(f'⏰ Auto-closing game {hash_id} after {timeout_seconds}s timeout')
            
            # Close game and clean up players
            close_game_and_cleanup(
                game_sessions, player_registry, client_rooms, socket_to_player,
                socketio, hash_id, logger, reason='timeout'
            )
    
    timeout_thread = threading.Thread(target=timeout_worker)
    timeout_thread.daemon = True
    timeout_thread.start()
    logger.info(f'⏰ Scheduled auto-close for game {hash_id} in {timeout_seconds}s (1 hour)')


def close_game_and_cleanup(game_sessions, player_registry, client_rooms, socket_to_player,
                           socketio, hash_id, logger, reason='manual'):
    """
    Close a game session and remove all associated players.
    
    Args:
        game_sessions: Dict of game sessions
        player_registry: Dict of player registrations
        client_rooms: Dict mapping socket ID to hash ID
        socket_to_player: Dict mapping socket ID to player UID
        socketio: SocketIO instance
        hash_id: The game hash ID to close
        logger: Logger instance
        reason: Reason for closure (e.g., 'manual', 'timeout', 'ended')
    """
    from flask_socketio import leave_room
    
    if hash_id not in game_sessions:
        logger.info(f'⚠️ Cannot close game {hash_id} - not found')
        return
    
    # Notify clients BEFORE cleanup, to ensure they receive the message
    try:
        emit_to_room(socketio, client_rooms, logger, 'game_closed', {
            'hashId': hash_id,
            'timestamp': time.time(),
            'message': f'Game closed due to {reason}',
            'reason': reason
        }, hash_id)
    except Exception as e:
        logger.info(f'⚠️ Error sending game_closed event: {e}')

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
    
    # Clear socket mappings ONLY for player sockets (sim), NOT for add-in sockets
    # Player sockets are identified by being in socket_to_player mapping
    player_sockets_to_remove = [
        sid for sid, h_id in list(client_rooms.items())
        if h_id == hash_id and sid in socket_to_player
    ]
    
    for sid in player_sockets_to_remove:
        # Properly remove from Socket.IO room to prevent receiving future events
        try:
            leave_room(hash_id, sid=sid)
        except Exception:
            pass  # Ignore errors if socket already disconnected
            
        if sid in socket_to_player:
            del socket_to_player[sid]
        if sid in client_rooms:
            del client_rooms[sid]
            
    logger.info(f'🧹 Data cleanup for {hash_id}: Removed {len(players_to_remove)} players and {len(player_sockets_to_remove)} player sockets')
    
    # Delete the game session entirely
    del game_sessions[hash_id]
    logger.info(f'🗑️ Game {hash_id} deleted. Reason: {reason}')


def emit_to_room(socketio, client_rooms, logger, event, data, target_hash_id, skip_sid=None):
    """
    Emit a message only to clients in a specific room (hash ID).
    
    Args:
        socketio: SocketIO instance
        client_rooms: Dict mapping socket ID to hash ID
        logger: Logger instance
        event: The event name
        data: The data to send
        target_hash_id: The hash ID of the room to send to
        skip_sid: Optional socket ID to skip (e.g., disconnecting client)
    
    Returns:
        Number of clients the message was sent to
    """
    # Count active clients in this room (from our tracking)
    tracked_count = sum(1 for hash_id in client_rooms.values() if hash_id == target_hash_id)
    
    # Always emit to the room - Socket.IO will handle delivery to connected clients only
    # Wrap in try/except to handle cases where client disconnects during emit
    try:
        socketio.emit(event, data, room=target_hash_id, skip_sid=skip_sid)
        logger.info(f'📤 WS → {event} to room {target_hash_id} (~{tracked_count} tracked client(s))')
    except Exception as e:
        logger.info(f'⚠️ Emit failed for {event} to {target_hash_id} (client may have disconnected): {e}')
    
    return tracked_count
