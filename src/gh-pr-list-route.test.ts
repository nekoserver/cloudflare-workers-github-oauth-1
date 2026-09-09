import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// 対象: GET /api/gh/pr-list のルート配線(src/index.ts)。
// gh-wasm(Rust実装)でGitHubのプルリクエスト一覧をMarkdownテーブルへ整形して
// 返すAPI。ロジック自体(dispatcher経由の呼び出し)はaichat-slash-gh-pr-list.test.ts
// で検証済みのため、ここではHTTPルートとして登録されていることのみを確認する。

describe('gh pr-list: ルート配線', () => {
  const src = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');

  it("app.get('/api/gh/pr-list', authMiddleware, ...) が登録されている", () => {
    expect(src).toContain("app.get('/api/gh/pr-list', authMiddleware, async (c) => {");
  });
});
