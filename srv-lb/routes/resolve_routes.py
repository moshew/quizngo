import logging
from urllib.parse import urlparse
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)


def _get_srv_id(address):
    """Extract srv_id from server address (e.g. https://srv-01.quizngo.online → srv-01)."""
    hostname = urlparse(address).hostname or ''
    return hostname.split('.')[0]


def create_resolve_routes(server_registry, pin_registry):
    bp = Blueprint('resolve', __name__)

    @bp.route('/api/resolve', methods=['POST'])
    def assign_server():
        """Assign a server to a new game PIN (called by add-in)."""
        data = request.get_json()
        if not data or 'game_pin' not in data:
            return jsonify({'status': 'error', 'message': 'game_pin is required'}), 400

        game_pin = str(data['game_pin'])

        # Check if PIN is already assigned
        existing = pin_registry.resolve(game_pin)
        if existing:
            # Verify the server is still active/healthy
            server = server_registry.get(existing['server_id'])
            if server and server['status'] in ('active', 'draining'):
                # Draining servers can still serve existing games, just not new ones
                return jsonify({
                    'status': 'success',
                    'game_pin': game_pin,
                    'server_url': existing['server_address'],
                    'srv_id': _get_srv_id(existing['server_address'])
                })
            else:
                # Server is down - remove stale mapping and assign new server
                logger.warning(f"Server {existing['server_id']} for PIN {game_pin} is {server['status'] if server else 'not found'} - removing mapping")
                pin_registry.remove(game_pin)
                # Continue to assign new server below

        # Select least-loaded server
        server = server_registry.select_server()
        if not server:
            logger.warning(f"No active servers available for PIN {game_pin}")
            return jsonify({'status': 'error', 'message': 'No active servers available'}), 503

        # Assign PIN to server
        assigned = pin_registry.assign(game_pin, server['server_id'], server['address'])
        if not assigned:
            # Race condition: PIN was assigned between check and assign
            existing = pin_registry.resolve(game_pin)
            return jsonify({
                'status': 'success',
                'game_pin': game_pin,
                'server_url': existing['server_address'],
                'srv_id': _get_srv_id(existing['server_address'])
            })

        logger.info(f"Assigned PIN {game_pin} to server {server['server_id']} ({server['address']})")
        return jsonify({
            'status': 'success',
            'game_pin': game_pin,
            'server_url': server['address'],
            'srv_id': _get_srv_id(server['address'])
        })

    @bp.route('/api/resolve/<game_pin>', methods=['GET'])
    def resolve_pin(game_pin):
        """Resolve a PIN to its server URL (called by game/admin/sim)."""
        mapping = pin_registry.resolve(game_pin)
        if not mapping:
            return jsonify({'status': 'error', 'message': 'Game PIN not found'}), 404

        # Check if the server is still active/healthy
        # Draining servers still serve existing games - only truly dead servers are rejected
        server = server_registry.get(mapping['server_id'])
        if not server or server['status'] not in ('active', 'draining'):
            # Server is down - remove the stale PIN mapping
            logger.warning(f"Server {mapping['server_id']} for PIN {game_pin} is {server['status'] if server else 'not found'} - removing mapping")
            pin_registry.remove(game_pin)
            return jsonify({'status': 'error', 'message': 'Game server is unavailable'}), 503

        return jsonify({
            'status': 'success',
            'game_pin': game_pin,
            'server_url': mapping['server_address']
        })

    return bp
