"""Bearer-token sessions stored in SQLite."""

import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import g, request

from db import get_db, now_iso
from utils.response import error

SESSION_DAYS = 30


def _iso(dt):
    return dt.isoformat(timespec='seconds').replace('+00:00', 'Z')


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    db = get_db()
    db.execute(
        'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
        (token, user_id, _iso(now), _iso(now + timedelta(days=SESSION_DAYS))),
    )
    db.commit()
    return token


def delete_session(token):
    db = get_db()
    db.execute('DELETE FROM sessions WHERE token = ?', (token,))
    db.commit()


def _bearer_token():
    header = request.headers.get('Authorization', '')
    if header.lower().startswith('bearer '):
        return header[7:].strip()
    return None


def resolve_user(token):
    if not token:
        return None
    db = get_db()
    row = db.execute(
        """
        SELECT u.id, u.email, u.name, u.provider, u.created_at, s.expires_at
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
        """,
        (token,),
    ).fetchone()
    if row is None:
        return None
    if row['expires_at'] < now_iso():
        delete_session(token)
        return None
    return {
        'id': row['id'],
        'email': row['email'],
        'name': row['name'],
        'provider': row['provider'],
        'createdAt': row['created_at'],
    }


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _bearer_token()
        user = resolve_user(token)
        if user is None:
            return error('Authentication required', 401)
        g.user = user
        g.token = token
        return fn(*args, **kwargs)

    return wrapper
