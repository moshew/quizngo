"""
WebSocket event handlers for QuizNGO Quiz Server.
Handles Socket.IO events: connect, disconnect, register_player_socket.
Room registration is handled via REST API.

- gamePin is the primary room/game identifier (6 digits, generated in Add-in)
- WebSocket connects only when game starts, disconnects when game ends
- Rooms are identified by gamePin
- Handlers receive (sid, ...) via python-socketio AsyncServer
"""

import asyncio
import time

from utils.room_utils import (
    emit_to_addins,
    register_player_socket,
    unregister_socket,
    has_addin_socket,
    close_game_and_cleanup,
)

# Grace period before closing game when addin socket disconnects.
# If the addin reconnects (register_room) within this window, the close is canceled.
ADDIN_GRACE_SECONDS = 15


def register_websocket_handlers(
    sio,
    game,
    client_rooms,
    socket_to_player,
    addin_sockets_by_game,
    player_sockets_by_game,
    game_sessions,
    player_registry,
    players_by_game=None,
    game_timeout_controls=None,
    addin_grace_timers=None,
    ):
    """
    Register all WebSocket event handlers on the AsyncServer instance.

    Args:
        sio: python-socketio AsyncServer instance
        game: GameLogger instance
        client_rooms: Dict mapping socket ID to gamePin
        socket_to_player: Dict mapping socket ID to player UID
        game_sessions: Dict of active game sessions (keyed by gamePin)
        player_registry: Dict of registered players
        game_timeout_controls: Dict mapping gamePin to asyncio.Task
    """

    def _log_addin_disconnect_before_game_end(game_pin, disconnect_reason, sid):
        """Emit one error when add-in disconnects before game cleanup."""
        session = game_sessions.get(game_pin)
        if not session:
            return

        started = bool(session.get('gameStarted'))
        active = bool(session.get('active'))
        if not started and not active:
            # Avoid noise from waiting rooms that never actually started.
            return

        game_uids = players_by_game.get(game_pin, set()) if players_by_game else set()
        connected_count = sum(
            1 for uid in game_uids
            if player_registry.get(uid, {}).get('connected', False)
        )
        total_players = len(game_uids)

        started_at = session.get('startedAt')
        uptime_seconds = None
        if isinstance(started_at, (int, float)):
            uptime_seconds = max(0, int(time.time() - started_at))

        game.log(
            '❌ Add-in socket disconnected before game end: '
            f'gamePin={game_pin}, '
            f'sid={sid}, '
            f'reason={disconnect_reason or "unknown"}, '
            f'state={session.get("currentState", "unknown")}, '
            f'started={started}, active={active}, '
            f'connectedPlayers={connected_count}/{total_players}, '
            f'uptime={uptime_seconds if uptime_seconds is not None else "n/a"}s. '
            'Auto-closing game (addin_closed).'
        )

    @sio.event
    async def connect(sid, environ):
        """Handle client connection.

        Returns immediately so the CONNECT ACK is sent without delay.
        Any post-connect work is fire-and-forget to avoid blocking under load.
        """
        pass

    @sio.on('register_player_socket')
    async def handle_register_player_socket(sid, data):
        """Called by simulator player sockets after joining via HTTP join_player.

        Registers the socket to the game room and links it to the player UID
        so that disconnect events correctly mark the player as disconnected
        rather than triggering the add-in auto-close logic.
        """
        try:
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

            await sio.enter_room(sid, game_pin)
            register_player_socket(
                client_rooms,
                socket_to_player,
                addin_sockets_by_game,
                player_sockets_by_game,
                sid,
                game_pin,
                uid
            )
        except Exception as e:
            game.log(f'❌ Error in register_player_socket: {e}')

    @sio.event
    async def disconnect(sid, reason=None):
        """Handle client disconnection."""
        game_pin = client_rooms.get(sid)
        user_id = socket_to_player.get(sid)

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
                    await emit_to_addins(sio, addin_sockets_by_game, game.logger, 'participant_update', {
                        'nick': player_name,
                        'type': 'remove',
                        'user_id': user_id,
                        'timestamp': time.time()
                    }, game_pin)

        # NOW leave Socket.IO room and remove from mapping
        if game_pin is not None:
            await sio.leave_room(sid, game_pin)
            unregister_socket(
                client_rooms,
                socket_to_player,
                addin_sockets_by_game,
                player_sockets_by_game,
                sid
            )

            # Check if this was an add-in socket (NOT a player socket).
            # If add-in disconnects and no other add-in sockets remain, start a
            # grace period instead of closing immediately – the addin may reconnect.
            if not was_player_socket:
                if not has_addin_socket(addin_sockets_by_game, game_pin):
                    # Cancel any previous grace timer for this pin.
                    if addin_grace_timers is not None:
                        old_task = addin_grace_timers.pop(game_pin, None)
                        if old_task and not old_task.done():
                            old_task.cancel()

                    async def _grace_worker(_pin=game_pin, _reason=reason, _sid=sid):
                        try:
                            await asyncio.sleep(ADDIN_GRACE_SECONDS)
                        except asyncio.CancelledError:
                            return
                        # Clean up our own timer entry.
                        if addin_grace_timers is not None:
                            addin_grace_timers.pop(_pin, None)
                        # Game may have been closed by other means during grace.
                        if _pin not in game_sessions:
                            return
                        if not has_addin_socket(addin_sockets_by_game, _pin):
                            _log_addin_disconnect_before_game_end(_pin, _reason, _sid)
                            await close_game_and_cleanup(
                                game_sessions, player_registry, client_rooms, socket_to_player,
                                addin_sockets_by_game, player_sockets_by_game,
                                sio, _pin, game.logger, reason='addin_closed',
                                game_timeout_controls=game_timeout_controls,
                                players_by_game=players_by_game,
                            )

                    task = asyncio.create_task(_grace_worker())
                    if addin_grace_timers is not None:
                        addin_grace_timers[game_pin] = task
                    game.log(f'Addin grace period started for {game_pin} ({ADDIN_GRACE_SECONDS}s)')
