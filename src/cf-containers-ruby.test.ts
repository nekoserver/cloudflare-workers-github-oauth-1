import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('containers/demo/Dockerfile', 'utf8');
const require = createRequire(import.meta.url);
const server = require('../containers/demo/server.js') as {
  VERSION_SOURCES: Array<{ name: string; key?: string }>;
  APT_TOOLS: Array<{ name: string; pkg: string }>;
  extractVersion: (text: string) => string | null;
};

describe('demoコンテナ: Rubyをソースからビルドする', () => {
  it('公式のソースを固定したsha256で検証してビルドし、/opt/rubyに入れる', () => {
    expect(dockerfile).toMatch(/^ARG RUBY_VERSION=4\.0\.9$/m);
    expect(dockerfile).toMatch(/^ARG RUBY_SHA256=c35350682ff050b79702d57ade4516e7336063f510155d19fb2fb5b3f3909511$/m);
    expect(dockerfile).toContain('FROM ubuntu:26.04 AS ruby-build');
    expect(dockerfile).toContain('https://cache.ruby-lang.org/pub/ruby/');
    expect(dockerfile).toContain('sha256sum -c -');
    expect(dockerfile).toContain('--prefix=/opt/ruby');
    expect(dockerfile).toContain('COPY --from=ruby-build /opt/ruby /opt/ruby');
  });
  it('aptのrubyは入れない(古い版が先に見つかって混ざらないように)', () => {
    const aptLines = dockerfile.split('\n').filter((l) => /apt-get install/.test(l) || /^\s{8}\S/.test(l));
    expect(aptLines.some((l) => /(^|\s)ruby(\s|$)/.test(l))).toBe(false);
    expect(server.APT_TOOLS.some((t) => t.name === 'ruby')).toBe(false);
  });
  it('SSHのシェルでもソース版のrubyが見つかり、版の表で想定の版と比べる', () => {
    expect(dockerfile).toMatch(/ln -sf \/opt\/ruby\/bin\/\$b \/usr\/local\/bin\/\$b/);
    expect(server.VERSION_SOURCES).toContainEqual(expect.objectContaining({ name: 'ruby', key: 'ruby' }));
    expect(dockerfile).toMatch(/"ruby":"%s"/);
    expect(server.extractVersion('ruby 4.0.9 (2026-10-23 revision 3e93b23afc) +PRISM [x86_64-linux]')).toBe('4.0.9');
  });
});

describe('demoコンテナ: Codex・Claude CLIの版', () => {
  it('最新版に上げる', () => {
    expect(dockerfile).toMatch(/^ARG CODEX_VERSION=0\.169\.0$/m);
    expect(dockerfile).toMatch(/^ARG CLAUDE_VERSION=2\.1\.326$/m);
  });
});
