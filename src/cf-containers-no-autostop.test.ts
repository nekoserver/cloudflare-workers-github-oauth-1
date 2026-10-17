import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('demoコンテナの自動停止', () => {
  it('onActivityExpiredを空にして無操作で止めない', () => {
    const src = readFileSync('src/containers/demoContainer.ts', 'utf8');
    expect(src).toContain('override async onActivityExpired(): Promise<void> {}');
  });
  it('ページに自動停止しない旨を表示する', () => {
    const view = readFileSync('src/views/cfContainers.ts', 'utf8');
    expect(view).toContain('自動停止はしません');
    expect(view).not.toContain('経過すると自動停止します');
  });
});
