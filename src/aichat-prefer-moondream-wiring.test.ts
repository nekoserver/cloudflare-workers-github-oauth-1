import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// 対象: 「画像添付時にmoondreamを優先する」設定の配線一式。
//   (1) POST /api/settings/aichat-prefer-moondream がCookieを正しく保存する
//   (2) GET /aichat がCookieを読んでgetAiChatPage()へ渡す
//   (3) POST /api/aichat がpreferMoondream(かつ画像添付時)でrequestedModelを
//       MOONDREAM_MODELへ差し替える
//
// 故障シナリオ:
//   (1) 設定変更エンドポイントが別のCookie名を使ってしまい、resolve関数と
//       噛み合わず設定が反映されない
//   (2) /aichat ページ読み出し時にCookieを読み込み忘れ、常にデフォルト値
//       (常にON)のままクライアントへ渡ってしまう
//   (3) 画像添付なしでもrequestedModelが上書きされ、テキストのみの会話でも
//       強制的にmoondream(実体はvisionモデル)へ送られてしまう
//   (4) preferMoondreamがfalseなのに上書きされてしまう

const src = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');

describe('画像添付時にmoondreamを優先する設定: 配線の整合性', () => {
  it('POST /api/settings/aichat-prefer-moondream はAICHAT_PREFER_MOONDREAM_COOKIEへ保存する', () => {
    const idx = src.indexOf("app.post('/api/settings/aichat-prefer-moondream'");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 600);
    expect(block).toContain('AICHAT_PREFER_MOONDREAM_COOKIE');
    expect(block).toContain("Set-Cookie");
  });

  it('GET /aichat はCookieヘッダーからresolveAichatPreferMoondreamを呼び、getAiChatPageへ渡す', () => {
    const idx = src.indexOf("app.get('/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 1400);
    expect(block).toContain('aichatPreferMoondream: resolveAichatPreferMoondream(');
  });

  it('POST /api/aichat はpreferMoondreamがtrueかつ画像添付時のみrequestedModelをMOONDREAM_MODELへ差し替える', () => {
    const idx = src.indexOf("app.post('/api/aichat'");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 8200);
    expect(block).toContain('const preferMoondream = !!body.preferMoondream && !!image;');
    expect(block).toContain('preferMoondream ? MOONDREAM_MODEL : (body.model ?? \'\').trim()');
  });
});
