import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const server = require('../containers/demo/server.js') as {
  parseAptCandidate: (policy: string) => string | null;
  judgeAptVersion: (installed: string | null, latest: string | null) => 'ok' | 'warn' | 'ng';
};

describe('apt のツールの最新版の取り出しと判定', () => {
  it('apt-cache policyのCandidateを取り出す。(none)や無い場合はnull', () => {
    expect(server.parseAptCandidate('rg:\n  Installed: 15.1.0-1\n  Candidate: 15.1.0-1ubuntu1\n')).toBe('15.1.0-1ubuntu1');
    expect(server.parseAptCandidate('dnsutils:\n  Installed: (none)\n  Candidate: (none)\n')).toBeNull();
    expect(server.parseAptCandidate('')).toBeNull();
  });
  it('入っていない=赤、最新より古い=黄、最新と同じか新しい=緑(ok)、最新が取れない=黄', () => {
    expect(server.judgeAptVersion(null, '1.0')).toBe('ng');
    expect(server.judgeAptVersion('2.4.1-1', '2.4.2-1')).toBe('warn');
    expect(server.judgeAptVersion('2.4.2-1', '2.4.2-1')).toBe('ok');
    expect(server.judgeAptVersion('2.4.3-1', '2.4.2-1')).toBe('ok');
    expect(server.judgeAptVersion('2.4.2-1', null)).toBe('warn');
  });
});

describe('画面: 最新の版は緑、apt のツールの表', () => {
  const view = readFileSync('src/views/cfContainers.ts', 'utf8');
  it('実際の版が配布元の最新と同じか新しいときは緑(var(--ok))で表示する', () => {
    expect(view).toContain('.diff-ok { color: var(--ok); font-weight: 600; }');
    expect(view).toContain("if (i === 1) td.className = isLatest ? 'diff-ok' : (changed ? 'diff-up' : '');");
  });
  it('ネットワーク・CLIツールの別表を持ち、apt-cacheの最新版と比べる', () => {
    expect(view).toContain('id="apt-table"');
    expect(view).toContain('ネットワーク・CLIツール');
    expect(readFileSync('containers/demo/server.js', 'utf8')).toContain("'apt-get', ['update', '-qq']");
  });
});
