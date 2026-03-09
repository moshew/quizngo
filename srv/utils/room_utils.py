"""
Room utilities for managing game sessions and WebSocket rooms.

gamePin is the primary room/game identifier (6 digits, generated in Add-in).
All rooms are identified by gamePin.
"""

import asyncio
import time


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
    """Cancel and remove a scheduled timeout task for the provided game pin."""
    if game_timeout_controls is None:
        return

    task = game_timeout_controls.pop(game_pin, None)
    if task and not task.done():
        task.cancel()
        logger.info(f'Canceled auto-close timer for game {game_pin}')


async def schedule_game_timeout(
    game_sessions,
    player_registry,
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    sio,
    game_pin,
    logger,
    timeout_seconds=3600,
    game_timeout_controls=None,
    players_by_game=None,
):
    """Schedule automatic game closure after timeout (default: 1 hour).

    Stores an asyncio.Task in game_timeout_controls instead of a threading.Event.
    Cancel by calling task.cancel() or _cancel_game_timeout().
    """
    async def timeout_worker():
        try:
            await asyncio.sleep(timeout_seconds)
        except asyncio.CancelledError:
            logger.info(f'Auto-close worker stopped for game {game_pin} (canceled)')
            return

        if game_pin in game_sessions:
            session = game_sessions[game_pin]
            logger.info(
                f'Auto-closing game {game_pin} after {timeout_seconds}s '
                f'(active={session.get("active", False)}, started={session.get("gameStarted", False)})'
            )
            await close_game_and_cleanup(
                game_sessions,
                player_registry,
                client_rooms,
                socket_to_player,
                addin_sockets_by_game,
                player_sockets_by_game,
                sio,
                game_pin,
                logger,
                reason='timeout',
                game_timeout_controls=game_timeout_controls,
                players_by_game=players_by_game,
            )

    if game_timeout_controls is not None:
        # Cancel previous timer for the same pin (if any) to avoid leaks.
        previous_task = game_timeout_controls.pop(game_pin, None)
        if previous_task and not previous_task.done():
            previous_task.cancel()

    task = asyncio.create_task(timeout_worker())

    if game_timeout_controls is not None:
        game_timeout_controls[game_pin] = task

    logger.info(f'Scheduled auto-close for game {game_pin} in {timeout_seconds}s')


async def close_game_and_cleanup(
    game_sessions,
    player_registry,
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    sio,
    game_pin,
    logger,
    reason='manual',
    game_timeout_controls=None,
    players_by_game=None,
):
    """
    Close a game session and remove all associated players and sockets.

    Args:
        game_sessions: Dict of game sessions (keyed by gamePin).
        player_registry: Dict of player registrations.
        client_rooms: Dict mapping socket ID to gamePin.
        socket_to_player: Dict mapping socket ID to player UID.
        sio: python-socketio AsyncServer instance.
        game_pin: The game PIN to close.
        logger: Logger instance.
        reason: Reason for closure (e.g., manual, timeout, addin_closed).
        game_timeout_controls: Optional dict of game_pin -> asyncio.Task.
    """
    # Stop any background timer tied to this game first.
    _cancel_game_timeout(game_timeout_controls, game_pin, logger)

    if game_pin not in game_sessions:
        logger.info(f'Cannot close game {game_pin} - session not found')
        return

    # Notify clients BEFORE cleanup, to maximize delivery success.
    try:
        await emit_to_room(
            sio,
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

    # Remove all players from this session using per-game index.
    players_to_remove = list(players_by_game.pop(game_pin, set()))
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

    # Leave rooms in parallel to avoid sequential await storm.
    await asyncio.gather(*[
        sio.leave_room(sid, game_pin)
        for sid in sockets_to_remove
    ], return_exceptions=True)

    for sid in sockets_to_remove:
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
    game_sessions.pop(game_pin, None)
    logger.info(f'Game {game_pin} deleted. Reason: {reason}')

    # Notify load balancer that this PIN is done (best-effort, fire-and-forget).
    from utils.lb_client import notify_game_ended

    async def _safe_notify():
        try:
            await notify_game_ended(game_pin)
        except Exception as exc:
            logger.debug(f'Could not notify LB about game {game_pin}: {exc}')

    asyncio.create_task(_safe_notify())


async def emit_to_room(sio, client_rooms, logger, event, data, game_pin, skip_sid=None):
    """
    Emit a message to all clients in a specific room (gamePin).

    Args:
        sio: python-socketio AsyncServer instance.
        client_rooms: Dict mapping socket ID to gamePin.
        logger: Logger instance.
        event: The event name.
        data: The data payload.
        game_pin: The room to emit to.
        skip_sid: Optional socket ID to skip.
    """
    try:
        await sio.emit(event, data, room=game_pin, skip_sid=skip_sid)
    except Exception as exc:
        logger.warning(f'Emit failed for {event} to {game_pin}: {exc}')


async def emit_to_addins(sio, addin_sockets_by_game, logger, event, data, game_pin):
    """Emit a message only to add-in sockets in a specific game room."""
    addin_sids = tuple(addin_sockets_by_game.get(game_pin, ()))
    if not addin_sids:
        return

    async def _safe_emit(sid):
        try:
            await sio.emit(event, data, to=sid)
        except Exception as exc:
            logger.warning(f'Emit failed for {event} to add-in {sid} in {game_pin}: {exc}')

    await asyncio.gather(*[_safe_emit(sid) for sid in addin_sids])
