#!/usr/bin/env python3
"""QuizNGO Load Balancer Server"""

import sys
import os
import logging
import ssl
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
from utils.response_normalizer import normalize_flask_json_response

# --- Logging ---
LOG_DIR = Path(__file__).parent / 'logs'
LOG_DIR.mkdir(exist_ok=True)

LOG_LEVELS = {
    'quiet': logging.WARNING,
    'normal': logging.INFO,
    'verbose': logging.DEBUG
}

HIGH_VOLUME_LOG_PATTERNS = (
    'Assigned PIN ',
    'Removed stale PIN ',
    'removed (game ended on ',
    '/api/resolve',
)


class IgnoreHeartbeatAccessLog(logging.Filter):
    """Suppress noisy werkzeug access logs for internal heartbeat endpoint."""

    def filter(self, record):
        message = record.getMessage()
        return not ('/api/servers/' in message and '/heartbeat HTTP/' in message)


class HighVolumeLogFilter(logging.Filter):
    """Drop very noisy INFO/DEBUG records for quieter logs."""

    def __init__(self, verbosity):
        super().__init__()
        self.verbosity = verbosity

    def filter(self, record):
        if self.verbosity == 'verbose':
            return True
        if record.levelno >= logging.WARNING:
            return True
        message = record.getMessage()
        return not any(token in message for token in HIGH_VOLUME_LOG_PATTERNS)


def configure_logging(verbosity):
    verbosity = (verbosity or 'quiet').lower()
    if verbosity not in LOG_LEVELS:
        verbosity = 'quiet'

    logging.basicConfig(
        level=LOG_LEVELS[verbosity],
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(LOG_DIR / 'lb.log', encoding='utf-8'),
            logging.StreamHandler()
        ],
        force=True
    )

    root_logger = logging.getLogger()
    if verbosity in ('quiet', 'normal'):
        for handler in root_logger.handlers:
            handler.addFilter(IgnoreHeartbeatAccessLog())
            handler.addFilter(HighVolumeLogFilter(verbosity))

    third_party_level = logging.INFO if verbosity == 'verbose' else logging.WARNING
    logging.getLogger('werkzeug').setLevel(third_party_level)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    return verbosity


LOG_VERBOSITY = configure_logging(os.getenv('QUIZNGO_LB_LOG_VERBOSITY', 'quiet'))
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


@app.after_request
def normalize_message_fields(response):
    """Ensure API responses expose message/reason as structured objects."""
    return normalize_flask_json_response(response)


@app.route('/')
def index():
    servers = server_registry.get_all()
    active = sum(1 for s in servers if s['status'] == 'active')
    return {
        'status': 'ok',
        'service': 'quizngo-lb',
        'servers_total': len(servers),
        'servers_active': active,
        'active_pins': len(pin_registry.get_all())
    }


# --- Entry Point ---
PORT = 5000

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='QuizNGO Load Balancer')
    parser.add_argument('--port', type=int, default=PORT, help='Port to run on (default: 5000)')
    parser.add_argument(
        '--log-verbosity',
        choices=['quiet', 'normal', 'verbose'],
        default=LOG_VERBOSITY,
        help='Logging verbosity: quiet=warnings/errors only, normal=important info, verbose=debug'
    )
    parser.add_argument('--ssl', action='store_true', default=False, help='Enable HTTPS (default: disabled)')
    parser.add_argument('--no-ssl', dest='ssl', action='store_false', help='Disable HTTPS (default)')
    parser.add_argument('--cert-dir', type=str, default=None, help='Directory containing localhost.crt and localhost.key (default: ~/.office-addin-dev-certs)')
    args = parser.parse_args()
    LOG_VERBOSITY = configure_logging(args.log_verbosity)
    PORT = args.port

    # Start background tasks
    start_health_checker(server_registry, pin_registry, interval=60)
    start_stale_cleanup(server_registry, pin_registry, interval=600)

    cert_dir = Path(args.cert_dir) if args.cert_dir else Path.home() / '.office-addin-dev-certs'
    protocol = 'https' if args.ssl else 'http'
    logger.info(
        f"Starting QuizNGO Load Balancer on {protocol}://0.0.0.0:{PORT} "
        f"(SSL: {'enabled' if args.ssl else 'disabled'}, log: {LOG_VERBOSITY})"
    )

    if args.ssl:
        ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_ctx.load_cert_chain(
            certfile=str(cert_dir / 'localhost.crt'),
            keyfile=str(cert_dir / 'localhost.key')
        )
        app.run(host='0.0.0.0', port=PORT, debug=False, threaded=True, ssl_context=ssl_ctx)
    else:
        app.run(host='0.0.0.0', port=PORT, debug=False, threaded=True)
