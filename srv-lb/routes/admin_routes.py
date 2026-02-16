import logging
from flask import Blueprint, jsonify

logger = logging.getLogger(__name__)


def create_admin_routes(server_registry, pin_registry):
    bp = Blueprint('admin', __name__)

    @bp.route('/api/admin/servers', methods=['GET'])
    def list_servers():
        """List all registered servers with their stats and active PINs."""
        servers = server_registry.get_all()
        for srv in servers:
            srv['active_pins'] = pin_registry.get_pins_for_server(srv['server_id'])
        return jsonify({'status': 'success', 'servers': servers})

    @bp.route('/api/admin/pins', methods=['GET'])
    def list_pins():
        """List all active PIN mappings."""
        pins = pin_registry.get_all()
        return jsonify({'status': 'success', 'pins': pins})

    @bp.route('/api/admin/servers/<server_id>/drain', methods=['POST'])
    def drain_server(server_id):
        """Mark a server as draining - no new games will be routed to it."""
        srv = server_registry.get(server_id)
        if not srv:
            return jsonify({'status': 'error', 'message': 'Server not found'}), 404

        server_registry.set_status(server_id, 'draining')
        active_pins = pin_registry.get_pins_for_server(server_id)
        logger.info(f"Server {server_id} marked as draining ({len(active_pins)} active pins)")

        return jsonify({
            'status': 'success',
            'message': 'Server marked as draining',
            'server_id': server_id,
            'active_pins_remaining': len(active_pins)
        })

    @bp.route('/api/admin/servers/<server_id>/activate', methods=['POST'])
    def activate_server(server_id):
        """Reactivate a drained or down server."""
        srv = server_registry.get(server_id)
        if not srv:
            return jsonify({'status': 'error', 'message': 'Server not found'}), 404

        server_registry.set_status(server_id, 'active')
        logger.info(f"Server {server_id} reactivated")

        return jsonify({'status': 'success', 'message': 'Server reactivated'})

    @bp.route('/api/admin/servers/<server_id>', methods=['DELETE'])
    def remove_server(server_id):
        """Remove a server from the registry entirely."""
        removed = server_registry.remove(server_id)
        if not removed:
            return jsonify({'status': 'error', 'message': 'Server not found'}), 404

        # Remove all PINs mapped to this server
        count = pin_registry.remove_all_for_server(server_id)
        logger.info(f"Server {server_id} removed ({count} PIN mappings cleared)")

        return jsonify({'status': 'success', 'message': 'Server removed'})

    return bp
