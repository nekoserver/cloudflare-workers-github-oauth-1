import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 対象: POST /api/aichat/moondream-analysis エンドポイント定義。
// 保存ロジック自体(recordAichatMoondreamAnalysis)はaichat-moondream-analysis-save.test.tsで
// 実SQLiteを使って検証済みのため、ここではルート定義・入力バリデーション・
// レスポンスコードの配線を機械的に確認する。
//
// 故障シナリオ:
//   (1) shareId/analysisTextが空でも200を返してしまう(必須チェック漏れ)
//   (2) 保存失敗時(recordAichatMoondreamAnalysisがok:false)でも200を返して
//       しまい、クライアントが失敗に気付けない

const src = readFileSync(`${__dirname}/index.ts`, 'utf-8');

describe("POST /api/aichat/moondream-analysis", () => {
  const idx = src.indexOf("app.post('/api/aichat/moondream-analysis'");
  const block = src.slice(idx, idx + 900);

  it('ルートが定義されている', () => {
    expect(idx).toBeGreaterThan(-1);
  });

  it('shareId・analysisTextが空なら400を返す', () => {
    expect(block).toContain("if (!shareId || !analysisText) return jsonUtf8({ error: 'shareId, analysisText は必須です' }, 400);");
  });

  it('recordAichatMoondreamAnalysisがok:falseなら404を返す', () => {
    expect(block).toContain('if (!result.ok) return jsonUtf8({ error: result.error }, 404);');
  });

  it('成功時はok:trueを返す', () => {
    expect(block).toContain("return jsonUtf8({ ok: true });");
  });

  it('DB未設定時は503を返す', () => {
    expect(block).toContain("if (!c.env.DB) return jsonUtf8({ error: 'DB未設定です' }, 503);");
  });
});
