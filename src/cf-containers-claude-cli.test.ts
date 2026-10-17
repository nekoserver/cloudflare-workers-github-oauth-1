import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('containers/demo/Dockerfile', 'utf8');

describe('demoコンテナのClaude CLI', () => {
  it('Node 22を別に置き、そのnpmでClaude CLIを入れてPATHに置く', () => {
    expect(dockerfile).toContain('/opt/node22/bin/npm install -g @anthropic-ai/claude-code');
    expect(dockerfile).toContain('ln -sf /opt/node22/bin/claude /usr/local/bin/claude');
    expect(dockerfile).toContain('claude --version');
  });
});
