import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// GitHub Actions は使わない(利用者指示)。過去に container-image.yml が main への
// push のたびにフルビルドを空転させ、成果物が何も出なかった(2026-11-18 に削除)。
// 許可リスト以外のワークフローが置かれたら、このテストが push 前に止める。
// demo-packages.yml は手動実行のみの既存分として当面許可する。これも消えたら
// 許可リストを空にすること。
const ALLOWED_WORKFLOWS = new Set(['demo-packages.yml']);

describe('GitHub Actions ワークフローのガード', () => {
  it('.github/workflows には許可リスト以外のファイルを置かない', () => {
    const files = readdirSync('.github/workflows').filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
    const unexpected = files.filter((f) => !ALLOWED_WORKFLOWS.has(f));
    expect(unexpected, `未許可のワークフロー: ${unexpected.join(', ')}`).toEqual([]);
  });
});
