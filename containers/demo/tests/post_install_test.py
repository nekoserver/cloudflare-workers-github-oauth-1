"""SSI-only container setup; independent of the optional lib repository."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

DEMO=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('container_setup',DEMO/'container_setup.py')
setup=importlib.util.module_from_spec(spec);spec.loader.exec_module(setup)

class ContainerSetupTest(unittest.TestCase):
 def test_setup_writes_only_ssi_configuration_and_is_reusable(self):
  with tempfile.TemporaryDirectory() as d:
   run=Mock();setup.configure_container(Path(d),run)
   conf=Path(d)/'etc/apache2/conf-available/container-ssi.conf'
   self.assertIn('AddOutputFilter INCLUDES .shtml .shtm',conf.read_text())
   self.assertEqual([x.args[0] for x in run.call_args_list],[['a2enmod','include'],['a2enconf','container-ssi']])
   self.assertFalse((Path(d)/'opt/lib-network-src').exists())
 def test_docker_and_boot_call_shared_setup_without_lib_dependency(self):
  docker=(DEMO/'Dockerfile').read_text();entry=(DEMO/'entrypoint.sh').read_text()
  self.assertIn('COPY container_setup.py',docker);self.assertIn('container_setup.py',docker)
  self.assertIn('container_setup.py',entry)
  self.assertNotIn('LIB_NETWORK_REVISION',docker+entry)
  self.assertNotIn('/opt/lib-network-src',docker+entry)

if __name__=='__main__':unittest.main(verbosity=2)
