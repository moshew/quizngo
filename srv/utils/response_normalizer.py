"""Normalize API payloads so `message`/`reason` are structured objects."""

import json
import re


_DYNAMIC_MESSAGE_PATTERNS = (
    (re.compile(r'^The name "(?P<name>.+)" is already in use\.$'), 'NAME_ALREADY_IN_USE'),
    (re.compile(r'^No active game found with PIN (?P<gamePin>\d+)$'), 'NO_ACTIVE_GAME_FOUND_WITH_PIN'),
    (re.compile(r'^Sent to (?P<count>\d+) player\(s\)$'), 'SENT_TO_PLAYERS'),
    (re.compile(r'^Results sent to (?P<count>\d+) player\(s\)$'), 'RESULTS_SENT_TO_PLAYERS'),
    (
        re.compile(r'^Next slide command sent to (?P<count>\d+) client\(s\) in game (?P<gamePin>\d+)$'),
        'NEXT_SLIDE_SENT_TO_CLIENTS',
    ),
    (re.compile(r'^No clients connected to game (?P<gamePin>\d+)$'), 'NO_CLIENTS_CONNECTED_TO_GAME'),
    (re.compile(r'^Game closed due to (?P<reason>[A-Za-z0-9_ -]+)$'), 'GAME_CLOSED'),
    (re.compile(r'^Server error(?: in [a-z_]+)?: .+$'), 'SERVER_ERROR'),
    (re.compile(r'^Error: .+$'), 'SERVER_ERROR'),
)

_REASON_ALIASES = {
    'manual': 'MANUAL',
    'timeout': 'TIMEOUT',
    'addin_closed': 'ADDIN_CLOSED',
    'new_session': 'NEW_SESSION',
    'cleanup': 'CLEANUP',
    'websocket_disconnect': 'WEBSOCKET_DISCONNECT',
}


def _to_code(value):
    code = re.sub(r'[^A-Za-z0-9]+', '_', str(value or '').strip()).strip('_').upper()
    if not code:
        return 'UNKNOWN_MESSAGE'
    return code[:120]


def _normalize_message(value):
    if isinstance(value, dict):
        return normalize_payload(value)
    if not isinstance(value, str):
        return {'code': 'UNKNOWN_MESSAGE'}

    text = value.strip()
    if not text:
        return {'code': 'UNKNOWN_MESSAGE'}

    for pattern, code in _DYNAMIC_MESSAGE_PATTERNS:
        match = pattern.match(text)
        if not match:
            continue

        params = {k: v for k, v in match.groupdict().items() if v is not None and k != 'detail'}
        if params:
            return {'code': code, 'params': params}
        return {'code': code}

    return {'code': _to_code(text)}


def _normalize_reason(value):
    if isinstance(value, dict):
        return normalize_payload(value)
    if not isinstance(value, str):
        return {'code': 'UNKNOWN_REASON'}

    key = value.strip().lower().replace(' ', '_')
    code = _REASON_ALIASES.get(key, _to_code(value))
    return {'code': code}


def normalize_payload(payload):
    """Recursively normalize message/reason fields in JSON-like payloads."""
    if isinstance(payload, list):
        return [normalize_payload(item) for item in payload]

    if isinstance(payload, dict):
        normalized = {}
        for key, value in payload.items():
            if key == 'message':
                normalized[key] = _normalize_message(value)
            elif key == 'reason':
                normalized[key] = _normalize_reason(value)
            else:
                normalized[key] = normalize_payload(value)
        return normalized

    return payload


def normalize_flask_json_response(response):
    """Normalize Flask JSON response payload in-place and return response."""
    try:
        if not response.is_json:
            return response

        payload = response.get_json(silent=True)
        if payload is None:
            return response

        normalized = normalize_payload(payload)
        if normalized != payload:
            response.set_data(json.dumps(normalized, ensure_ascii=False))
            response.headers['Content-Length'] = str(len(response.get_data()))
    except Exception:
        return response

    return response

