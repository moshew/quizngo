import time
import uuid
import threading


class ServerRegistry:
    """Manages registered srv instances and their health/stats."""

    HEARTBEAT_TIMEOUT = 90  # seconds before considering a server unhealthy

    def __init__(self):
        self.servers = {}  # server_id -> server_info
        self._lock = threading.Lock()

    def register(self, address):
        """Register a new srv instance. Returns server_id."""
        with self._lock:
            # Check if this address is already registered
            for sid, info in self.servers.items():
                if info['address'] == address:
                    info['last_heartbeat'] = time.time()
                    if info['status'] == 'down':
                        info['status'] = 'active'
                    return sid

            server_id = f"srv-{uuid.uuid4().hex[:6]}"
            self.servers[server_id] = {
                'server_id': server_id,
                'address': address,
                'registered_at': time.time(),
                'last_heartbeat': time.time(),
                'status': 'active',
                'stats': {
                    'active_ws_connections': 0,
                    'cpu_percent': 0.0,
                    'memory_mb': 0.0,
                    'active_games_count': 0
                }
            }
            return server_id

    def update_heartbeat(self, server_id, stats):
        """Update stats from a heartbeat push."""
        with self._lock:
            if server_id not in self.servers:
                return False
            srv = self.servers[server_id]
            srv['last_heartbeat'] = time.time()
            srv['stats'].update(stats)
            # If server was down and heartbeat resumed, restore it
            if srv['status'] == 'down':
                srv['status'] = 'active'
            return True

    def select_server(self):
        """Pick the least-loaded active and healthy server."""
        with self._lock:
            candidates = [
                s for s in self.servers.values()
                if s['status'] == 'active' and self._is_healthy(s)
            ]
            if not candidates:
                return None
            candidates.sort(key=lambda s: (
                s['stats'].get('active_games_count', 0),
                s['stats'].get('active_ws_connections', 0)
            ))
            return dict(candidates[0])  # return a copy

    def set_status(self, server_id, status):
        """Set server status: 'active', 'draining', or 'down'."""
        with self._lock:
            if server_id not in self.servers:
                return False
            self.servers[server_id]['status'] = status
            return True

    def get(self, server_id):
        """Get a single server's info."""
        with self._lock:
            if server_id in self.servers:
                return dict(self.servers[server_id])
            return None

    def get_all(self):
        """Get list of all servers (copies)."""
        with self._lock:
            return [dict(s) for s in self.servers.values()]

    def remove(self, server_id):
        """Remove a server from registry."""
        with self._lock:
            return self.servers.pop(server_id, None) is not None

    def check_health(self):
        """Mark servers as down if heartbeat timed out. Returns list of newly-downed server_ids."""
        downed = []
        with self._lock:
            now = time.time()
            for sid, srv in self.servers.items():
                if srv['status'] != 'down' and not self._is_healthy_at(srv, now):
                    srv['status'] = 'down'
                    downed.append(sid)
        return downed

    def _is_healthy(self, server):
        return self._is_healthy_at(server, time.time())

    def _is_healthy_at(self, server, now):
        return (now - server['last_heartbeat']) < self.HEARTBEAT_TIMEOUT
