import { describe, it, expect } from 'vitest';
import { resolveHideAuthorFromCookie, mergePrMergeableStates } from './utils/ghPrList';

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

// 対象: /neko gh pr list・GET /api/gh/pr-list が使う
// mergePrMergeableStates(src/utils/ghPrList.ts)。GitHub REST APIの一覧取得
// (GET /repos/{owner}/{repo}/pulls)はmergeable_stateを返さないため、Worker側で
// 1件ずつ個別取得した結果(number -> mergeable_state)を一覧のJSON配列へ
// 結合し、gh-wasm(Rust)側のコンフリクト列表示に渡せる形にする。
//
// 故障シナリオ:
//   (1) statesに個別取得結果が無いPR(取得失敗等)にmergeable_stateを
//       誤って付与してしまう(nullを明示的に付与するとgh-wasm側は"確認中"の
//       つもりが別の値と誤認する可能性があるため、フィールド自体を付けない)
//   (2) numberが数値でない不正な形のPRオブジェクトでクラッシュする
describe('mergePrMergeableStates', () => {
  it('statesにある番号のPRへmergeable_stateを付与する', () => {
    const prs = [{ number: 1, title: 'a' }, { number: 2, title: 'b' }];
    const states = new Map<number, string | null>([[1, 'dirty'], [2, 'clean']]);
    const result = mergePrMergeableStates(prs, states);
    expect(result[0]).toEqual({ number: 1, title: 'a', mergeable_state: 'dirty' });
    expect(result[1]).toEqual({ number: 2, title: 'b', mergeable_state: 'clean' });
  });

  it('statesに無い番号のPRにはmergeable_stateフィールドを付与しない(個別取得失敗時)', () => {
    const prs = [{ number: 1, title: 'a' }];
    const states = new Map<number, string | null>();
    const result = mergePrMergeableStates(prs, states);
    expect(result[0]).toEqual({ number: 1, title: 'a' });
    expect('mergeable_state' in result[0]).toBe(false);
  });

  it('個別取得結果がnull(GitHub側で計算中)の場合はnullをそのまま付与する', () => {
    const prs = [{ number: 1, title: 'a' }];
    const states = new Map<number, string | null>([[1, null]]);
    const result = mergePrMergeableStates(prs, states);
    expect(result[0]).toEqual({ number: 1, title: 'a', mergeable_state: null });
  });

  it('numberが数値でないPRオブジェクトはそのまま返す(クラッシュしない)', () => {
    const prs = [{ number: '1', title: 'a' }];
    const states = new Map<number, string | null>([[1, 'dirty']]);
    const result = mergePrMergeableStates(prs, states);
    expect(result[0]).toEqual({ number: '1', title: 'a' });
  });
});
