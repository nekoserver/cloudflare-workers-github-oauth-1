import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const viewSource = readFileSync(new URL('./views/fileDeps.ts', import.meta.url), 'utf8');

describe('ファイル変更履歴', () => {
  it('ファイル単位でコミットと関数変更を集約するAPIを提供する', () => {
    const block = indexSource.slice(indexSource.indexOf("app.get('/api/file-history'"), indexSource.indexOf("app.get('/api/file-history'") + 3500);
    expect(block).toContain('WHERE m.repo_id = ? AND m.file_path = ?');
    expect(block).toContain('GROUP BY cl.commit_hash');
    expect(block).toContain('COUNT(DISTINCT m.function_name)');
    expect(block).toContain('LIMIT 200');
  });

  it('依存グラフで選んだファイルの履歴を表示する', () => {
    expect(viewSource).toContain("loadFileHistory(selectedId)");
    expect(viewSource).toContain("fetch('/api/file-history?repo_id=1&file_path='");
    expect(viewSource).toContain('id="historyList"');
    expect(viewSource).toContain('インデックス実行前の変更は表示されません');
  });
});
