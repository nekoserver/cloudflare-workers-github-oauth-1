"""Read-only acceptance of the installed network (no model turns)."""
import grp
from pathlib import Path
import ssl
import stat
import unittest
import urllib.request

class RuntimeTest(unittest.TestCase):
    def test_private_sockets(self):
        for name, mode, parent_mode in [('lib-chat-app/app-server.sock',0o600,0o700), ('lib-chat-observer/observer.sock',0o660,0o750),('lib-codex/worker.sock',0o660,0o750)]:
            with self.subTest(socket=name):
                p=Path('/run')/name
                self.assertTrue(p.is_socket(), name)
                self.assertEqual(stat.S_IMODE(p.stat().st_mode),mode)
                self.assertEqual(stat.S_IMODE(p.parent.stat().st_mode),parent_mode)
                self.assertEqual(p.stat().st_uid,0)
                if mode==0o660: self.assertEqual(p.stat().st_gid,grp.getgrnam('www-data').gr_gid)

    def request(self,path):
        req=urllib.request.Request('https://127.0.0.1:8443'+path,headers={'Host':'mygw.nekomaneki.work','User-Agent':'lib-network-acceptance/1'})
        return urllib.request.urlopen(req,context=ssl._create_unverified_context(),timeout=15)

    def test_ssi_expands(self):
        with self.request('/lib/date.shtml') as res:
            body=res.read().decode()
        self.assertTrue(body.strip())
        self.assertNotIn('<!--#',body)
        self.assertNotIn('an error occurred',body)

    def test_ruby_and_child_cgi_ssi(self):
        for path, marker in [('/lib/ruby_-v.shtml','ruby '),('/lib/api/tunnels.shtml','cf-tunnels')]:
            with self.subTest(path=path), self.request(path) as res:
                body=res.read().decode()
                self.assertNotIn('<!--#',body)
                self.assertNotIn('an error occurred',body)
                self.assertIn(marker,body)

    def test_private_paths_denied(self):
        for path in ['/lib/ops/chat_observer.py','/lib/.git/config','/admin','/lib/test/chat_observer_test.py']:
            with self.subTest(path=path):
                with self.assertRaises(urllib.error.HTTPError) as err: self.request(path)
                self.assertEqual(err.exception.code,403)
                err.exception.close()

if __name__=='__main__': unittest.main(verbosity=2)
