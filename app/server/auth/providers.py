"""
Authentication providers.

A provider turns a login payload into a verified identity ({email, name, provider}).
`DevProvider` trusts the submitted email/name (development only). An SSO provider (OIDC)
plugs in here later without touching the routes: implement `authenticate` and register it
in PROVIDERS, then set AUTH_PROVIDER=oidc.
"""

import os
import re


class AuthError(Exception):
    """Raised when a login payload cannot be authenticated."""


class AuthProvider:
    name = 'base'

    def authenticate(self, payload):  # pragma: no cover - interface
        raise NotImplementedError


EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


class DevProvider(AuthProvider):
    """Trusts the caller. Suitable for local development and closed pilots only."""

    name = 'dev'

    def authenticate(self, payload):
        email = str((payload or {}).get('email') or '').strip().lower()
        name = str((payload or {}).get('name') or '').strip()
        if not EMAIL_RE.match(email):
            raise AuthError('Invalid email address')
        if not name:
            name = email.split('@')[0]
        if len(name) > 60:
            name = name[:60]
        return {'email': email, 'name': name, 'provider': self.name}


class OIDCProvider(AuthProvider):
    """Placeholder for organization SSO. Expects an ID token / auth code in the payload."""

    name = 'oidc'

    def authenticate(self, payload):
        raise AuthError('SSO is not configured on this server yet')


PROVIDERS = {
    'dev': DevProvider,
    'oidc': OIDCProvider,
}


def get_provider():
    key = os.environ.get('AUTH_PROVIDER', 'dev').strip().lower()
    cls = PROVIDERS.get(key, DevProvider)
    return cls()
