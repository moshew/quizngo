import logging
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)


def create_registration_routes(server_registry, pin_registry):
    bp = Blueprint('registration', __name__)

    @bp.route('/api/servers/register', methods=['POST'])
    def register_server():
        """Register a new srv instance with the LB."""
        data = request.get_json()
        if not data or 'address' not in data:
            return jsonify({'status': 'error', 'message': 'address is required'}), 400

        address = data['address'].rstrip('/')
        server_id = server_registry.register(address)
        logger.info(f"Server registered: {server_id} at {address}")

        return jsonify({
            'status': 'success',
            'server_id': server_id,
            'message': 'Server registered successfully'
        })

    @bp.route('/api/servers/<server_id>/heartbeat', methods=['POST'])
    def heartbeat(server_id):
        """Receive stats push from a srv instance."""
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'Stats data required'}), 400

        success = server_registry.update_heartbeat(server_id, data)
        if not success:
            return jsonify({'status': 'error', 'message': 'Server not found'}), 404

        return jsonify({'status': 'success', 'message': 'Heartbeat received'})

    @bp.route('/api/servers/<server_id>/game-ended', methods=['POST'])
    def game_ended(server_id):
        """Notification from srv that a game has ended."""
        data = request.get_json()
        if not data or 'game_pin' not in data:
            return jsonify({'status': 'error', 'message': 'game_pin is required'}), 400

        game_pin = str(data['game_pin'])
        removed = pin_registry.remove(game_pin)
        if removed:
            logger.info(f"PIN {game_pin} removed (game ended on {server_id})")
        else:
            logger.debug(f"PIN {game_pin} not found (already removed or never assigned)")

        return jsonify({'status': 'success', 'message': 'PIN mapping removed'})

    return bp
