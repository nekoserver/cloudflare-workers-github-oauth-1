"""SSI must survive installation of the tunnel vhost template."""
from pathlib import Path
import unittest

class SSITemplateTest(unittest.TestCase):
    def test_vhost_serves_ssi_before_catchall_proxy(self):
        conf = (Path(__file__).resolve().parents[2] / 'apache-demo.conf').read_text()
        self.assertIn('Alias /lib/ /var/www/html/lib/', conf)
        self.assertIn('AddOutputFilter INCLUDES .shtml .shtm', conf)
        self.assertIn('Options +Includes +ExecCGI -Indexes -MultiViews', conf)
        self.assertLess(conf.index('ProxyPass /lib/ !'), conf.index('ProxyPass / http:'))
        self.assertIn('Require all denied', conf)
        self.assertIn('(?:ops|test|keys)', conf)
        self.assertIn('CGIDScriptTimeout 105', conf)

if __name__ == '__main__': unittest.main(verbosity=2)
