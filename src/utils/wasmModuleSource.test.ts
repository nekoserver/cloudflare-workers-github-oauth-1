import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchLatestCommitDateForPath, fetchFileContent } from './wasmModuleSource';

// 対象: /wasm-modulesページのソース閲覧モーダル・最終更新日時/最新ビルド日時列が
// 使う、GitHub API呼び出しのラッパー関数(fetchLatestCommitDateForPath, fetchFileContent)。
//
// 故障シナリオ:
//   (1) GitHub APIが404・レート制限等でエラーを返した際に例外を投げてページ全体を壊す
//   (2) commits APIのレスポンス配列が空(コミット履歴が無い/取得失敗)の場合にクラッシュする
//   (3) committer.dateが無くauthor.dateしか無いコミットで日時が取得できなくなる

describe('fetchLatestCommitDateForPath', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('コミットが見つかればcommitter.dateを返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ commit: { committer: { date: '2026-08-18T00:00:00Z' }, author: { date: '2026-08-17T00:00:00Z' } } }]),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchLatestCommitDateForPath('token', 'owner/repo', 'wasm/dig-wasm/src/lib.rs');
    expect(result).toBe('2026-08-18T00:00:00Z');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/repos/owner/repo/commits?path=wasm%2Fdig-wasm%2Fsrc%2Flib.rs'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) })
    );
  });

  it('committer.dateが無い場合はauthor.dateにフォールバックする', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ commit: { author: { date: '2026-08-17T00:00:00Z' } } }]),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchLatestCommitDateForPath('token', 'owner/repo', 'path');
    expect(result).toBe('2026-08-17T00:00:00Z');
  });

  it('コミット配列が空ならnullを返す(クラッシュしない)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchLatestCommitDateForPath('token', 'owner/repo', 'path');
    expect(result).toBeNull();
  });

  it('HTTPエラー時はnullを返す(例外を投げない)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchLatestCommitDateForPath('token', 'owner/repo', 'path');
    expect(result).toBeNull();
  });

  it('fetch自体が例外を投げてもnullを返す(握りつぶすが結果はnullで呼び出し元に伝わる)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchLatestCommitDateForPath('token', 'owner/repo', 'path');
    expect(result).toBeNull();
  });
});

describe('fetchFileContent', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('取得に成功すればok:trueとファイル本文(テキスト)を返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('fn main() {}') });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchFileContent('token', 'owner/repo', 'wasm/dig-wasm/src/lib.rs');
    expect(result).toEqual({ ok: true, content: 'fn main() {}' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/contents/wasm/dig-wasm/src/lib.rs',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/vnd.github.v3.raw' }) })
    );
  });

  it('HTTPエラー時はok:false・実際のステータスコードとGitHubのエラーメッセージを返す(握りつぶさない)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ message: 'Bad credentials' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchFileContent('token', 'owner/repo', 'path');
    expect(result).toEqual({ ok: false, status: 401, message: 'Bad credentials' });
  });

  it('エラーレスポンスがJSONでない場合はstatusTextにフォールバックする', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.reject(new Error('not json')),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchFileContent('token', 'owner/repo', 'path');
    expect(result).toEqual({ ok: false, status: 404, message: 'Not Found' });
  });

  it('fetch自体が例外を投げてもok:falseとエラーメッセージを返す(例外を投げない)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchFileContent('token', 'owner/repo', 'path');
    expect(result).toEqual({ ok: false, status: 0, message: 'network error' });
  });
});
