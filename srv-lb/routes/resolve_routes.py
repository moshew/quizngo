import logging
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)


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
            return jsonify({
                'status': 'success',
                'game_pin': game_pin,
                'server_url': existing['server_address']
            })

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
                'server_url': existing['server_address']
            })

        logger.info(f"Assigned PIN {game_pin} to server {server['server_id']} ({server['address']})")
        return jsonify({
            'status': 'success',
            'game_pin': game_pin,
            'server_url': server['address']
        })

    @bp.route('/api/resolve/<game_pin>', methods=['GET'])
    def resolve_pin(game_pin):
        """Resolve a PIN to its server URL (called by game/admin/sim)."""
        mapping = pin_registry.resolve(game_pin)
        if not mapping:
            return jsonify({'status': 'error', 'message': 'Game PIN not found'}), 404

        return jsonify({
            'status': 'success',
            'game_pin': game_pin,
            'server_url': mapping['server_address']
        })

    return bp
