"""Quiz CRUD. The quiz document is an opaque JSON blob (`data`) owned by the client schema;
the server derives a few list-level fields (counts, cover slide, template) for the gallery."""

import secrets

from flask import Blueprint, g, request

from auth.session import require_auth
from db import dumps, get_db, loads, now_iso
from utils.response import error, success

quiz_bp = Blueprint('quizzes', __name__, url_prefix='/api/quizzes')

MAX_DATA_BYTES = 6 * 1024 * 1024
MAX_TITLE_LEN = 140


def _derive_meta(data):
    slides = data.get('slides') if isinstance(data, dict) else None
    if not isinstance(slides, list):
        slides = []
    question_count = sum(1 for s in slides if isinstance(s, dict) and s.get('type') == 'question')
    cover = slides[0] if slides and isinstance(slides[0], dict) else None
    template_id = data.get('templateId') if isinstance(data, dict) else None
    return {
        'slide_count': len(slides),
        'question_count': question_count,
        'cover': cover,
        'template_id': template_id,
    }


def _row_to_meta(row, include_data=False):
    quiz = {
        'id': row['id'],
        'title': row['title'],
        'templateId': row['template_id'],
        'slideCount': row['slide_count'],
        'questionCount': row['question_count'],
        'revision': row['revision'],
        'owner': {'id': row['owner_id'], 'name': row['owner_name']},
        'updatedBy': {'id': row['updated_by'], 'name': row['updated_by_name']} if row['updated_by'] else None,
        'createdAt': row['created_at'],
        'updatedAt': row['updated_at'],
        'cover': loads(row['cover']),
    }
    if include_data:
        quiz['data'] = loads(row['data'], {})
    return quiz


_SELECT = """
SELECT q.*, o.name AS owner_name, ub.name AS updated_by_name
FROM quizzes q
JOIN users o ON o.id = q.owner_id
LEFT JOIN users ub ON ub.id = q.updated_by
"""


def _fetch(quiz_id):
    return get_db().execute(_SELECT + ' WHERE q.id = ? AND q.deleted_at IS NULL', (quiz_id,)).fetchone()


def _validate_title(title, fallback):
    title = str(title if title is not None else fallback or '').strip()
    return title[:MAX_TITLE_LEN] or fallback or 'Untitled'


def _validate_data(data):
    if not isinstance(data, dict):
        raise ValueError('data must be an object')
    encoded = dumps(data)
    if len(encoded.encode('utf-8')) > MAX_DATA_BYTES:
        raise ValueError('Quiz document is too large')
    return data, encoded


@quiz_bp.route('', methods=['GET'])
@require_auth
def list_quizzes():
    rows = get_db().execute(_SELECT + ' WHERE q.deleted_at IS NULL ORDER BY q.updated_at DESC').fetchall()
    return success(quizzes=[_row_to_meta(r) for r in rows])


@quiz_bp.route('', methods=['POST'])
@require_auth
def create_quiz():
    body = request.get_json(silent=True) or {}
    try:
        data, encoded = _validate_data(body.get('data'))
    except ValueError as exc:
        return error(str(exc), 400)

    title = _validate_title(body.get('title'), data.get('title'))
    data['title'] = title
    encoded = dumps(data)
    meta = _derive_meta(data)
    quiz_id = secrets.token_hex(6)
    now = now_iso()
    db = get_db()
    db.execute(
        """
        INSERT INTO quizzes (id, owner_id, updated_by, title, data, revision, slide_count, question_count,
                             template_id, cover, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        """,
        (
            quiz_id, g.user['id'], g.user['id'], title, encoded,
            meta['slide_count'], meta['question_count'], meta['template_id'], dumps(meta['cover']), now, now,
        ),
    )
    db.commit()
    return success(quiz=_row_to_meta(_fetch(quiz_id), include_data=True)), 201


@quiz_bp.route('/<quiz_id>', methods=['GET'])
@require_auth
def get_quiz(quiz_id):
    row = _fetch(quiz_id)
    if row is None:
        return error('Quiz not found', 404)
    return success(quiz=_row_to_meta(row, include_data=True))


@quiz_bp.route('/<quiz_id>', methods=['PUT'])
@require_auth
def update_quiz(quiz_id):
    row = _fetch(quiz_id)
    if row is None:
        return error('Quiz not found', 404)

    body = request.get_json(silent=True) or {}
    client_revision = body.get('revision')
    force = bool(body.get('force'))
    if client_revision is not None and not force and int(client_revision) != row['revision']:
        return error('conflict', 409, quiz=_row_to_meta(row, include_data=True))

    current = loads(row['data'], {})
    if 'data' in body and body['data'] is not None:
        try:
            data, _ = _validate_data(body['data'])
        except ValueError as exc:
            return error(str(exc), 400)
    else:
        data = current

    title = _validate_title(body.get('title'), data.get('title') or row['title'])
    data['title'] = title
    encoded = dumps(data)
    meta = _derive_meta(data)
    now = now_iso()
    db = get_db()
    db.execute(
        """
        UPDATE quizzes SET title = ?, data = ?, revision = revision + 1, slide_count = ?, question_count = ?,
                           template_id = ?, cover = ?, updated_at = ?, updated_by = ?
        WHERE id = ?
        """,
        (
            title, encoded, meta['slide_count'], meta['question_count'], meta['template_id'],
            dumps(meta['cover']), now, g.user['id'], quiz_id,
        ),
    )
    db.commit()
    return success(quiz=_row_to_meta(_fetch(quiz_id), include_data=False))


@quiz_bp.route('/<quiz_id>', methods=['DELETE'])
@require_auth
def delete_quiz(quiz_id):
    row = _fetch(quiz_id)
    if row is None:
        return error('Quiz not found', 404)
    db = get_db()
    db.execute('UPDATE quizzes SET deleted_at = ?, updated_by = ? WHERE id = ?', (now_iso(), g.user['id'], quiz_id))
    db.commit()
    return success()


@quiz_bp.route('/<quiz_id>/duplicate', methods=['POST'])
@require_auth
def duplicate_quiz(quiz_id):
    row = _fetch(quiz_id)
    if row is None:
        return error('Quiz not found', 404)
    data = loads(row['data'], {})
    body = request.get_json(silent=True) or {}
    title = _validate_title(body.get('title'), f"{row['title']} (copy)")
    data['title'] = title
    new_id = secrets.token_hex(6)
    now = now_iso()
    db = get_db()
    db.execute(
        """
        INSERT INTO quizzes (id, owner_id, updated_by, title, data, revision, slide_count, question_count,
                             template_id, cover, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id, g.user['id'], g.user['id'], title, dumps(data),
            row['slide_count'], row['question_count'], row['template_id'], row['cover'], now, now,
        ),
    )
    db.commit()
    return success(quiz=_row_to_meta(_fetch(new_id), include_data=True)), 201
