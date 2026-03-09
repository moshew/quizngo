"""Load Balancer client utilities.

Centralized module for all srv → LB communication.
Maintains a single long-lived aiohttp session to avoid per-request
TCP connection and ephemeral-port overhead.
"""
import asyncio
import logging
import aiohttp

logger = logging.getLogger(__name__)

_lb_url: str | None = None
_lb_server_id: str | None = None
_session: aiohttp.ClientSession | None = None
_timeout = aiohttp.ClientTimeout(total=5)


async def _get_session() -> aiohttp.ClientSession:
    """Return the shared session, creating it lazily on first use."""
    global _session
    if _session is None or _session.closed:
        connector = aiohttp.TCPConnector(limit=100, ssl=False)
        _session = aiohttp.ClientSession(connector=connector, timeout=_timeout)
    return _session


def init_lb(lb_url: str, server_id: str) -> None:
    """Initialize LB client with URL and server ID."""
    global _lb_url, _lb_server_id
    _lb_url = lb_url
    _lb_server_id = server_id
    logger.info(f'LB client initialized: {_lb_url} (server_id={_lb_server_id})')


async def lb_post(url: str, json_data: dict) -> dict:
    """POST to the load balancer using the shared session."""
    session = await _get_session()
    async with session.post(url, json=json_data) as resp:
        return await resp.json()


async def notify_game_ended(game_pin: str) -> None:
    """Notify LB that a game PIN is no longer active (best-effort)."""
    if not _lb_url or not _lb_server_id:
        return
    try:
        url = f'{_lb_url}/api/servers/{_lb_server_id}/game-ended'
        session = await _get_session()
        async with session.post(url, json={'game_pin': game_pin}) as resp:
            logger.info(f'Notified LB: game {game_pin} ended (status={resp.status})')
    except Exception as e:
        logger.warning(f'Failed to notify LB about game {game_pin} end: {e}')


async def close_session() -> None:
    """Gracefully close the shared session (call on shutdown)."""
    global _session
    if _session and not _session.closed:
        await _session.close()
        _session = None
