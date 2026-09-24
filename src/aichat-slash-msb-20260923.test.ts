import { describe, expect, it, vi } from 'vitest';
import { interpretAichatSlashCommand } from './utils/aichatSlashCommand';

// 対象: /neko msb --help サブコマンド(src/utils/aichatSlashCommand.ts)。
// msb-wasm(Rust実装)のmsb_helpがmicrosandboxのCLI `msb` のヘルプ一覧を
// Markdownで返す処理を、実際のWASM実行を挟まずdeps注入で検証する
// (deps.msbHelpViaWasmの呼び出し・エラーハンドリングのみが対象)。
//
// 故障シナリオ:
//   (1) `/neko msb` (引数無し)や `-h` で --help と同じ動作にならない
//   (2) `--help`/`-h` 以外の引数(例: `run`)を実行しようとしてしまい、
//       「msb本体は実行できない」ことが伝わらない
//   (3) deps.msbHelpViaWasm未設定時にクラッシュする、またはエラーメッセージが出ない
//   (4) deps.msbHelpViaWasmが例外を投げた場合に画面へエラーが伝わらない(握りつぶす)
//   (5) 返り値がMarkdownの見出しを含まずコードブロックへ埋もれてしまい、
//       Markdownとして表示されない

describe('/neko msb --help', () => {
  it('--help を指定すると見出し付きでdeps.msbHelpViaWasmの結果を返す', async () => {
    const msbHelpViaWasm = vi.fn().mockResolvedValue('- `msb run` — サンドボックス内でコマンドを実行する');
    const result = await interpretAichatSlashCommand('/neko msb --help', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      msbHelpViaWasm,
    });
    expect(result).toEqual({
      handled: true,
      response: '## /neko msb --help\n- `msb run` — サンドボックス内でコマンドを実行する',
    });
    expect(msbHelpViaWasm).toHaveBeenCalledWith('');
  });

  it('引数無し・-h でも --help と同じ動作になる', async () => {
    for (const cmd of ['/neko msb', '/neko msb -h']) {
      const msbHelpViaWasm = vi.fn().mockResolvedValue('- `msb run` — ...');
      const result = await interpretAichatSlashCommand(cmd, new Date(), {
        fetchLatestCommitAgentLog: async () => null,
        msbHelpViaWasm,
      });
      expect(result).toEqual({
        handled: true,
        response: expect.stringContaining('## /neko msb --help'),
      });
      expect(msbHelpViaWasm).toHaveBeenCalledTimes(1);
    }
  });

  it('IME等でダッシュが置換された—help/–helpも --help と同じ動作になる', async () => {
    for (const cmd of ['/neko msb —help', '/neko msb –help']) {
      const msbHelpViaWasm = vi.fn().mockResolvedValue('- `msb run` — ...');
      const result = await interpretAichatSlashCommand(cmd, new Date(), {
        fetchLatestCommitAgentLog: async () => null,
        msbHelpViaWasm,
      });
      expect(result).toEqual({
        handled: true,
        response: expect.stringContaining('## /neko msb --help'),
      });
      expect(msbHelpViaWasm).toHaveBeenCalledWith('');
    }
  });

  it('--help/-h 以外の引数はmsb本体を実行できない旨のエラーを返す(握りつぶさない)', async () => {
    const msbHelpViaWasm = vi.fn();
    const result = await interpretAichatSlashCommand('/neko msb run', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      msbHelpViaWasm,
    });
    expect(result).toEqual({
      handled: true,
      response:
        '❌ 対応しているコマンドは /neko msb --help のみです(msb本体の実行はできません。KVM等のOS仮想化に依存するためWASMでは動きません)',
    });
    expect(msbHelpViaWasm).not.toHaveBeenCalled();
  });

  it('deps.msbHelpViaWasm未設定の場合はWASM未設定エラーを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko msb --help', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result).toEqual({ handled: true, response: '❌ /neko msb --help は現在利用できません(WASM未設定)' });
  });

  it('deps.msbHelpViaWasmが例外を投げた場合はエラーメッセージを返す(握りつぶさない)', async () => {
    const result = await interpretAichatSlashCommand('/neko msb --help', new Date(), {
      fetchLatestCommitAgentLog: async () => null,
      msbHelpViaWasm: async () => {
        throw new Error('WASM未初期化');
      },
    });
    expect(result).toEqual({
      handled: true,
      response: '❌ /neko msb --help の実行中にエラーが発生しました: WASM未初期化',
    });
  });
});
