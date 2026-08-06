import { describe, it, expect } from 'vitest';
import { resolveAnswerGraphTrailSessionStorage, ANSWER_GRAPH_TRAIL_SESSION_STORAGE_COOKIE } from './index';

// 対象: /answer-graph のパン屑リスト(選択履歴の足跡)を、タブを閉じるまでの
// 間ブラウザのsessionStorageへ保存し、リロード後も復元できるようにする
// 設定のCookie解決ロジック。足跡には検索履歴・回答内容に由来する情報が
// 含まれるため、ユーザーの明示的な同意が無い限り保存してはならない。
// そのためデフォルトは無効(保存しない)とする(hideEmptyRows等の他の
// answer-graph設定とは逆に、既定でOFF)。
//
// 故障シナリオ:
//   (1) Cookie未設定時にデフォルトが有効(保存する)になってしまい、
//       同意なくブラウザへ選択履歴を書き込んでしまう
//   (2) 'on'判定が緩く、'on'以外の値(空文字・誤字)でも有効扱いになる

describe('resolveAnswerGraphTrailSessionStorage: 足跡のsessionStorage保存設定のCookie解決', () => {
  it('Cookie未設定時はデフォルトで無効(false) — 同意なく保存しない', () => {
    expect(resolveAnswerGraphTrailSessionStorage(undefined)).toBe(false);
  });

  it(ANSWER_GRAPH_TRAIL_SESSION_STORAGE_COOKIE + '=on の場合は有効(true)', () => {
    expect(resolveAnswerGraphTrailSessionStorage(ANSWER_GRAPH_TRAIL_SESSION_STORAGE_COOKIE + '=on')).toBe(true);
  });

  it(ANSWER_GRAPH_TRAIL_SESSION_STORAGE_COOKIE + '=off の場合は無効(false)', () => {
    expect(resolveAnswerGraphTrailSessionStorage(ANSWER_GRAPH_TRAIL_SESSION_STORAGE_COOKIE + '=off')).toBe(false);
  });

  it('不正な値(on以外の文字列)が入っていてもデフォルトの無効(false)のまま', () => {
    expect(resolveAnswerGraphTrailSessionStorage(ANSWER_GRAPH_TRAIL_SESSION_STORAGE_COOKIE + '=xyz')).toBe(false);
  });
});
