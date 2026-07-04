import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

// ===========================================================================
// 根本原因:
//   AIチャットの「詳細プレビュー」モーダル(historyModalChat)は、モデル間の
//   回答をスワイプ切り替えする機能のため touchstart/touchend の水平移動量
//   (dx)が50pxを超えたら historyModalSwipeNavigate() を呼んで別モデルの
//   回答に切り替える(=表示内容を再描画してハイライトを消す)。
//   しかし、テキストをコピーするために指でなぞって選択する操作も
//   水平方向に50px以上ドラッグすることが多く、選択操作の指を離した瞬間の
//   touchend が誤ってスワイプと判定され、選択中のテキストが消えてしまう。
//   これはユーザーの「テキストをなぞって選択→指を離すと解除される」報告に
//   直結する不具合である。
//
// 修正方針:
//   touchend 時点で window.getSelection().toString() が空でない
//   （＝ユーザーが実際にテキストを選択している）場合はスワイプ判定自体を
//   行わないようにする。この判定を shouldTriggerHistoryModalSwipe という
//   純粋関数に切り出し（CLAUDE.mdルール15）、実際に new Function() で実行して
//   検証する。
// ===========================================================================

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: {
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5',
  },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

function extractFunctionSource(html: string, signature: string): string {
  const idx = html.indexOf(signature);
  if (idx === -1) throw new Error(`関数が見つかりません: ${signature}`);
  // 素朴な波括弧カウントで関数本体の終端を探す
  let depth = 0;
  let started = false;
  let end = idx;
  for (let i = idx; i < html.length; i++) {
    if (html[i] === '{') { depth++; started = true; }
    if (html[i] === '}') { depth--; }
    if (started && depth === 0) { end = i + 1; break; }
  }
  return html.slice(idx, end);
}

function runShouldTrigger(fnSource: string, dx: number, selectionText: string): boolean {
  const fakeWindow = { getSelection: () => ({ toString: () => selectionText }) };
  const factory = new Function('window', `${fnSource}\nreturn shouldTriggerHistoryModalSwipe(${dx});`);
  return factory(fakeWindow);
}

describe('詳細プレビューモーダル: テキスト選択中はスワイプ判定しない', () => {
  const html = buildPage();

  it('shouldTriggerHistoryModalSwipe 関数が定義されている', () => {
    expect(html).toContain('function shouldTriggerHistoryModalSwipe');
  });

  it('選択テキストが無く、dxが50pxを超える場合はスワイプすべきと判定する', () => {
    const src = extractFunctionSource(html, 'function shouldTriggerHistoryModalSwipe');
    expect(runShouldTrigger(src, 80, '')).toBe(true);
    expect(runShouldTrigger(src, -80, '')).toBe(true);
  });

  it('dxが50px以下ならスワイプすべきでないと判定する', () => {
    const src = extractFunctionSource(html, 'function shouldTriggerHistoryModalSwipe');
    expect(runShouldTrigger(src, 30, '')).toBe(false);
  });

  it('バグ再現→修正確認: テキストを選択中(getSelectionが非空)なら、dxが50pxを超えてもスワイプしない', () => {
    const src = extractFunctionSource(html, 'function shouldTriggerHistoryModalSwipe');
    expect(runShouldTrigger(src, 80, 'なぞって選択した文章')).toBe(false);
    expect(runShouldTrigger(src, -80, 'なぞって選択した文章')).toBe(false);
  });

  it('historyModalChat の touchend ハンドラが shouldTriggerHistoryModalSwipe を経由する', () => {
    const idx = html.indexOf("historyModalChat.addEventListener('touchend'");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 300);
    expect(block).toContain('shouldTriggerHistoryModalSwipe');
  });
});
