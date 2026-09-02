import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: 'claude-sonnet-4-6',
};

// 対象: AIチャットの送信直後に表示する結果トースト。フォールバックせず
// 指定中のモデルで処理された場合は薄緑色で「送信完了」、フォールバックして
// 別モデルに切り替わった場合はフォールバック後の実際のモデル色で
// 「送信失敗 フォールバックし継続」を表示する。回答バブルの色/ラベルだけ
// では、フォールバックの結果か単なる表示上の取り違えか利用者が判断できない
// ため追加した。
describe('AIチャット: 送信結果トースト', () => {
  it('showAichatSendToast関数が定義されている', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('function showAichatSendToast(');
  });

  it('okがtrueのとき薄緑色クラス(aichat-send-toast-ok)を使い、「送信完了」を表示する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showAichatSendToast(');
    const fnBody = html.slice(idx, html.indexOf('\n    }', idx));
    expect(fnBody).toContain("toast.className = 'aichat-send-toast aichat-send-toast-ok'");
    expect(fnBody).toContain("toast.textContent = '送信完了'");
  });

  it('okがfalseのときフォールバック後のモデル色を背景にし、「送信失敗 フォールバックし継続」を表示する', () => {
    const html = getAiChatPage(minimalUser);
    const idx = html.indexOf('function showAichatSendToast(');
    const fnBody = html.slice(idx, html.indexOf('\n    }', idx));
    expect(fnBody).toContain('toast.style.background = fallbackModelColor');
    expect(fnBody).toContain("toast.textContent = '送信失敗 フォールバックし継続'");
  });

  it('.aichat-send-toast-okのCSSが薄緑色で定義されている', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toMatch(/\.aichat-send-toast\.aichat-send-toast-ok\s*\{\s*background:\s*#c6f6d5/);
  });

  it('送信ハンドラがdata.fallbackUsedとdata.usedModelの色でトーストを呼び出す(ローカルコマンドは除く)', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('showAichatSendToast(!data.fallbackUsed, MODEL_COLORS[usedModel]);');
    const idx = html.indexOf('showAichatSendToast(!data.fallbackUsed');
    const before = html.slice(Math.max(0, idx - 120), idx);
    expect(before).toContain('if (!isLocalCommand) {');
  });

  it('トースト表示用のコンテナ要素(aichatSendToastContainer)がbody直下に存在する', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toContain('id="aichatSendToastContainer"');
  });

  it('script タグ内のJSに構文エラーがない', () => {
    const html = getAiChatPage(minimalUser);
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });
});
