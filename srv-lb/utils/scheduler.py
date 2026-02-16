import logging
import eventlet
import requests

logger = logging.getLogger(__name__)


def start_health_checker(server_registry, interval=60):
    """Background task: check server health every `interval` seconds."""
    def _worker():
        while True:
            eventlet.sleep(interval)
            try:
                downed = server_registry.check_health()
                for sid in downed:
                    logger.warning(f"Server {sid} marked as DOWN (heartbeat timeout)")
            except Exception as e:
                logger.error(f"Health checker error: {e}")

    eventlet.spawn(_worker)
    logger.info(f"Health checker started (interval={interval}s)")


def start_stale_cleanup(server_registry, pin_registry, interval=600):
    """Background task: poll each srv for active games every `interval` seconds.
    Removes stale PIN mappings that no longer exist on the server."""
    def _worker():
        while True:
            eventlet.sleep(interval)
            try:
                _cleanup_stale_pins(server_registry, pin_registry)
            except Exception as e:
                logger.error(f"Stale cleanup error: {e}")

    eventlet.spawn(_worker)
    logger.info(f"Stale PIN cleanup started (interval={interval}s)")


def _cleanup_stale_pins(server_registry, pin_registry):
    """Poll each healthy server for its active game PINs and remove stale mappings."""
    servers = server_registry.get_all()
    for srv in servers:
        if srv['status'] == 'down':
            continue
        try:
            resp = requests.get(f"{srv['address']}/sim_gamePIN", timeout=10)
            if resp.status_code != 200:
                continue
            data = resp.json()
            # srv returns 'games' field with list of game objects
            games = data.get('games', [])
            # Extract just the gamePins from each game object
            active_pins_on_server = set(game.get('gamePin') for game in games if game.get('gamePin'))
        except Exception as e:
            logger.warning(f"Failed to poll games from {srv['server_id']}: {e}")
            continue

        # Find PINs mapped to this server that no longer exist on it
        mapped_pins = pin_registry.get_pins_for_server(srv['server_id'])
        for pin in mapped_pins:
            if pin not in active_pins_on_server:
                pin_registry.remove(pin)
                logger.info(f"Removed stale PIN {pin} (no longer on {srv['server_id']})")
