import time
import threading


class PinRegistry:
    """Manages game PIN -> server mappings."""

    def __init__(self):
        self.pin_map = {}  # game_pin -> mapping info
        self._lock = threading.Lock()

    def assign(self, game_pin, server_id, server_address):
        """Assign a PIN to a server. Returns True if assigned, False if PIN already exists."""
        with self._lock:
            if game_pin in self.pin_map:
                return False
            self.pin_map[game_pin] = {
                'game_pin': game_pin,
                'server_id': server_id,
                'server_address': server_address,
                'assigned_at': time.time()
            }
            return True

    def resolve(self, game_pin):
        """Resolve a PIN to its server info. Returns mapping dict or None."""
        with self._lock:
            mapping = self.pin_map.get(game_pin)
            return dict(mapping) if mapping else None

    def remove(self, game_pin):
        """Remove a PIN mapping. Returns True if existed."""
        with self._lock:
            return self.pin_map.pop(game_pin, None) is not None

    def remove_all_for_server(self, server_id):
        """Remove all PINs mapped to a specific server. Returns count removed."""
        with self._lock:
            to_remove = [pin for pin, m in self.pin_map.items() if m['server_id'] == server_id]
            for pin in to_remove:
                del self.pin_map[pin]
            return len(to_remove)

    def get_pins_for_server(self, server_id):
        """Get all PINs mapped to a server."""
        with self._lock:
            return [pin for pin, m in self.pin_map.items() if m['server_id'] == server_id]

    def get_all(self):
        """Get all PIN mappings (copies)."""
        with self._lock:
            return [dict(m) for m in self.pin_map.values()]
