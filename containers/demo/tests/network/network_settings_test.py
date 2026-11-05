"""Isolated checks for refresh failures and exported environment precedence."""
import base64
import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2] / 'lib-network'

class NetworkSettingsTest(unittest.TestCase):
    def test_cgi_keeps_current_signing_environment(self):
        script = (ROOT / 'network/tunnels.cgi').read_text()
        with tempfile.TemporaryDirectory() as directory:
            saved = Path(directory) / 'hmac.env'
            saved.write_text("ORIGIN_HMAC_SECRET='saved-test-secret'\n")
            script = script.replace('/etc/lib-hmac.env', str(saved))
            script = script.replace(
                'exec /usr/local/bin/ruby /var/www/html/lib/api/tunnels.rb',
                'printf "%s|%s" "${ORIGIN_HMAC_SECRET:-}" "${HMAC_SECRET:-}"')
            for current, expected in [
                ({'ORIGIN_HMAC_SECRET': 'current-origin'}, 'current-origin|'),
                ({'HMAC_SECRET': 'current-legacy'}, '|current-legacy'),
                ({}, 'saved-test-secret|'),
            ]:
                with self.subTest(current=current):
                    output = subprocess.check_output(
                        ['sh', '-c', script], env={'PATH': '/usr/bin:/bin', **current}, text=True)
                    self.assertEqual(output, expected)

    def refresh(self, env, response=None, error=None, active=False):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory) / 'tunnels.json'
            cache.write_text('previous valid cache')
            original_path = Path
            def path(value):
                if value == '/proc': return original_path(directory) / 'empty-proc'
                if value == '/var/cache/lib-api/tunnels.json': return cache
                return original_path(value)
            (Path(directory) / 'empty-proc').mkdir()
            if active:
                process = Path(directory) / 'empty-proc/123'
                process.mkdir()
                credential = base64.b64encode(json.dumps({'a':'account','t':'active-tunnel'}).encode())
                (process / 'cmdline').write_bytes(b'cloudflared\0tunnel\0run\0--token\0' + credential + b'\0')
            captured = []
            def request(req, timeout):
                captured.append(req.get_header('Authorization'))
                if error: raise error
                return contextlib.closing(io.StringIO(json.dumps(response)))
            with patch.dict(os.environ, env, clear=True), patch('pathlib.Path', side_effect=path), \
                 patch('fcntl.flock'), patch('builtins.open', return_value=io.StringIO()), \
                 patch('urllib.request.urlopen', side_effect=request):
                # pathlib uses io.open; builtins.open only supplies the private lock.
                try:
                    runpy.run_path(str(ROOT / 'refresh-tunnels.py'))
                    failed = False
                except (RuntimeError, OSError, SystemExit): failed = True
            return failed, cache.read_text(), captured

    def test_current_primary_token_wins(self):
        failed, data, requests = self.refresh({'CLOUDFLARE_ACCOUNT_ID':'account', 'CF_CONTAINER_API_TOKEN':'primary', 'CLOUDFLARE_API_TOKEN':'fallback'}, {'success':True,'result':[]})
        self.assertFalse(failed)
        self.assertEqual(requests, ['Bearer primary'])
        self.assertEqual(json.loads(data), [])

    def test_empty_primary_falls_back(self):
        failed, _, requests = self.refresh({'CLOUDFLARE_ACCOUNT_ID':'account','CF_CONTAINER_API_TOKEN':'','CLOUDFLARE_API_TOKEN':'fallback'}, {'success':True,'result':[]})
        self.assertFalse(failed)
        self.assertEqual(requests, ['Bearer fallback'])

    def test_transport_failure_preserves_cache(self):
        failed, data, _ = self.refresh({'CLOUDFLARE_ACCOUNT_ID':'account','CF_CONTAINER_API_TOKEN':'primary'},error=OSError('offline'))
        self.assertTrue(failed)
        self.assertEqual(data,'previous valid cache')

    def test_api_failure_preserves_cache(self):
        failed, data, _ = self.refresh({'CLOUDFLARE_ACCOUNT_ID':'account','CF_CONTAINER_API_TOKEN':'primary'}, {'success':False})
        self.assertTrue(failed)
        self.assertEqual(data,'previous valid cache')

    def test_incomplete_list_preserves_cache(self):
        failed, data, _ = self.refresh({'CLOUDFLARE_ACCOUNT_ID':'account','CF_CONTAINER_API_TOKEN':'primary'}, {'success':True,'result':[]}, active=True)
        self.assertTrue(failed)
        self.assertEqual(data,'previous valid cache')

    def test_stream_current_env_overrides_saved_defaults(self):
        script = (ROOT / 'network/start-lib-chat-streams').read_text()
        block = script[script.index('eval "$('):script.index('if [ -z ')]
        with tempfile.TemporaryDirectory() as directory:
            defaults = Path(directory) / 'chat.env'
            defaults.write_text("LIB_CHAT_ORIGINS='https://saved.example'\nORIGIN_HMAC_SECRET='saved-test-secret'\n")
            block = block.replace('/etc/lib-chat.env',str(defaults)).replace('/etc/lib-hmac.env',str(Path(directory)/'missing'))
            output = subprocess.check_output(['bash','-c',block+'\nprintf "%s %s" "$LIB_CHAT_ORIGINS" "$ORIGIN_HMAC_SECRET"'],env={**os.environ,'LIB_CHAT_ORIGINS':'https://current.example','ORIGIN_HMAC_SECRET':'current-test-secret'},text=True)
            self.assertEqual(output,'https://current.example current-test-secret')

    def test_public_stream_does_not_inherit_management_credentials(self):
        script = (ROOT / 'network/start-lib-chat-streams').read_text()
        block = script.split("<<'PYSTART'\n", 1)[1].split('\nPYSTART', 1)[0]
        with tempfile.TemporaryDirectory() as directory:
            block = block.replace('/var/log/', directory + '/').replace('/run/', directory + '/')
            scope = {}
            with patch.dict(os.environ, {'PATH': '/usr/bin', 'CF_CONTAINER_API_TOKEN': 'private-admin',
                                         'ORIGIN_HMAC_SECRET': 'current-test-secret',
                                         'LIB_CHAT_ORIGINS': 'https://current.example'}, clear=True), \
                 patch('sys.argv', ['start', 'chat_websocket']), patch('subprocess.Popen') as spawn:
                spawn.return_value.pid = 123
                exec(compile(block, '<stream-start>', 'exec'), scope)
            env = spawn.call_args.kwargs['env']
            self.assertNotIn('CF_CONTAINER_API_TOKEN', env)
            self.assertEqual(env['ORIGIN_HMAC_SECRET'], 'current-test-secret')
            self.assertEqual(env['LIB_CHAT_ORIGINS'], 'https://current.example')
            self.assertEqual(spawn.call_args.args[0][0], '/usr/sbin/runuser')
            self.assertTrue(spawn.call_args.kwargs['close_fds'])

if __name__ == '__main__': unittest.main()
