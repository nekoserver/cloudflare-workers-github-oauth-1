import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Tailscaleが落ちていてもヘルスチェックで気づけるように、tailscaledの状態(BackendState)を
// /health と /cf-containers の表に出す(2026-10-17)。
describe('demo container health includes tailscale', () => {
  it('server.js reports tailscale running state from tailscale status --json', () => {
    const s = readFileSync('containers/demo/server.js', 'utf-8');
    expect(s).toMatch(/'status', '--json'/);
    expect(s).toMatch(/BackendState === 'Running'/);
    expect(s).toMatch(/tailscale: value\(tailscale\)/);
  });

  it('cfContainers page shows a tailscale column and fills it from health', () => {
    const s = readFileSync('src/views/cfContainers.ts', 'utf-8');
    expect(s).toMatch(/<th>Tailscale<\/th>/);
    expect(s).toMatch(/id="health-tailscale"/);
    expect(s).toMatch(/getElementById\('health-tailscale'\)\.innerHTML = badge\(data\.tailscale\)/);
  });
});
