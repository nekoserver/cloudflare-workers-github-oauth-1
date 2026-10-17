import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('/cf-containers 実質時間単価とgh', () => {
  it('総経費を総接続時間で割った時間単価を表示する(接続0秒では出さない)', () => {
    const view = readFileSync('src/views/cfContainers.ts', 'utf8');
    expect(view).toContain('実質時間単価(総経費÷総接続時間)');
    expect(view).toContain('data.cost.estimatedCostUsd / (data.cost.cumulativeConnectedSeconds / 3600)');
    expect(view).toContain('data.cost.cumulativeConnectedSeconds > 0');
  });
  it('イメージにgitとghを入れる', () => {
    expect(readFileSync('containers/demo/Dockerfile', 'utf8')).toContain('procps xz-utils git gh \\');
  });
});
