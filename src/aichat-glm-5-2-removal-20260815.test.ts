import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { getAiChatPage, DEFAULT_AICHAT_MODELS } from './views/aichat';

// 対象: AIチャットページ(/aichat)の言語モデル選択セレクトメニュー、
// src/index.ts の AICHAT_ALLOWED_MODELS(サーバー側の許可モデル一覧)。
//
// 背景: GLM-5.2('@cf/zai-org/glm-5.2')は選択メニューへの追加・
// AICHAT_ALLOWED_MODELSへの追加を行っていたが、ユーザーの指示により
// AIチャットページから削除する。aichat_model_colors への色の事前登録
// (migration 0064)は、gemma-3-12b削除時と同様に過去利用分の料金表示用
// データとして残す(削除しない)。
//
// 故障シナリオ:
//   (1) DEFAULT_AICHAT_MODELS(選択肢)からは削除したが、AICHAT_ALLOWED_MODELS
//       (サーバー側許可リスト)への削除を忘れ、URLを直接叩けば使えてしまう
//   (2) 逆にAICHAT_ALLOWED_MODELSだけ削除し、選択肢には表示されたままになる

describe('AIチャットページ: GLM-5.2 モデルの削除', () => {
  it('DEFAULT_AICHAT_MODELS に GLM-5.2 が含まれない', () => {
    const glm = DEFAULT_AICHAT_MODELS.find(m => m.value === '@cf/zai-org/glm-5.2');
    expect(glm).toBeUndefined();
  });

  it('選択メニューのHTMLに GLM-5.2 のoptionが出力されない', () => {
    const html = getAiChatPage({
      name: 'テストユーザー',
      username: 'testuser',
      aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    });
    expect(html).not.toContain('value="@cf/zai-org/glm-5.2"');
    expect(html).not.toContain('>glm-5.2</option>');
  });

  it('index.ts の AICHAT_ALLOWED_MODELS に GLM-5.2 が含まれない(サーバー側でも利用不可)', () => {
    const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('const AICHAT_ALLOWED_MODELS = new Set([');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, src.indexOf(']);', idx) + 3);
    expect(block).not.toContain("'@cf/zai-org/glm-5.2'");
  });
});
