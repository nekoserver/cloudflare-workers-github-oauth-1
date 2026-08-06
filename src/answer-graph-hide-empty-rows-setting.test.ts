import { describe, it, expect } from 'vitest';
import { resolveAnswerGraphHideEmptyRows, ANSWER_GRAPH_HIDE_EMPTY_ROWS_COOKIE } from './index';

// 対象: /answer-graph の起点検索結果テーブルで「キーワード数0」の行・経路が
// 「ー」の行を表示しないようにする設定のCookie解決ロジック。設定ページで
// 変更でき、デフォルトは有効(表示しない)。
//
// 故障シナリオ:
//   (1) Cookie未設定時にデフォルトが無効(表示する)になってしまう
//   (2) 'off'判定が緩く、'off'以外の値(空文字・誤字)でも無効扱いになり
//       意図せず行が非表示になる

describe('resolveAnswerGraphHideEmptyRows: 空行非表示設定のCookie解決', () => {
  it('Cookie未設定時はデフォルトで有効(true)', () => {
    expect(resolveAnswerGraphHideEmptyRows(undefined)).toBe(true);
  });

  it(ANSWER_GRAPH_HIDE_EMPTY_ROWS_COOKIE + '=off の場合は無効(false)', () => {
    expect(resolveAnswerGraphHideEmptyRows(ANSWER_GRAPH_HIDE_EMPTY_ROWS_COOKIE + '=off')).toBe(false);
  });

  it(ANSWER_GRAPH_HIDE_EMPTY_ROWS_COOKIE + '=on の場合は有効(true)', () => {
    expect(resolveAnswerGraphHideEmptyRows(ANSWER_GRAPH_HIDE_EMPTY_ROWS_COOKIE + '=on')).toBe(true);
  });

  it('不正な値(off以外の文字列)が入っていてもデフォルトの有効(true)のまま', () => {
    expect(resolveAnswerGraphHideEmptyRows(ANSWER_GRAPH_HIDE_EMPTY_ROWS_COOKIE + '=xyz')).toBe(true);
  });
});
