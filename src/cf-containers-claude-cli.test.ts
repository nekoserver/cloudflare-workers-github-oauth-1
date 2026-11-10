import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('containers/demo/Dockerfile', 'utf8');

describe('demoコンテナのClaude CLI', () => {
  it('2.1.321の公式配布物と同一のnpmネイティブバイナリを固定する', () => {
    expect(dockerfile).toContain('ARG CLAUDE_VERSION=2.1.321');
    expect(dockerfile).toContain('ARG CLAUDE_NATIVE_SHA256=426c33815ca6645a772f722fbff10dbf2cbdb124a8aeab733c1365dbf8bbf61f');
  });
  it('Node 22を別に置き、そのnpmでClaude CLIを入れてPATHに置く', () => {
    expect(dockerfile).toContain('/opt/node22/bin/npm install -g @anthropic-ai/claude-code');
    expect(dockerfile).toContain('ln -sf /opt/node22/bin/claude /usr/local/bin/claude');
    expect(dockerfile).toContain('claude --version');
  });
});
