"""SQLite persistence for QuizNGO Studio (users, sessions, quizzes, assets)."""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import g

DATA_DIR = Path(__file__).resolve().parent / 'data'
ASSETS_DIR = DATA_DIR / 'assets'
DB_PATH = DATA_DIR / 'quizngo_app.db'

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    provider    TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS quizzes (
    id              TEXT PRIMARY KEY,
    owner_id        TEXT NOT NULL REFERENCES users(id),
    updated_by      TEXT REFERENCES users(id),
    title           TEXT NOT NULL,
    data            TEXT NOT NULL,
    revision        INTEGER NOT NULL DEFAULT 1,
    slide_count     INTEGER NOT NULL DEFAULT 0,
    question_count  INTEGER NOT NULL DEFAULT 0,
    template_id     TEXT,
    cover           TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    deleted_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_quizzes_updated ON quizzes(updated_at);

CREATE TABLE IF NOT EXISTS assets (
    id          TEXT PRIMARY KEY,
    owner_id    TEXT NOT NULL REFERENCES users(id),
    filename    TEXT NOT NULL,
    mime        TEXT NOT NULL,
    size        INTEGER NOT NULL,
    width       INTEGER,
    height      INTEGER,
    created_at  TEXT NOT NULL
);
"""


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute('PRAGMA journal_mode=WAL')
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def get_db():
    """Per-request connection stored on flask.g."""
    if 'db' not in g:
        conn = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA foreign_keys = ON')
        g.db = conn
    return g.db


def close_db(_exc=None):
    conn = g.pop('db', None)
    if conn is not None:
        conn.close()


def dumps(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def loads(text, default=None):
    if text is None:
        return default
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        return default
