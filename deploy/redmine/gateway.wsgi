"""Apache mod_wsgi HMAC gate. Configuration is read only on the server."""
from contextlib import closing
import hashlib
import hmac
import json
import re
import sqlite3
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

MAX_BODY = 10 * 1024 * 1024


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def allowed(method, path):
    if any(c in path for c in '\r\n\\#'):
        return False
    name = path.split('?')[0]
    decoded = urllib.parse.unquote(name)
    if any(c in decoded for c in '\r\n\\%#?') or any(part in ('.', '..') for part in decoded.split('/')):
        return False
    if method == 'GET':
        return bool(re.fullmatch(r'(users/current|projects|issue_statuses|enumerations/issue_priorities|trackers|issues)\.json|projects/[1-9]\d*/memberships\.json|issues/[1-9]\d*\.json', name) or
                    (re.fullmatch(r'attachments/download/[1-9]\d*(/[^/]+)?', name) and re.fullmatch(r'attachments/download/[1-9]\d*(/[^/]+)?', decoded)))
    if method == 'POST':
        return name in ('issues.json', 'uploads.json')
    return method == 'PUT' and bool(re.fullmatch(r'issues/[1-9]\d*\.json', name))


def canonical(method, path, timestamp, nonce, key, content_type, body):
    sha = lambda value: hashlib.sha256(value).hexdigest()
    return '\n'.join(('redmine-v1', method, path, timestamp, nonce, sha(key.encode()), sha(content_type.encode()), sha(body))).encode()


def application(environ, start_response):
    def respond(status, data, content_type='application/json'):
        start_response(status, [('Content-Type', content_type), ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff')])
        return [data]

    def error(status, message):
        return respond(status, json.dumps({'errors': [message]}).encode())

    try:
        with open('/etc/redmine-hmac.json', encoding='utf-8') as f:
            config = json.load(f)
        if len(config['secret']) < 32:
            return error('503 Service Unavailable', 'HMAC設定が不正です。')
        method = environ['REQUEST_METHOD']
        query = urllib.parse.parse_qs(environ.get('QUERY_STRING', ''), keep_blank_values=True)
        if set(query) != {'path'} or len(query['path']) != 1:
            return error('400 Bad Request', 'Invalid path')
        path = query['path'][0]
        if not allowed(method, path):
            return error('403 Forbidden', 'API not allowed')
        timestamp = environ.get('HTTP_X_REDMINE_TIMESTAMP', '')
        nonce = environ.get('HTTP_X_REDMINE_NONCE', '')
        signature = environ.get('HTTP_X_REDMINE_SIGNATURE', '')
        key = environ.get('HTTP_X_REDMINE_API_KEY', '')
        content_type = environ.get('CONTENT_TYPE', '')
        if not re.fullmatch(r'\d{10}', timestamp) or abs(time.time() - int(timestamp)) > 60 or not re.fullmatch(r'[a-f0-9-]{36}', nonce) or not key:
            return error('403 Forbidden', 'HMAC authentication failed')
        length = int(environ.get('CONTENT_LENGTH') or 0)
        if length < 0 or length > MAX_BODY:
            return error('413 Payload Too Large', 'Maximum request size is 10MiB')
        body = environ['wsgi.input'].read(length)
        if len(body) != length or (method == 'GET' and body):
            return error('400 Bad Request', 'Invalid body')
        expected = hmac.new(config['secret'].encode(), canonical(method, path, timestamp, nonce, key, content_type, body), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            return error('403 Forbidden', 'HMAC authentication failed')
        with closing(sqlite3.connect(config['nonce_db'], timeout=5)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS nonces (nonce TEXT PRIMARY KEY, expires INTEGER NOT NULL)')
            db.execute('DELETE FROM nonces WHERE expires < ?', (int(time.time()),))
            try:
                db.execute('INSERT INTO nonces VALUES (?, ?)', (nonce, int(timestamp) + 120))
            except sqlite3.IntegrityError:
                return error('403 Forbidden', 'HMAC request already used')
        upstream = config['upstream'].rstrip('/') + '/' + path
        headers = {'X-Redmine-API-Key': key}
        if content_type:
            headers['Content-Type'] = content_type
        req = urllib.request.Request(upstream, data=None if method == 'GET' else body, headers=headers, method=method)
        handlers = [NoRedirect()]
        if config.get('upstream_ca'):
            handlers.append(urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile=config['upstream_ca'])))
        opener = urllib.request.build_opener(*handlers)
        try:
            response = opener.open(req, timeout=25)
        except urllib.error.HTTPError as e:
            response = e
        with response:
            if 300 <= response.code < 400:
                return error('502 Bad Gateway', 'Redmine upstream redirected; check upstream URL')
            payload = response.read(MAX_BODY + 1)
            if len(payload) > MAX_BODY:
                return error('502 Bad Gateway', 'Response exceeds 10MiB')
            status = str(response.code) + ' ' + __import__('http.client', fromlist=['responses']).responses.get(response.code, 'Unknown')
            return respond(status, payload, response.headers.get('Content-Type', 'application/octet-stream'))
    except Exception:
        # Never log credentials, signature, or upstream response bodies.
        return error('502 Bad Gateway', 'Apache HMAC gateway configuration or upstream connection failed')
