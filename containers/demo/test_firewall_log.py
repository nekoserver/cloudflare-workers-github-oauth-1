import importlib.util
from pathlib import Path
import stat
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('firewall_log', Path(__file__).with_name('firewall-log.py'))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class FirewallLogTest(unittest.TestCase):
    def test_reads_source_and_rule_counters(self):
        document = {'nftables': [
            {'set': {'table': 'filter', 'name': 'drop_src6', 'elem': [
                {'elem': {'val': '2001:db8::1', 'counter': {'packets': 3, 'bytes': 180}}}]}},
            {'rule': {'family': 'inet', 'table': 'filter', 'chain': 'forward', 'handle': 12,
                      'expr': [{'counter': {'packets': 3, 'bytes': 180}}]}},
            {'rule': {'family': 'ip', 'table': 'filter', 'chain': 'DOCKER', 'handle': 9,
                      'expr': [{'counter': {'packets': 999, 'bytes': 999}}]}},
        ]}
        self.assertEqual(collector.counter_values(document), {
            'SRC=2001:db8::1': (3, 180), 'CHAIN=forward HANDLE=12': (3, 180)})

    def test_only_logs_new_packets(self):
        previous = {'SRC=192.0.2.1': (3, 180)}
        self.assertEqual(list(collector.counter_changes(previous, previous)), [])
        changes = list(collector.counter_changes(previous, {'SRC=192.0.2.1': (5, 300)}))
        self.assertEqual(changes, ['DROP_COUNTER SRC=192.0.2.1 packets_delta=2 bytes_delta=120 packets_total=5'])

    def test_counter_reset_does_not_create_negative_deltas(self):
        changes = list(collector.counter_changes({'SRC=192.0.2.1': (9, 540)}, {'SRC=192.0.2.1': (1, 60)}))
        self.assertIn('packets_delta=1 bytes_delta=60', changes[0])

    def test_expired_sources_are_not_logged_as_new_drops(self):
        self.assertEqual(list(collector.counter_changes({'SRC=192.0.2.1': (9, 540)}, {})), [])

    def test_utc_permissions_and_rotation(self):
        old_log = collector.LOG
        try:
            with tempfile.TemporaryDirectory() as directory:
                collector.LOG = Path(directory) / 'firewall.log'
                collector.write_log('collector test')
                self.assertRegex(collector.LOG.read_text(), r'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ \S+ firewall: collector test\n$')
                self.assertEqual(stat.S_IMODE(collector.LOG.stat().st_mode), 0o600)
                collector.LOG.write_text('x' * (5 * 1024 * 1024))
                collector.write_log('after rotation')
                self.assertTrue(Path(str(collector.LOG) + '.1').exists())
                self.assertIn('after rotation', collector.LOG.read_text())
        finally:
            collector.LOG = old_log


if __name__ == '__main__':
    unittest.main()
