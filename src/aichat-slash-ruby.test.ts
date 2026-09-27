import { describe, expect, it, vi } from 'vitest';
import { formatAichatSlashCommandHelp, interpretAichatSlashCommand, type AichatSlashCommandDeps } from './utils/aichatSlashCommand';

const deps: AichatSlashCommandDeps = {
  fetchLatestCommitAgentLog: async () => null,
};

describe('/neko ruby', () => {
  it('保存名でmention-editorの本文を取得し、ブラウザ実行用の情報を返す', async () => {
    const loadMentionEditorRuby = vi.fn(async () => 'puts "hello"');
    const result = await interpretAichatSlashCommand('/neko ruby hello.rb', new Date(), {
      ...deps,
      loadMentionEditorRuby,
    });

    expect(loadMentionEditorRuby).toHaveBeenCalledWith('hello.rb');
    expect(result).toEqual({
      handled: true,
      response: 'Ruby/WASMで「hello.rb」を実行しています…',
      rubyCode: 'puts "hello"',
      rubyFilename: 'hello.rb',
    });
  });

  it('空のファイル名、未登録名、空本文をそれぞれ明示的にエラーにする', async () => {
    const missingName = await interpretAichatSlashCommand('/neko ruby', new Date(), deps);
    const missingFile = await interpretAichatSlashCommand('/neko ruby missing.rb', new Date(), {
      ...deps,
      loadMentionEditorRuby: async () => null,
    });
    const emptyFile = await interpretAichatSlashCommand('/neko ruby empty.rb', new Date(), {
      ...deps,
      loadMentionEditorRuby: async () => '   ',
    });

    expect(missingName.handled && missingName.response).toContain('/neko ruby <ファイル名.rb>');
    expect(missingFile.handled && missingFile.response).toContain('見つかりません');
    expect(emptyFile.handled && emptyFile.response).toContain('実行するコードがありません');
  });

  it('/neko helpにコマンドを掲載する', () => {
    expect(formatAichatSlashCommandHelp()).toContain('/neko ruby <ファイル名.rb>');
  });
});
