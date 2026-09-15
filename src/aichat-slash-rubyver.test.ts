import { describe, expect, it } from 'vitest';
import { formatRubyWasmVersionResult, interpretAichatSlashCommand } from './utils/aichatSlashCommand';

// 対象: `/neko rubyver` スラッシュコマンド。/ruby-wasmページが読み込む
// Ruby/WASM(CRuby WASI版)のビルドライン・パッケージバージョンを表示する。
//
// 故障シナリオ:
//   (1) rubyWasm.tsの定数URLの書式が変わり値が取得できなくなった場合、
//       握りつぶさずエラーメッセージを表示する必要がある
//   (2) 実際のCRubyパッチバージョンはWorker側から取得できないため、
//       それを取得できたかのように見せない(誤解を招く表示にしない)

describe('/neko rubyver', () => {
  it('Ruby/WASMのビルドライン・パッケージバージョンを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko rubyver', new Date('2026-09-11T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('Ruby (WASM)');
    expect(result.response).toContain('| 4.0 |');
    expect(result.response).toContain('2.10.1');
    expect(result.response).not.toContain('| 3.4 |');
    expect(result.response).toContain('取得できません');
  });

  it('/neko help の一覧に /neko rubyver が含まれる', async () => {
    const result = await interpretAichatSlashCommand('/neko help', new Date('2026-09-11T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko rubyver');
  });

  it('未対応コマンド一覧にも /neko rubyver が含まれる', async () => {
    const result = await interpretAichatSlashCommand('/neko doesnotexist', new Date('2026-09-11T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko rubyver');
  });
});

describe('formatRubyWasmVersionResult', () => {
  it('ビルドライン・パッケージバージョンをMarkdownテーブルで表示する', () => {
    const output = formatRubyWasmVersionResult({ rubyBuildLine: '3.4', wasmWasiPackageVersion: '2.10.1' });
    expect(output).toContain('3.4');
    expect(output).toContain('2.10.1');
    expect(output).toContain('| 項目 | 値 |');
  });
});
