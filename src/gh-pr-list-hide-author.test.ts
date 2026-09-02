import { describe, it, expect } from 'vitest';
import { resolveHideAuthorFromCookie } from './utils/ghPrList';

// 対象: /neko gh pr list・GET /api/gh/pr-list が使う
// resolveHideAuthorFromCookie(src/utils/ghPrList.ts)。設定ページの
// 「スラッシュコマンドからのプルリク応答で作成者を伏せる」トグル
// (Cookie: neko_pr_hide_author)の値から、作成者を伏せるかどうかを判定する。
//
// gh-wasm(実際のWASMバイナリ)を経由する統合的な検証はvitest環境では
// 実行できない(wasm-bindgen出力の内部import解決がNode/Vite上で失敗する)
// ため、`cargo test`(wasm/gh-wasm/src/lib.rs)側でformat_pr_listの
// mask_author挙動そのものを検証し、ここではCookie値からの判定ロジックのみを
// 切り出してテストする(CLAUDE.mdルール15)。
//
// 故障シナリオ:
//   (1) Cookie未設定(初回訪問等)の場合にデフォルトで伏せられない
//   (2) 'off'以外の値(例えば大文字違いや空文字)でも実名表示になってしまう
describe('resolveHideAuthorFromCookie', () => {
  it('Cookie未設定(null)の場合はデフォルトで作成者を伏せる(true)', () => {
    expect(resolveHideAuthorFromCookie(null)).toBe(true);
  });

  it("Cookie値が'off'の場合のみ実名表示にする(false)", () => {
    expect(resolveHideAuthorFromCookie('off')).toBe(false);
  });

  it.each(['on', '', 'Off', 'OFF', '1', '0'])(
    "Cookie値が%s('off'以外)の場合は作成者を伏せる(true)のまま",
    (value) => {
      expect(resolveHideAuthorFromCookie(value)).toBe(true);
    }
  );
});
