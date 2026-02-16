"""
Navigation routes for QuizNGO Quiz Server.
Handles slide navigation, click actions, and animation reset.

NEW ARCHITECTURE:
- gamePin is the PRIMARY identifier (6 digits, generated in Add-in)
- hashId is REMOVED from the system
"""

import re
import time
from flask import Blueprint, request, jsonify

from utils.room_utils import emit_to_room, check_game_active


def create_navigation_routes(socketio, game, game_sessions, client_rooms):
    """
    Create navigation routes blueprint.
    
    Args:
        socketio: Flask-SocketIO instance
        game: GameManager instance
        game_sessions: Dict of active game sessions (keyed by gamePin)
        client_rooms: Dict mapping socket ID to gamePin
    
    Returns:
        Blueprint with navigation routes
    """
    navigation_bp = Blueprint('navigation', __name__)

    def handle_next_slide():
        """Handle next slide navigation - called from main API handler"""
        try:
            # Get game_pin from request (sent by admin)
            game_pin = request.args.get('game_pin')
            
            if not game_pin:
                game.log('⚠️ Next slide request without game_pin - broadcasting to all')
                # Fallback: broadcast to all if no game_pin
                slide_command = {
                    'action': 'go_to_next_slide',
                    'timestamp': time.time()
                }
                socketio.emit('slide_navigation', slide_command)
                
                return jsonify({
                    'status': 'success',
                    'message': 'Next slide command sent to all clients',
                    'action': 'go_to_next_slide'
                })
            
            # Validate and sanitize game_pin (6 digits)
            game_pin = re.sub(r'[^0-9]', '', game_pin)
            
            if len(game_pin) != 6:
                return jsonify({
                    'status': 'error',
                    'message': 'Game PIN must be 6 digits'
                }), 400
            
            # Check if game is active
            if not check_game_active(game_sessions, game_pin):
                game.log(f'⚠️ Next slide request for inactive game {game_pin}')
                return jsonify({
                    'status': 'warning',
                    'message': 'Game session is not active or has been closed',
                    'game_closed': True
                }), 200
            
            # Send WebSocket message ONLY to add-ins in this specific game room
            slide_command = {
                'action': 'go_to_next_slide',
                'timestamp': time.time(),
                'gamePin': game_pin
            }
            
            # Use emit_to_room to send only to clients in this game (room = gamePin)
            sent_count = emit_to_room(socketio, client_rooms, game.logger, 'slide_navigation', slide_command, game_pin)
            
            if sent_count > 0:
                game.log(f'✅ Next slide command sent to {sent_count} client(s) in game {game_pin}')
                return jsonify({
                    'status': 'success',
                    'message': f'Next slide command sent to {sent_count} client(s) in game {game_pin}',
                    'action': 'go_to_next_slide',
                    'gamePin': game_pin,
                    'clientsNotified': sent_count
                })
            else:
                game.log(f'⚠️ No clients found in game {game_pin}')
                return jsonify({
                    'status': 'warning',
                    'message': f'No clients connected to game {game_pin}',
                    'gamePin': game_pin
                }), 404
                
        except Exception as e:
            game.log(f'❌ Error in next_slide: {str(e)}')
            return jsonify({'status': 'error', 'message': str(e)}), 400

    def handle_click_action():
        """Handle click/spacebar simulation - called from main API handler"""
        try:
            game.log('Spacebar simulation request received')
            
            # Send WebSocket message to add-in to simulate spacebar press
            spacebar_command = {
                'action': 'simulate_click',
                'timestamp': time.time()
            }
            
            # Broadcast spacebar command to all connected clients
            socketio.emit('click_navigation', spacebar_command)
            
            game.log('Spacebar simulation command sent to add-in via WebSocket')
            
            return jsonify({
                'status': 'success',
                'message': 'Spacebar simulation command sent to add-in',
                'action': 'simulate_click'
            })
            
        except Exception as e:
            game.log(f'Error in click_action endpoint: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': f'Server error in click_action: {str(e)}'
            }), 500

    def handle_reset_animations():
        """Handle animation reset - called from main API handler"""
        try:
            game.log('Reset animations request received')
            
            # Send WebSocket message to add-in to reset animation state
            reset_command = {
                'action': 'reset_animations',
                'timestamp': time.time()
            }
            
            # Broadcast reset command to all connected clients
            socketio.emit('animation_reset', reset_command)
            
            game.log('Animation reset command sent to add-in via WebSocket')
            
            return jsonify({
                'status': 'success',
                'message': 'Animation reset command sent to add-in',
                'action': 'reset_animations'
            })
            
        except Exception as e:
            game.log(f'Error in reset_animations endpoint: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': f'Server error in reset_animations: {str(e)}'
            }), 500

    # Attach handlers to blueprint for access from main API handler
    navigation_bp.handle_next_slide = handle_next_slide
    navigation_bp.handle_click_action = handle_click_action
    navigation_bp.handle_reset_animations = handle_reset_animations

    return navigation_bp
