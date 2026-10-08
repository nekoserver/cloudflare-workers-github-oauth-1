import hashlib
import hmac
import importlib.machinery
import importlib.util
import io
import json
import tempfile
import time
import unittest
from unittest.mock import patch
from pathlib import Path

loader = importlib.machinery.SourceFileLoader('gateway', str(Path(__file__).with_name('gateway.wsgi')))
spec = importlib.util.spec_from_loader(loader.name, loader)
gateway = importlib.util.module_from_spec(spec)
loader.exec_module(gateway)


class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.config = {'secret': 'test-secret-with-at-least-32-chars', 'upstream': 'http://127.0.0.1:3000/redmine', 'nonce_db': self.temp.name + '/nonces.db'}
        real_open = open
        def config_open(name, *args, **kwargs):
            return io.StringIO(json.dumps(self.config)) if name == '/etc/redmine-hmac.json' else real_open(name, *args, **kwargs)
        self.patcher = patch('builtins.open', config_open)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def request(self, **changes):
        timestamp = str(int(time.time()))
        nonce = '12345678-1234-1234-1234-123456789abc'
        body = b''
        signature = hmac.new(self.config['secret'].encode(), gateway.canonical('GET', 'projects.json', timestamp, nonce, 'key', '', body), hashlib.sha256).hexdigest()
        environ = {'REQUEST_METHOD': 'GET', 'QUERY_STRING': 'path=projects.json', 'HTTP_X_REDMINE_TIMESTAMP': timestamp, 'HTTP_X_REDMINE_NONCE': nonce, 'HTTP_X_REDMINE_SIGNATURE': signature, 'HTTP_X_REDMINE_API_KEY': 'key', 'CONTENT_LENGTH': '0', 'wsgi.input': io.BytesIO(body)}
        environ.update(changes)
        result = []
        payload = gateway.application(environ, lambda status, headers: result.append((status, headers)))
        return result[0][0], b''.join(payload)

    def test_cross_language_vector(self):
        raw = gateway.canonical('POST', 'issues.json', '1791475200', '12345678-1234-1234-1234-123456789abc', 'api-key', 'application/json', '{"issue":{"subject":"日本語"}}'.encode())
        self.assertEqual(hmac.new(self.config['secret'].encode(), raw, hashlib.sha256).hexdigest(), '8ec0ed783c95d470e079a1d2d6a40afbc9579023f6426881aca5d9c046386cae')

    def test_rejects_tampered_key_path_and_missing_signature(self):
        for change in ({'HTTP_X_REDMINE_API_KEY': 'other'}, {'QUERY_STRING': 'path=issues.json'}, {'HTTP_X_REDMINE_SIGNATURE': ''}, {'QUERY_STRING': 'path=../projects.json'}):
            with patch.object(gateway.urllib.request, 'build_opener') as upstream:
                self.assertTrue(self.request(**change)[0].startswith('403'))
                upstream.assert_not_called()

    def test_expired_request(self):
        self.assertTrue(self.request(HTTP_X_REDMINE_TIMESTAMP=str(int(time.time()) - 120))[0].startswith('403'))

    def test_valid_request_and_replay(self):
        class Response:
            code = 200
            headers = {'Content-Type': 'application/json'}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return b'{"projects":[]}'
        with patch.object(gateway.urllib.request, 'build_opener') as upstream:
            upstream.return_value.open.return_value = Response()
            self.assertEqual(self.request()[0], '200 OK')
            req = upstream.return_value.open.call_args.args[0]
            self.assertEqual(req.full_url, 'http://127.0.0.1:3000/redmine/projects.json')
            self.assertEqual(req.get_header('X-redmine-api-key'), 'key')
            self.assertTrue(self.request()[0].startswith('403'))
            self.assertEqual(upstream.call_count, 1)


if __name__ == '__main__':
    unittest.main()
