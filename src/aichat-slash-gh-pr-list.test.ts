import { describe, expect, it, vi } from 'vitest';
import { interpretAichatSlashCommand } from './utils/aichatSlashCommand';

// 対象: /neko gh pr list <owner/repo> サブコマンド(src/utils/aichatSlashCommand.ts)。
// gh-wasm(Rust実装)のformat_pr_listがGitHub REST APIのプルリクエスト一覧を
// Markdownテーブルへ整形する処理を、実際のfetch/WASM実行を挟まずdeps注入で
// 検証する(deps.ghPrListの呼び出し・エラーハンドリングのみが対象)。
//
// 故障シナリオ:
//   (1) owner/repoの指定を忘れた場合にエラーメッセージを返さず握りつぶす
//   (2) `/neko gh` の後に `pr list` 以外のサブコマンドを打った場合にエラーに
//       ならず、意図しない動作をしてしまう
//   (3) deps.ghPrList未設定時にクラッシュする、またはエラーメッセージが出ない
//   (4) deps.ghPrListが例外を投げた場合に画面へエラーが伝わらない(握りつぶす)

describe('/neko gh pr list', () => {
  it('owner/repoを指定すると deps.ghPrList の結果をそのまま返す', async () => {
    const ghPrList = vi.fn().mockResolvedValue('## o/r のプルリクエスト一覧\n| # | タイトル |...');
    const result = await interpretAichatSlashCommand('/neko gh pr list nekoserver/example', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      ghPrList,
    });
    expect(result).toEqual({ handled: true, response: '## o/r のプルリクエスト一覧\n| # | タイトル |...' });
    expect(ghPrList).toHaveBeenCalledWith('nekoserver/example');
  });

  it('owner/repoを指定しない場合はエラーメッセージを返す(握りつぶさない)', async () => {
    const result = await interpretAichatSlashCommand('/neko gh pr list', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      ghPrList: vi.fn(),
    });
    expect(result).toEqual({ handled: true, response: '❌ リポジトリを指定してください: /neko gh pr list <owner/repo>' });
  });

  it('pr list 以外のサブコマンドはエラーメッセージを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko gh repo view nekoserver/example', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      ghPrList: vi.fn(),
    });
    expect(result).toEqual({
      handled: true,
      response: '❌ 対応しているコマンドは /neko gh pr list <owner/repo> のみです',
    });
  });

  it('deps.ghPrList未設定の場合はWASM未設定エラーを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko gh pr list nekoserver/example', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result).toEqual({ handled: true, response: '❌ /neko gh pr list は現在利用できません(WASM未設定)' });
  });

  it('deps.ghPrListが例外を投げた場合はエラーメッセージを返す(握りつぶさない)', async () => {
    const result = await interpretAichatSlashCommand('/neko gh pr list nekoserver/example', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      ghPrList: async () => { throw new Error('リポジトリが見つかりません'); },
    });
    expect(result).toEqual({
      handled: true,
      response: '❌ /neko gh pr list の実行中にエラーが発生しました: リポジトリが見つかりません',
    });
  });
});
