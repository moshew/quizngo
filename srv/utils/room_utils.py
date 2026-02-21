"""
Room utilities for managing game sessions and WebSocket rooms.

NEW ARCHITECTURE:
- gamePin is the PRIMARY identifier (6 digits, generated in Add-in)
- hashId is REMOVED from the system
- All rooms are identified by gamePin
"""

import time
import threading


_REASON_CODE_MAP = {
    'manual': 'MANUAL',
    'timeout': 'TIMEOUT',
    'addin_closed': 'ADDIN_CLOSED',
    'new_session': 'NEW_SESSION',
    'cleanup': 'CLEANUP',
    'websocket_disconnect': 'WEBSOCKET_DISCONNECT',
}


def check_game_active(game_sessions, game_pin):
    """Check if a game session is active."""
    if game_pin not in game_sessions:
        return False
    return game_sessions[game_pin].get('active', False)


def _add_sid_to_index(index_by_game, game_pin, sid):
    """Add a socket id to a room index map (gamePin -> set[sid])."""
    if index_by_game is None:
        return
    index_by_game.setdefault(game_pin, set()).add(sid)


def _remove_sid_from_index(index_by_game, game_pin, sid):
    """Remove a socket id from a room index map and prune empty sets."""
    if index_by_game is None:
        return
    sids = index_by_game.get(game_pin)
    if not sids:
        return
    sids.discard(sid)
    if not sids:
        index_by_game.pop(game_pin, None)


def register_addin_socket(
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    sid,
    game_pin
):
    """Register/overwrite an add-in socket mapping and keep indexes in sync."""
    previous_game = client_rooms.get(sid)
    if previous_game is not None:
        _remove_sid_from_index(addin_sockets_by_game, previous_game, sid)
        _remove_sid_from_index(player_sockets_by_game, previous_game, sid)

    socket_to_player.pop(sid, None)
    client_rooms[sid] = game_pin
    _add_sid_to_index(addin_sockets_by_game, game_pin, sid)


def register_player_socket(
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    sid,
    game_pin,
    uid
):
    """Register/overwrite a player socket mapping and keep indexes in sync."""
    previous_game = client_rooms.get(sid)
    if previous_game is not None:
        _remove_sid_from_index(addin_sockets_by_game, previous_game, sid)
        _remove_sid_from_index(player_sockets_by_game, previous_game, sid)

    client_rooms[sid] = game_pin
    socket_to_player[sid] = uid
    _add_sid_to_index(player_sockets_by_game, game_pin, sid)


def unregister_socket(
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    sid
):
    """Remove a socket from all mappings and indexes. Returns (game_pin, uid)."""
    game_pin = client_rooms.pop(sid, None)
    uid = socket_to_player.pop(sid, None)

    if game_pin is not None:
        _remove_sid_from_index(addin_sockets_by_game, game_pin, sid)
        _remove_sid_from_index(player_sockets_by_game, game_pin, sid)

    return game_pin, uid


def has_addin_socket(addin_sockets_by_game, game_pin):
    """Fast O(1) check whether a game currently has at least one add-in socket."""
    return bool(addin_sockets_by_game and addin_sockets_by_game.get(game_pin))


def _cancel_game_timeout(game_timeout_controls, game_pin, logger):
    """Cancel and remove a scheduled timeout for the provided game pin."""
    if game_timeout_controls is None:
        return

    timeout_event = game_timeout_controls.pop(game_pin, None)
    if timeout_event:
        timeout_event.set()
        logger.info(f'Canceled auto-close timer for game {game_pin}')


def schedule_game_timeout(
    game_sessions,
    player_registry,
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    socketio,
    game_pin,
    logger,
    timeout_seconds=3600,
    game_timeout_controls=None
):
    """Schedule automatic game closure after timeout (default: 1 hour)."""
    timeout_event = threading.Event()

    if game_timeout_controls is not None:
        # Replace previous timer for the same pin (if any) to avoid leaks.
        previous_event = game_timeout_controls.pop(game_pin, None)
        if previous_event:
            previous_event.set()
        game_timeout_controls[game_pin] = timeout_event

    def timeout_worker():
        canceled = timeout_event.wait(timeout_seconds)
        if canceled:
            logger.info(f'Auto-close worker stopped for game {game_pin} (canceled)')
            return

        # If the session still exists (active or waiting), close it.
        if game_pin in game_sessions:
            session = game_sessions[game_pin]
            logger.info(
                f'Auto-closing game {game_pin} after {timeout_seconds}s '
                f'(active={session.get("active", False)}, started={session.get("gameStarted", False)})'
            )
            close_game_and_cleanup(
                game_sessions,
                player_registry,
                client_rooms,
                socket_to_player,
                addin_sockets_by_game,
                player_sockets_by_game,
                socketio,
                game_pin,
                logger,
                reason='timeout',
                game_timeout_controls=game_timeout_controls
            )

    timeout_thread = threading.Thread(target=timeout_worker, daemon=True)
    timeout_thread.start()
    logger.info(f'Scheduled auto-close for game {game_pin} in {timeout_seconds}s')


def close_game_and_cleanup(
    game_sessions,
    player_registry,
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    socketio,
    game_pin,
    logger,
    reason='manual',
    game_timeout_controls=None
):
    """
    Close a game session and remove all associated players and sockets.

    Args:
        game_sessions: Dict of game sessions (keyed by gamePin).
        player_registry: Dict of player registrations.
        client_rooms: Dict mapping socket ID to gamePin.
        socket_to_player: Dict mapping socket ID to player UID.
        socketio: SocketIO instance.
        game_pin: The game PIN to close.
        logger: Logger instance.
        reason: Reason for closure (e.g., manual, timeout, addin_closed).
        game_timeout_controls: Optional dict of game_pin -> threading.Event.
    """
    from flask_socketio import leave_room

    # Stop any background timer tied to this game first.
    _cancel_game_timeout(game_timeout_controls, game_pin, logger)

    if game_pin not in game_sessions:
        logger.info(f'Cannot close game {game_pin} - session not found')
        return

    # Notify clients BEFORE cleanup, to maximize delivery success.
    try:
        emit_to_room(
            socketio,
            client_rooms,
            logger,
            'game_closed',
            {
                'gamePin': game_pin,
                'timestamp': time.time(),
                'message': {
                    'code': 'GAME_CLOSED',
                    'params': {
                        'reason': _REASON_CODE_MAP.get(reason, str(reason).upper())
                    }
                },
                'reason': {
                    'code': _REASON_CODE_MAP.get(reason, str(reason).upper())
                }
            },
            game_pin
        )
    except Exception as exc:
        logger.info(f'Error sending game_closed event for {game_pin}: {exc}')

    # Remove all players from this session.
    players_to_remove = [
        uid for uid, player in list(player_registry.items())
        if player.get('gamePin') == game_pin
    ]
    for uid in players_to_remove:
        if uid in player_registry:
            del player_registry[uid]

    # Remove ALL sockets (players + add-in sockets) associated with this game.
    sockets_to_remove = set()
    if player_sockets_by_game is not None:
        sockets_to_remove.update(player_sockets_by_game.get(game_pin, set()))
    if addin_sockets_by_game is not None:
        sockets_to_remove.update(addin_sockets_by_game.get(game_pin, set()))
    if not sockets_to_remove:
        sockets_to_remove = {
            sid for sid, pin in list(client_rooms.items())
            if pin == game_pin
        }

    removed_player_sockets = 0
    removed_addin_sockets = 0

    for sid in sockets_to_remove:
        try:
            leave_room(game_pin, sid=sid)
        except Exception:
            pass

        if sid in socket_to_player:
            socket_to_player.pop(sid, None)
            removed_player_sockets += 1
        else:
            removed_addin_sockets += 1

        client_rooms.pop(sid, None)
        _remove_sid_from_index(player_sockets_by_game, game_pin, sid)
        _remove_sid_from_index(addin_sockets_by_game, game_pin, sid)

    if player_sockets_by_game is not None:
        player_sockets_by_game.pop(game_pin, None)
    if addin_sockets_by_game is not None:
        addin_sockets_by_game.pop(game_pin, None)

    logger.info(
        f'Cleanup for {game_pin}: players={len(players_to_remove)}, '
        f'player_sockets={removed_player_sockets}, addin_sockets={removed_addin_sockets}'
    )

    # Delete the game session itself.
    del game_sessions[game_pin]
    logger.info(f'Game {game_pin} deleted. Reason: {reason}')

    # Notify load balancer that this PIN is done.
    try:
        from utils.lb_client import notify_game_ended
        notify_game_ended(game_pin)
    except Exception as exc:
        logger.debug(f'Could not notify LB about game {game_pin}: {exc}')


def emit_to_room(socketio, client_rooms, logger, event, data, game_pin, skip_sid=None):
    """
    Emit a message only to clients in a specific room (gamePin).

    Args:
        socketio: SocketIO instance.
        client_rooms: Dict mapping socket ID to gamePin.
        logger: Logger instance.
        event: The event name.
        data: The data payload.
        game_pin: The room to emit to.
        skip_sid: Optional socket ID to skip.

    Returns:
        None.
    """
    try:
        socketio.emit(event, data, room=game_pin, skip_sid=skip_sid)
    except Exception as exc:
        logger.warning(f'Emit failed for {event} to {game_pin}: {exc}')


def emit_to_addins(socketio, addin_sockets_by_game, logger, event, data, game_pin):
    """
    Emit a message only to add-in sockets in a specific game room.

    Returns:
        None.
    """
    if addin_sockets_by_game is None:
        return

    addin_sids = tuple(addin_sockets_by_game.get(game_pin, ()))
    for sid in addin_sids:
        try:
            socketio.emit(event, data, to=sid)
        except Exception as exc:
            logger.warning(f'Emit failed for {event} to add-in {sid} in {game_pin}: {exc}')
