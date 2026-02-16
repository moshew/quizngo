#!/usr/bin/env python3
"""Kahoot Load Balancer Server"""

import eventlet
eventlet.monkey_patch()

import sys
import logging
from pathlib import Path

from flask import Flask
from flask_cors import CORS

# Ensure local imports work
sys.path.insert(0, str(Path(__file__).parent))

from models.server_registry import ServerRegistry
from models.pin_registry import PinRegistry
from routes.resolve_routes import create_resolve_routes
from routes.registration_routes import create_registration_routes
from routes.admin_routes import create_admin_routes
from utils.scheduler import start_health_checker, start_stale_cleanup

# --- Logging ---
LOG_DIR = Path(__file__).parent / 'logs'
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'lb.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# --- Flask App ---
app = Flask(__name__)
CORS(app, origins="*")

# --- Registries ---
server_registry = ServerRegistry()
pin_registry = PinRegistry()

# --- Register Blueprints ---
app.register_blueprint(create_resolve_routes(server_registry, pin_registry))
app.register_blueprint(create_registration_routes(server_registry, pin_registry))
app.register_blueprint(create_admin_routes(server_registry, pin_registry))


@app.route('/')
def index():
    servers = server_registry.get_all()
    active = sum(1 for s in servers if s['status'] == 'active')
    return {
        'status': 'ok',
        'service': 'kahoot-lb',
        'servers_total': len(servers),
        'servers_active': active,
        'active_pins': len(pin_registry.get_all())
    }


# --- Entry Point ---
PORT = 5000

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Kahoot Load Balancer')
    parser.add_argument('--port', type=int, default=PORT, help='Port to run on (default: 5000)')
    args = parser.parse_args()
    PORT = args.port

    # Start background tasks
    start_health_checker(server_registry, interval=60)
    start_stale_cleanup(server_registry, pin_registry, interval=600)

    logger.info(f"Starting Kahoot Load Balancer on port {PORT}")
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', PORT)), app, log=logger)
