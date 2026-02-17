"""
Load Balancer client utilities.
Centralized module for LB communication to avoid import cycles.
"""
import logging
import requests as http_requests

logger = logging.getLogger(__name__)

# Global state for LB integration
_lb_url = None
_lb_server_id = None


def init_lb(lb_url, server_id):
    """Initialize LB client with URL and server ID."""
    global _lb_url, _lb_server_id
    _lb_url = lb_url
    _lb_server_id = server_id
    logger.info(f'LB client initialized: {_lb_url} (server_id={_lb_server_id})')


def notify_game_ended(game_pin):
    """Notify LB that a game PIN is no longer active."""
    if not _lb_url or not _lb_server_id:
        return  # Not registered with LB

    try:
        http_requests.post(
            f'{_lb_url}/api/servers/{_lb_server_id}/game-ended',
            json={'game_pin': game_pin},
            timeout=5, verify=False
        )
        logger.info(f'Notified LB: game {game_pin} ended')
    except Exception as e:
        logger.warning(f'Failed to notify LB about game {game_pin} end: {e}')
        # Best effort - stale cleanup will handle it
