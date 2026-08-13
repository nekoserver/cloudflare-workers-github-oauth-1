import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 対象: GET /api/aichat/image-gallery-search のtargetパラメータによる
// 検索対象切り替え配線。実際の検索ロジック(searchAiChatSharesWithImage /
// searchAichatMoondreamAnalyses)はaichat-image-gallery-search.test.tsで
// 実SQLiteを使って検証済みのため、ここではルート側の分岐配線のみを確認する。
//
// 故障シナリオ:
//   (1) target=moondream3.1を指定してもsearchAiChatSharesWithImage(質問・回答
//       検索)が呼ばれてしまい、ドロップダウンで切り替えた意味が無くなる
//   (2) targetを指定しない場合にエラーになる、またはmoondream3.1側が
//       呼ばれてしまう(デフォルトがllama-4であるべき)

const src = readFileSync(`${__dirname}/index.ts`, 'utf-8');

describe('GET /api/aichat/image-gallery-search — targetによる検索対象切り替え', () => {
  const idx = src.indexOf("app.get('/api/aichat/image-gallery-search'");
  const block = src.slice(idx, idx + 900);

  it('ルートが定義されている', () => {
    expect(idx).toBeGreaterThan(-1);
  });

  it("target=moondream3.1のときsearchAichatMoondreamAnalysesを呼ぶ", () => {
    expect(block).toContain("target === 'moondream3.1'");
    expect(block).toContain('await searchAichatMoondreamAnalyses(db, user.sub, q)');
  });

  it('targetがmoondream3.1以外(デフォルト含む)のときsearchAiChatSharesWithImageを呼ぶ', () => {
    expect(block).toContain(': await searchAiChatSharesWithImage(db, user.sub, q);');
  });
});
