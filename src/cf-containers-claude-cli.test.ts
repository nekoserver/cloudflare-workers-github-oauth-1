import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('containers/demo/Dockerfile', 'utf8');

describe('demoコンテナのClaude CLI', () => {
  it('Node 22を別に置き、そのnpmでClaude CLIを入れてPATHに置く', () => {
    expect(dockerfile).toContain('/opt/node22/bin/npm install -g @anthropic-ai/claude-code');
    expect(dockerfile).toContain('ln -sf /opt/node22/bin/claude /usr/local/bin/claude');
    expect(dockerfile).toContain('claude --version');
  });

  // 2026-11-14: 起動後のClaude Codeの自動更新(2.1.323→2.1.325)が --allow-scripts 無しで npm install -g を実行し、
  // npm 12 がインストール後の処理(node install.cjs)を止めたため、claude の入口が500バイトの仮のファイルのまま残り、
  // 「claude native binary not installed」で動かなくなった(/root/.npm/_logs の install-scripts の警告で確認)。
  // イメージのnpmの全体設定でClaudeのパッケージのインストール後の処理だけを許し、自動更新でも本体が置かれるようにする。
  it('npmの全体設定でClaudeのパッケージのインストール後の処理だけを許し、自動更新でも本体を置けるようにする', () => {
    const line = '/opt/node22/bin/npm config set allow-scripts=@anthropic-ai/claude-code --location=global';
    expect(dockerfile).toContain(line);
    expect(dockerfile.indexOf(line)).toBeGreaterThan(dockerfile.indexOf('/opt/node22/bin/npm install -g @anthropic-ai/claude-code'));
    expect(dockerfile).toContain('/opt/node22/bin/npm config get allow-scripts --location=global | grep -qx @anthropic-ai/claude-code');
    expect(dockerfile).not.toMatch(/allow-scripts=\*|allow-scripts=all/);
  });
});
