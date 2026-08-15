import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { getAiChatPage, DEFAULT_AICHAT_MODELS } from './views/aichat';

// 対象: AIチャットページ(/aichat)の言語モデル選択セレクトメニュー、
// src/index.ts の AICHAT_ALLOWED_MODELS(サーバー側の許可モデル一覧)、
// aichat_model_colors テーブル(モデルごとの表示色)。
//
// 背景: '@cf/zai-org/glm-5.2'(GLM-5.2)は以前のセッションで
// DEFAULT_AICHAT_MODELS(選択肢一覧)への追加とmigration 0064による
// aichat_model_colors への色の事前登録(#f97316)までは行われていたが、
// /api/aichat のサーバー側バリデーションで使うAICHAT_ALLOWED_MODELSへの
// 追加が漏れていた。そのため画面上はGLM-5.2を選択できるにもかかわらず、
// 実際にメッセージを送信するとサーバー側で「許可されていないモデル」として
// 拒否されてしまう状態だった。AICHAT_ALLOWED_MODELSにも追加し、
// 選択メニューから実際に使えるようにした。
//
// 故障シナリオ:
//   (1) DEFAULT_AICHAT_MODELS(選択肢)にだけ追加し、AICHAT_ALLOWED_MODELS
//       (サーバー側許可リスト)への追加を忘れる(今回発生していた状態)
//   (2) 逆にAICHAT_ALLOWED_MODELSにだけ追加し、選択肢に表示されない
//   (3) 色が他モデルと重複する、または割り当てられない

describe('AIチャットページ: GLM-5.2 モデルの選択メニューへの追加', () => {
  it('DEFAULT_AICHAT_MODELS に GLM-5.2 が含まれる', () => {
    const glm = DEFAULT_AICHAT_MODELS.find(m => m.value === '@cf/zai-org/glm-5.2');
    expect(glm).toBeDefined();
    expect(glm!.label).toBe('glm-5.2');
  });

  it('選択メニューのHTMLに GLM-5.2 のoptionが出力される', () => {
    const html = getAiChatPage({
      name: 'テストユーザー',
      username: 'testuser',
      aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    });
    expect(html).toContain('value="@cf/zai-org/glm-5.2"');
    expect(html).toContain('>glm-5.2</option>');
  });

  it('index.ts の AICHAT_ALLOWED_MODELS に GLM-5.2 が含まれる(サーバー側で実際に利用可能)', () => {
    const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf('const AICHAT_ALLOWED_MODELS = new Set([');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, src.indexOf(']);', idx) + 3);
    expect(block).toContain("'@cf/zai-org/glm-5.2'");
  });

  it('migration 0064 で aichat_model_colors に GLM-5.2 用の色が登録済みである', () => {
    const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');
    const idx = src.indexOf("'0064':");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 300);
    expect(block).toContain("'@cf/zai-org/glm-5.2', '#f97316', 'glm-5.2'");
  });
});
