import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('demoコンテナのApache: Access経由の判定', () => {
  const conf = readFileSync('containers/demo/apache-demo.conf', 'utf8');
  it('Cf-Access-Jwt-Assertionの有無で許可し、無ければループバックのみ', () => {
    expect(conf).toContain('SetEnvIfNoCase Cf-Access-Jwt-Assertion ".+" via_cf_access');
    expect(conf).toContain('Require env via_cf_access');
    expect(conf).toContain('Require ip 127.0.0.1 ::1');
  });
  it('/debugの拒否は全体の許可より後に置いて上書きする', () => {
    expect(conf.indexOf('<LocationMatch "^/debug')).toBeGreaterThan(conf.indexOf('<Location />'));
  });
});
