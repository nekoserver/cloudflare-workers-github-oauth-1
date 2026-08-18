// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { getVectorizeAndBulkRegisterScript } from './vectorizeAndBulkRegister';

// 対象: 「回答文をベクタ化して予備知識キーワードを抽出し、未登録キーワードを
// 一括で回答文に紐付け登録する」処理を切り出した共通スクリプト。answer-graph
// ページに埋め込まれていた実装をページ非依存の関数として抽出したもので、
// 他のページからも同じ処理を再利用できることを想定している。
//
// 故障シナリオ:
//   (1) script自体に構文エラーがある
//   (2) 抽出元の回答文(originShareId)がテキスト検索でヒットしない場合、
//       登録対象が0件になり何も登録されない(実際に発生した不具合の根本原因)
//   (3) 抽出元がテキスト検索でヒットした場合に重複して2回登録対象へ
//       含まれてしまう
//   (4) bulkRegisterUnregisteredKeywordsのonStart/onItemDoneコールバックが
//       正しいインデックス・順序で呼ばれない
//   (5) 1件の登録に失敗しても残りの処理が止まってしまう
//   (6) サーバー側がHTTPエラーやエラーJSON({ok:false,error:...})を返しても
//       検知されず、onItemDoneが常に「成功」扱いで呼ばれてしまう
//       (実際に発生した不具合の根本原因: 見た目は「登録完了」なのに
//       DBには書き込まれておらず、後で開き直すと未登録のまま表示される)

function loadFunctions() {
  const src = getVectorizeAndBulkRegisterScript();
  const fn = new Function(
    `${src}\nreturn { vectorizeAnswerAndExtractKeywords, registerKeywordViaSearchLogFlow, bulkRegisterUnregisteredKeywords };`
  );
  return fn() as {
    vectorizeAnswerAndExtractKeywords: (shareId: string, model?: string) => Promise<{ status: number; data: unknown }>;
    registerKeywordViaSearchLogFlow: (keyword: string, originShareId: string | null) => Promise<boolean>;
    bulkRegisterUnregisteredKeywords: (
      originShareId: string | null,
      keywords: string[],
      callbacks: { onStart?: (i: number, kw: string) => void; onItemDone?: (i: number, kw: string, success: boolean) => void },
    ) => Promise<void>;
  };
}

describe('getVectorizeAndBulkRegisterScript', () => {
  it('script自体に構文エラーがない', () => {
    expect(() => new Function(getVectorizeAndBulkRegisterScript())).not.toThrow();
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('vectorizeAnswerAndExtractKeywordsは/api/aichat/vectorize-answerをPOSTしstatus/dataを返す', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      status: 200,
      json: () => Promise.resolve({ vectorized: true, keywords: ['猫'] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { vectorizeAnswerAndExtractKeywords } = loadFunctions();

    const res = await vectorizeAnswerAndExtractKeywords('s1');
    expect(fetchMock).toHaveBeenCalledWith('/api/aichat/vectorize-answer', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ shareId: 's1' }),
    }));
    expect(res.status).toBe(200);
    expect((res.data as { keywords: string[] }).keywords).toEqual(['猫']);
  });

  it('modelを渡すとリクエストボディに含まれる', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      status: 200,
      json: () => Promise.resolve({ vectorized: true, keywords: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { vectorizeAnswerAndExtractKeywords } = loadFunctions();

    await vectorizeAnswerAndExtractKeywords('s1', '@cf/baai/bge-m3');
    expect(fetchMock).toHaveBeenCalledWith('/api/aichat/vectorize-answer', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ shareId: 's1', model: '@cf/baai/bge-m3' }),
    }));
  });

  it('サーバーが一定時間(30秒)応答しない場合はタイムアウトエラーを返す(通信エラーとして投げない)', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { vectorizeAnswerAndExtractKeywords } = loadFunctions();

    const promise = vectorizeAnswerAndExtractKeywords('s1');
    await vi.advanceTimersByTimeAsync(30000);
    const res = await promise;

    expect(res.status).toBe(0);
    expect((res.data as { error: string }).error).toContain('タイムアウト');
    vi.useRealTimers();
  });

  it('30秒以内に応答すればタイムアウト扱いにならない', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve({
      status: 200,
      json: () => Promise.resolve({ vectorized: true, keywords: ['猫'] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { vectorizeAnswerAndExtractKeywords } = loadFunctions();

    const res = await vectorizeAnswerAndExtractKeywords('s1');
    expect(res.status).toBe(200);
    vi.useRealTimers();
  });

  it('根本原因の修正: テキスト検索が0件でも、抽出元(originShareId)は必ず登録対象へ含める', async () => {
    const calls: Array<{ kind: string; body: unknown }> = [];
    const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
      const u = String(url);
      const body = init && init.body ? JSON.parse(init.body) : null;
      if (u.includes('/api/aichat/shares/search')) {
        calls.push({ kind: 'search', body });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
      }
      if (u.includes('/api/aichat/search-log/open-modal')) {
        calls.push({ kind: 'open-modal', body });
        const reqShareIds = (body as { shareIds: string[] }).shareIds;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          entries: reqShareIds.map((id: string) => ({ shareId: id, model: 'm', question: 'q', isNew: true })),
        }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) {
        calls.push({ kind: 'approve', body });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { registerKeywordViaSearchLogFlow } = loadFunctions();

    await registerKeywordViaSearchLogFlow('乗車券', 's1');

    const openModalCall = calls.find((c) => c.kind === 'open-modal');
    expect(openModalCall).toBeDefined();
    expect((openModalCall!.body as { shareIds: string[] }).shareIds).toEqual(['s1']);
    const approveCall = calls.find((c) => c.kind === 'approve');
    expect(approveCall).toBeDefined();
    expect((approveCall!.body as { shareIds: string[] }).shareIds).toEqual(['s1']);
  });

  it('テキスト検索でヒットしたshareIdに抽出元(originShareId)が既に含まれる場合は重複させない', async () => {
    const calls: Array<{ kind: string; body: unknown }> = [];
    const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
      const u = String(url);
      const body = init && init.body ? JSON.parse(init.body) : null;
      if (u.includes('/api/aichat/shares/search')) {
        calls.push({ kind: 'search', body });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [{ id: 's1' }, { id: 'sB' }] }) });
      }
      if (u.includes('/api/aichat/search-log/open-modal')) {
        calls.push({ kind: 'open-modal', body });
        const reqShareIds = (body as { shareIds: string[] }).shareIds;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({
          entries: reqShareIds.map((id: string) => ({ shareId: id, model: 'm', question: 'q', isNew: true })),
        }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) {
        calls.push({ kind: 'approve', body });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { registerKeywordViaSearchLogFlow } = loadFunctions();

    await registerKeywordViaSearchLogFlow('新幹線', 's1');

    const openModalCall = calls.find((c) => c.kind === 'open-modal');
    expect((openModalCall!.body as { shareIds: string[] }).shareIds).toEqual(['s1', 'sB']);
  });

  it('originShareIdがnull(呼び出し元shareId不明)でも、検索ヒットがあれば従来通り登録する', async () => {
    const calls: Array<{ kind: string; body: unknown }> = [];
    const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
      const u = String(url);
      const body = init && init.body ? JSON.parse(init.body) : null;
      if (u.includes('/api/aichat/shares/search')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [{ id: 'sA' }] }) });
      }
      if (u.includes('/api/aichat/search-log/open-modal')) {
        calls.push({ kind: 'open-modal', body });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ shareId: 'sA', model: 'm', question: 'q', isNew: true }] }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) {
        calls.push({ kind: 'approve', body });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { registerKeywordViaSearchLogFlow } = loadFunctions();

    await registerKeywordViaSearchLogFlow('新幹線', null);
    expect((calls.find((c) => c.kind === 'open-modal')!.body as { shareIds: string[] }).shareIds).toEqual(['sA']);
  });

  it('bulkRegisterUnregisteredKeywordsはonStart/onItemDoneを順番通りに呼び、成功時はsuccess=trueで完了までresolveする', async () => {
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/shares/search')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
      if (u.includes('/api/aichat/search-log/open-modal')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ shareId: 's1', model: 'm', question: 'q', isNew: true }] }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { bulkRegisterUnregisteredKeywords } = loadFunctions();

    const events: string[] = [];
    await bulkRegisterUnregisteredKeywords('s1', ['猫', '犬'], {
      onStart: (i, kw) => events.push(`start:${i}:${kw}`),
      onItemDone: (i, kw, success) => events.push(`done:${i}:${kw}:${success}`),
    });

    expect(events).toEqual(['start:0:猫', 'done:0:猫:true', 'start:1:犬', 'done:1:犬:true']);
  });

  it('1件の登録失敗(fetch例外)があっても、残りのキーワードの処理を続け、失敗した件だけsuccess=falseで通知する', async () => {
    let callCount = 0;
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/shares/search')) {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('network error'));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
      }
      if (u.includes('/api/aichat/search-log/open-modal')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ shareId: 's1', model: 'm', question: 'q', isNew: true }] }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { bulkRegisterUnregisteredKeywords } = loadFunctions();

    const events: string[] = [];
    await bulkRegisterUnregisteredKeywords('s1', ['猫', '犬'], {
      onStart: (i, kw) => events.push(`start:${i}:${kw}`),
      onItemDone: (i, kw, success) => events.push(`done:${i}:${kw}:${success}`),
    });

    expect(events).toEqual(['start:0:猫', 'done:0:猫:false', 'start:1:犬', 'done:1:犬:true']);
  });

  it('根本原因の修正: 検索ログ承認(approve)がHTTPエラーを返した場合、registerKeywordViaSearchLogFlowは失敗として拒否する(以前は検知されず成功扱いになっていた)', async () => {
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/shares/search')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
      if (u.includes('/api/aichat/search-log/open-modal')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ shareId: 's1', model: 'm', question: 'q', isNew: true }] }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ ok: false, error: 'D1 write failed' }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { registerKeywordViaSearchLogFlow } = loadFunctions();

    await expect(registerKeywordViaSearchLogFlow('猫', 's1')).rejects.toThrow();
  });

  it('根本原因の修正: 検索ログ承認(approve)がHTTP 200でもok:falseを返した場合は失敗として拒否する', async () => {
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/shares/search')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
      if (u.includes('/api/aichat/search-log/open-modal')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ shareId: 's1', model: 'm', question: 'q', isNew: true }] }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: false, error: 'D1 write failed' }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { registerKeywordViaSearchLogFlow } = loadFunctions();

    await expect(registerKeywordViaSearchLogFlow('猫', 's1')).rejects.toThrow('D1 write failed');
  });

  it('根本原因の修正: bulkRegisterUnregisteredKeywordsはapproveの失敗をonItemDoneのsuccess=falseとして伝える', async () => {
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/shares/search')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
      if (u.includes('/api/aichat/search-log/open-modal')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [{ shareId: 's1', model: 'm', question: 'q', isNew: true }] }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ ok: false, error: 'D1 write failed' }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { bulkRegisterUnregisteredKeywords } = loadFunctions();

    const results: Array<{ kw: string; success: boolean }> = [];
    await bulkRegisterUnregisteredKeywords('s1', ['猫'], {
      onItemDone: (_i, kw, success) => results.push({ kw, success }),
    });

    expect(results).toEqual([{ kw: '猫', success: false }]);
  });
});
