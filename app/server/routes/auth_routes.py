"""Auth routes: login / me / logout."""

import secrets

from flask import Blueprint, g, request

from auth.providers import AuthError, get_provider
from auth.session import create_session, delete_session, require_auth
from db import get_db, now_iso
from utils.response import error, success

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _upsert_user(identity):
    db = get_db()
    row = db.execute('SELECT * FROM users WHERE email = ?', (identity['email'],)).fetchone()
    if row is None:
        user_id = 'u_' + secrets.token_hex(6)
        db.execute(
            'INSERT INTO users (id, email, name, provider, created_at) VALUES (?, ?, ?, ?, ?)',
            (user_id, identity['email'], identity['name'], identity['provider'], now_iso()),
        )
    else:
        user_id = row['id']
        # Keep the display name fresh (the dev provider lets people change it at login).
        db.execute('UPDATE users SET name = ?, provider = ? WHERE id = ?', (identity['name'], identity['provider'], user_id))
    db.commit()
    row = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    return {
        'id': row['id'],
        'email': row['email'],
        'name': row['name'],
        'provider': row['provider'],
        'createdAt': row['created_at'],
    }


@auth_bp.route('/login', methods=['POST'])
def login():
    payload = request.get_json(silent=True) or {}
    provider = get_provider()
    try:
        identity = provider.authenticate(payload)
    except AuthError as exc:
        return error(str(exc), 401)
    user = _upsert_user(identity)
    token = create_session(user['id'])
    return success(token=token, user=user, provider=provider.name)


@auth_bp.route('/me', methods=['GET'])
@require_auth
def me():
    return success(user=g.user)


@auth_bp.route('/logout', methods=['POST'])
@require_auth
def logout():
    delete_session(g.token)
    return success()


@auth_bp.route('/provider', methods=['GET'])
def provider_info():
    return success(provider=get_provider().name)
