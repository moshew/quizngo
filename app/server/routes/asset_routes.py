"""Image asset upload & serving."""

import re
import secrets

from flask import Blueprint, g, request, send_from_directory

from auth.session import require_auth
from db import ASSETS_DIR, get_db, now_iso
from utils.response import error, success

asset_bp = Blueprint('assets', __name__, url_prefix='/api/assets')

MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# Extension by verified MIME type (we never trust the client's declared type).
EXT_BY_MIME = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
}

SVG_DANGEROUS = re.compile(rb'<script|\son\w+\s*=|javascript:|<foreignObject|<iframe', re.IGNORECASE)


def _sniff_mime(head, full):
    if head.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if head.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if head.startswith((b'GIF87a', b'GIF89a')):
        return 'image/gif'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'image/webp'
    text = full[:4096].lstrip()
    if text.startswith((b'<?xml', b'<svg', b'<!--')) and b'<svg' in full[:65536].lower():
        return 'image/svg+xml'
    return None


def _dimensions(mime, data):
    if mime == 'image/svg+xml':
        return None, None
    try:
        from io import BytesIO
        from PIL import Image  # optional dependency
        with Image.open(BytesIO(data)) as img:
            return img.width, img.height
    except Exception:  # noqa: BLE001 - dimensions are best-effort
        return None, None


@asset_bp.route('', methods=['POST'])
@require_auth
def upload_asset():
    file = request.files.get('file')
    if file is None:
        return error('Missing file', 400)

    data = file.read()
    if not data:
        return error('Empty file', 400)
    if len(data) > MAX_UPLOAD_BYTES:
        return error('File is too large (max 10MB)', 413)

    mime = _sniff_mime(data[:16], data)
    if mime is None:
        return error('Unsupported file type', 415)
    if mime == 'image/svg+xml' and SVG_DANGEROUS.search(data):
        return error('SVG contains disallowed content', 415)

    asset_id = secrets.token_hex(12)
    ext = EXT_BY_MIME[mime]
    filename = f'{asset_id}.{ext}'
    (ASSETS_DIR / filename).write_bytes(data)

    width, height = _dimensions(mime, data)
    db = get_db()
    db.execute(
        'INSERT INTO assets (id, owner_id, filename, mime, size, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (asset_id, g.user['id'], filename, mime, len(data), width, height, now_iso()),
    )
    db.commit()

    return success(asset={
        'id': asset_id,
        'url': f'/api/assets/{asset_id}',
        'mime': mime,
        'size': len(data),
        'width': width,
        'height': height,
    }), 201


@asset_bp.route('/<asset_id>', methods=['GET'])
def serve_asset(asset_id):
    if not re.fullmatch(r'[0-9a-f]{24}', asset_id or ''):
        return error('Asset not found', 404)
    row = get_db().execute('SELECT filename, mime FROM assets WHERE id = ?', (asset_id,)).fetchone()
    if row is None:
        return error('Asset not found', 404)
    response = send_from_directory(ASSETS_DIR, row['filename'], mimetype=row['mime'], conditional=True)
    response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    if row['mime'] == 'image/svg+xml':
        response.headers['Content-Security-Policy'] = "script-src 'none'"
    return response
