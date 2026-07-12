import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const INDEX_SRC = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');

// 対象: /api/heritage-area/search。キーワード配列(最大20件)というURLに
// 載せづらい条件を渡す読み取り専用検索のため、HTTP QUERY(GETと同じ
// safe/idempotentなセマンティクスを持ちボディを送れる新メソッド)を
// POSTに加えて追加した。既存のPOST呼び出し元(heritageArea.ts)には
// 影響を与えず、同じハンドラ関数を両方の登録から参照する。
describe('/api/heritage-area/search: HTTP QUERYメソッドでも呼べる', () => {
  it('ハンドラを名前付き関数heritageAreaSearchHandlerとして切り出している', () => {
    expect(INDEX_SRC).toContain('async function heritageAreaSearchHandler(');
  });

  it('POSTとQUERYの両方が同じheritageAreaSearchHandlerを参照している(ロジックの分岐・重複がない)', () => {
    expect(INDEX_SRC).toContain("app.post('/api/heritage-area/search', authMiddleware, heritageAreaSearchHandler);");
    expect(INDEX_SRC).toContain("app.on('QUERY', '/api/heritage-area/search', authMiddleware, heritageAreaSearchHandler);");
  });

  it('QUERY登録はハンドラ定義(関数閉じ括弧)より後にあり、未定義関数を参照していない', () => {
    const handlerIdx = INDEX_SRC.indexOf('async function heritageAreaSearchHandler(');
    const queryRegisterIdx = INDEX_SRC.indexOf("app.on('QUERY', '/api/heritage-area/search'");
    expect(handlerIdx).toBeGreaterThan(-1);
    expect(queryRegisterIdx).toBeGreaterThan(handlerIdx);
  });
});
