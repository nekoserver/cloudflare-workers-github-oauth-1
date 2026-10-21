import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('firewall_stats', Path(__file__).with_name('firewall-stats.py'))
fw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fw)


class StatsTest(unittest.TestCase):
    def test_ipv4_ipv6_prefix_totals_and_unresolved_sources(self):
        rows = [{'ip': '192.0.2.1', 'packets': 2, 'bytes': 100},
                {'ip': '192.0.2.8', 'packets': 3, 'bytes': 200},
                {'ip': '2001:db8:1::1', 'packets': 4, 'bytes': 300},
                {'ip': '2001:db8:1::2', 'packets': 1, 'bytes': 50}]
        totals = {r['cidr']: r for r in fw.aggregate(rows)}
        self.assertEqual(totals['192.0.2.0/24'], {'cidr': '192.0.2.0/24', 'packets': 5, 'bytes': 300, 'sources': 2})
        self.assertEqual(totals['2001:db8:1::/64']['bytes'], 350)
        self.assertEqual(totals['2001:db8:1::/64']['packets'], 5)
        self.assertEqual(fw.aggregate(rows, True), [])

    def test_whois_ranges_and_ipv6_choose_containing_specific_network(self):
        self.assertEqual(fw.allocation_cidrs('NetRange: 192.0.2.0 - 192.0.2.255\nCIDR: 192.0.0.0/16', '192.0.2.8'), ['192.0.2.0/24'])
        self.assertEqual(fw.allocation_cidrs('route6: 2001:db8::/32\ninetnum: 192.0.2.0 - 192.0.2.255', '2001:db8:1::8'), ['2001:db8::/32'])
        self.assertEqual(fw.allocation_cidrs('inet6num: 2001:db8::/32', '2001:db8:1::8'), ['2001:db8::/32'])
        self.assertEqual(fw.allocation_cidrs('CIDR: 198.51.100.0/24', '192.0.2.8'), [])

    def test_nft_elements_ipv6_and_ipv4_ignore_other_tables(self):
        rules = [{'set': {'table': 'filter', 'name': name, 'elem': [{'elem': {'val': addr, 'counter': {'packets': 7, 'bytes': 500}}}]}} for name, addr in [('drop_src4', '192.0.2.1'), ('drop_src6', '2001:db8::1')]]
        rules.append({'set': {'table': 'sshguard', 'name': 'attackers', 'elem': ['198.51.100.1']}})
        self.assertEqual(len(fw.addresses(rules)), 2)
        self.assertEqual(sum(r['packets'] for r in fw.addresses(rules)), 14)

class FirewallApplyTest(unittest.TestCase):
    def test_missing_limit_falls_back_without_deleting_live_table_first(self):
        import os
        import subprocess
        import tempfile
        script = Path(__file__).with_name('entrypoint.sh').read_text()
        script = script[script.index('if command -v nft'):script.index('\n# --- Apache')]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            fake = root / 'nft'
            fake.write_text('''#!/bin/sh
printf '%s\\n' "$*" >> "$FW_TEST_TRACE"
case "$*" in
 'list table inet filter') exit 0;;
 '-c -f '*) if grep -q 'limit rate' "$3"; then exit 1; fi; exit 0;;
 '-f '*) cp "$2" "$FW_TEST_RULES"; exit 0;;
 *) exit 2;;
esac
''')
            fake.chmod(0o755)
            # Keep runtime status/logs inside this test's directory.
            script = script.replace('/run/nekoroot-firewall-mode', str(root / 'mode')).replace('/tmp/nftables.log', str(root / 'log')).replace('/run/nekoroot-firewall-counter-epoch', str(root / 'epoch'))
            env = {**os.environ, 'PATH': tmp + ':' + os.environ['PATH'], 'FW_TEST_TRACE': str(root / 'trace'), 'FW_TEST_RULES': str(root / 'rules')}
            result = subprocess.run(['bash', '-c', 'log() { :; };\n' + script], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((root / 'mode').read_text().strip(), 'counters-only')
            self.assertNotIn('limit rate', (root / 'rules').read_text())
            self.assertIn('ip6 saddr counter', (root / 'rules').read_text())
            self.assertTrue((root / 'rules').read_text().startswith('delete table inet filter'))
            self.assertNotIn('\ndelete table', '\n' + (root / 'trace').read_text())


if __name__ == '__main__':
    unittest.main()
