#!/usr/bin/env python3
"""
QuizNGO Studio API server (Flask + SQLite).

Stores quizzes, image assets and users for the web editor in `app/`.
Default port 5020; nginx/Vite proxy `/api` here. See ../SPEC.md section 10 for the API contract.
"""

import argparse
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from flask import Flask
from flask_cors import CORS

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db import close_db, init_db  # noqa: E402
from routes.asset_routes import asset_bp  # noqa: E402
from routes.auth_routes import auth_bp  # noqa: E402
from routes.quiz_routes import quiz_bp  # noqa: E402
from utils.response import error, success  # noqa: E402

LOG_DIR = Path(__file__).resolve().parent / 'logs'
DEFAULT_ORIGINS = [
    'http://localhost:3004',
    'http://127.0.0.1:3004',
    'https://quizngo.online',
    'https://app.quizngo.online',
]


def _configure_logging():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(LOG_DIR / 'app.log', maxBytes=2_000_000, backupCount=3, encoding='utf-8')
    fmt = logging.Formatter('%(asctime)s %(levelname)s %(name)s: %(message)s')
    handler.setFormatter(fmt)
    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(fmt)
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers = [handler, stream]


def create_app():
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024
    app.config['JSON_SORT_KEYS'] = False
    app.json.ensure_ascii = False

    origins = [o.strip() for o in os.environ.get('APP_ALLOWED_ORIGINS', ','.join(DEFAULT_ORIGINS)).split(',') if o.strip()]
    CORS(app, origins=origins, supports_credentials=False, allow_headers=['Content-Type', 'Authorization'])

    init_db()
    app.teardown_appcontext(close_db)

    app.register_blueprint(auth_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(asset_bp)

    @app.route('/api/health')
    def health():
        return success(service='quizngo-app-server', version='1.0.0')

    @app.errorhandler(404)
    def not_found(_e):
        return error('Not found', 404)

    @app.errorhandler(405)
    def not_allowed(_e):
        return error('Method not allowed', 405)

    @app.errorhandler(413)
    def too_large(_e):
        return error('Request is too large', 413)

    @app.errorhandler(500)
    def internal(_e):
        logging.getLogger(__name__).exception('Unhandled error')
        return error('Internal server error', 500)

    return app


def main():
    parser = argparse.ArgumentParser(description='QuizNGO Studio API server')
    parser.add_argument('--host', default=os.environ.get('APP_HOST', '127.0.0.1'))
    parser.add_argument('--port', type=int, default=int(os.environ.get('APP_PORT', '5020')))
    parser.add_argument('--debug', action='store_true')
    args = parser.parse_args()

    _configure_logging()
    app = create_app()
    logging.getLogger(__name__).info('QuizNGO Studio API listening on http://%s:%s (auth provider: %s)',
                                     args.host, args.port, os.environ.get('AUTH_PROVIDER', 'dev'))
    app.run(host=args.host, port=args.port, debug=args.debug, threaded=True)


if __name__ == '__main__':
    main()
