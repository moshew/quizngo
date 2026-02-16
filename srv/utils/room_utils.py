"""
Room utilities for managing game sessions and WebSocket rooms.

NEW ARCHITECTURE:
- gamePin is the PRIMARY identifier (6 digits, generated in Add-in)
- hashId is REMOVED from the system
- All rooms are identified by gamePin
"""

import time
import threading


def check_game_active(game_sessions, game_pin):
    """Check if a game session is active"""
    if game_pin not in game_sessions:
        return False
    return game_sessions[game_pin].get('active', False)


def schedule_game_timeout(game_sessions, player_registry, client_rooms, socket_to_player, 
                          socketio, game_pin, logger, timeout_seconds=3600):
    """Schedule automatic game closure after timeout (default 1 hour)"""
    from flask_socketio import leave_room
    
    def timeout_worker():
        time.sleep(timeout_seconds)
        
        # Check if game is still active
        if game_pin in game_sessions and game_sessions[game_pin].get('active', False):
            logger.info(f'⏰ Auto-closing game {game_pin} after {timeout_seconds}s timeout')
            
            # Close game and clean up players
            close_game_and_cleanup(
                game_sessions, player_registry, client_rooms, socket_to_player,
                socketio, game_pin, logger, reason='timeout'
            )
    
    timeout_thread = threading.Thread(target=timeout_worker)
    timeout_thread.daemon = True
    timeout_thread.start()
    logger.info(f'⏰ Scheduled auto-close for game {game_pin} in {timeout_seconds}s (1 hour)')


def close_game_and_cleanup(game_sessions, player_registry, client_rooms, socket_to_player,
                           socketio, game_pin, logger, reason='manual'):
    """
    Close a game session and remove all associated players.
    
    Args:
        game_sessions: Dict of game sessions (keyed by gamePin)
        player_registry: Dict of player registrations
        client_rooms: Dict mapping socket ID to gamePin
        socket_to_player: Dict mapping socket ID to player UID
        socketio: SocketIO instance
        game_pin: The game PIN to close
        logger: Logger instance
        reason: Reason for closure (e.g., 'manual', 'timeout', 'ended')
    """
    from flask_socketio import leave_room
    
    if game_pin not in game_sessions:
        logger.info(f'⚠️ Cannot close game {game_pin} - not found')
        return
    
    # Notify clients BEFORE cleanup, to ensure they receive the message
    try:
        emit_to_room(socketio, client_rooms, logger, 'game_closed', {
            'gamePin': game_pin,
            'timestamp': time.time(),
            'message': f'Game closed due to {reason}',
            'reason': reason
        }, game_pin)
    except Exception as e:
        logger.info(f'⚠️ Error sending game_closed event: {e}')

    # --- Perform data cleanup (players, sockets) ---
    
    # Remove all players from this session
    players_to_remove = [
        uid for uid, player in list(player_registry.items())
        if player.get('gamePin') == game_pin
    ]
    
    for uid in players_to_remove:
        # Get name safely
        player_name = 'Unknown'
        if uid in player_registry:
            player_name = player_registry[uid].get('nickname', 'Unknown')
            del player_registry[uid]
    
    # Clear socket mappings for player sockets in this game
    player_sockets_to_remove = [
        sid for sid, g_pin in list(client_rooms.items())
        if g_pin == game_pin and sid in socket_to_player
    ]
    
    for sid in player_sockets_to_remove:
        # Properly remove from Socket.IO room to prevent receiving future events
        try:
            leave_room(game_pin, sid=sid)
        except Exception:
            pass  # Ignore errors if socket already disconnected
            
        if sid in socket_to_player:
            del socket_to_player[sid]
        if sid in client_rooms:
            del client_rooms[sid]
            
    logger.info(f'🧹 Data cleanup for {game_pin}: Removed {len(players_to_remove)} players and {len(player_sockets_to_remove)} player sockets')
    
    # Delete the game session entirely
    del game_sessions[game_pin]
    logger.info(f'🗑️ Game {game_pin} deleted. Reason: {reason}')

    # Notify load balancer that this PIN is done
    try:
        from server import notify_lb_game_ended
        notify_lb_game_ended(game_pin)
    except Exception:
        pass  # Best effort


def emit_to_room(socketio, client_rooms, logger, event, data, game_pin, skip_sid=None):
    """
    Emit a message only to clients in a specific room (gamePin).
    
    Args:
        socketio: SocketIO instance
        client_rooms: Dict mapping socket ID to gamePin
        logger: Logger instance
        event: The event name
        data: The data to send
        game_pin: The gamePin of the room to send to
        skip_sid: Optional socket ID to skip (e.g., disconnecting client)
    
    Returns:
        Number of clients the message was sent to
    """
    # Count active clients in this room (from our tracking)
    tracked_count = sum(1 for pin in client_rooms.values() if pin == game_pin)
    
    # Always emit to the room - Socket.IO will handle delivery to connected clients only
    # Wrap in try/except to handle cases where client disconnects during emit
    try:
        socketio.emit(event, data, room=game_pin, skip_sid=skip_sid)
        logger.info(f'📤 WS → {event} to room {game_pin} (~{tracked_count} tracked client(s))')
    except Exception as e:
        logger.info(f'⚠️ Emit failed for {event} to {game_pin} (client may have disconnected): {e}')
    
    return tracked_count
