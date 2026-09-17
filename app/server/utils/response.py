"""Normalized response helpers — same contract as the other QuizNGO services."""

from flask import jsonify


def success(**payload):
    body = {'status': 'success'}
    body.update(payload)
    return jsonify(body)


def error(message, code=400, **extra):
    body = {'status': 'error', 'message': message}
    body.update(extra)
    return jsonify(body), code
