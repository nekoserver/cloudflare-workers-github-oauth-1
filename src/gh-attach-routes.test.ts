import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// 対象: /gh-attachページと /api/gh-attach/* APIのルート配線(src/index.ts)。
// gh issue create --attach のブラウザ移植機能が実際にHTTPルートとして
// 登録されていることを確認する(ロジック自体はgh-attach.test.tsで検証済み)。

describe('gh-attach: ルート配線', () => {
  const src = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');

  it("app.get('/gh-attach', authMiddleware, ...) が登録されている", () => {
    expect(src).toContain("app.get('/gh-attach', authMiddleware, async (c) => {");
  });

  it("app.post('/api/gh-attach/upload', authMiddleware, ...) が登録されている", () => {
    expect(src).toContain("app.post('/api/gh-attach/upload', authMiddleware, async (c) => {");
  });

  it("app.post('/api/gh-attach/create-issue', authMiddleware, ...) が登録されている", () => {
    expect(src).toContain("app.post('/api/gh-attach/create-issue', authMiddleware, async (c) => {");
  });
});
