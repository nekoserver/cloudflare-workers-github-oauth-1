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

function loadFunctions() {
  const src = getVectorizeAndBulkRegisterScript();
  const fn = new Function(
    `${src}\nreturn { vectorizeAnswerAndExtractKeywords, registerKeywordViaSearchLogFlow, bulkRegisterUnregisteredKeywords };`
  );
  return fn() as {
    vectorizeAnswerAndExtractKeywords: (shareId: string) => Promise<{ status: number; data: unknown }>;
    registerKeywordViaSearchLogFlow: (keyword: string, originShareId: string | null) => Promise<void>;
    bulkRegisterUnregisteredKeywords: (
      originShareId: string | null,
      keywords: string[],
      callbacks: { onStart?: (i: number, kw: string) => void; onItemDone?: (i: number, kw: string) => void },
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

  it('根本原因の修正: テキスト検索が0件でも、抽出元(originShareId)は必ず登録対象へ含める', async () => {
    const calls: Array<{ kind: string; body: unknown }> = [];
    const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
      const u = String(url);
      const body = init && init.body ? JSON.parse(init.body) : null;
      if (u.includes('/api/aichat/shares/search')) {
        calls.push({ kind: 'search', body });
        return Promise.resolve({ json: () => Promise.resolve({ results: [] }) });
      }
      if (u.includes('/api/aichat/search-log/open-modal')) {
        calls.push({ kind: 'open-modal', body });
        const reqShareIds = (body as { shareIds: string[] }).shareIds;
        return Promise.resolve({ json: () => Promise.resolve({
          entries: reqShareIds.map((id: string) => ({ shareId: id, model: 'm', question: 'q', isNew: true })),
        }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) {
        calls.push({ kind: 'approve', body });
        return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
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
        return Promise.resolve({ json: () => Promise.resolve({ results: [{ id: 's1' }, { id: 'sB' }] }) });
      }
      if (u.includes('/api/aichat/search-log/open-modal')) {
        calls.push({ kind: 'open-modal', body });
        const reqShareIds = (body as { shareIds: string[] }).shareIds;
        return Promise.resolve({ json: () => Promise.resolve({
          entries: reqShareIds.map((id: string) => ({ shareId: id, model: 'm', question: 'q', isNew: true })),
        }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) {
        calls.push({ kind: 'approve', body });
        return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
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
        return Promise.resolve({ json: () => Promise.resolve({ results: [{ id: 'sA' }] }) });
      }
      if (u.includes('/api/aichat/search-log/open-modal')) {
        calls.push({ kind: 'open-modal', body });
        return Promise.resolve({ json: () => Promise.resolve({ entries: [{ shareId: 'sA', model: 'm', question: 'q', isNew: true }] }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) {
        calls.push({ kind: 'approve', body });
        return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { registerKeywordViaSearchLogFlow } = loadFunctions();

    await registerKeywordViaSearchLogFlow('新幹線', null);
    expect((calls.find((c) => c.kind === 'open-modal')!.body as { shareIds: string[] }).shareIds).toEqual(['sA']);
  });

  it('bulkRegisterUnregisteredKeywordsはonStart/onItemDoneを順番通りに呼び、完了までresolveする', async () => {
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/shares/search')) return Promise.resolve({ json: () => Promise.resolve({ results: [] }) });
      if (u.includes('/api/aichat/search-log/open-modal')) {
        return Promise.resolve({ json: () => Promise.resolve({ entries: [{ shareId: 's1', model: 'm', question: 'q', isNew: true }] }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { bulkRegisterUnregisteredKeywords } = loadFunctions();

    const events: string[] = [];
    await bulkRegisterUnregisteredKeywords('s1', ['猫', '犬'], {
      onStart: (i, kw) => events.push(`start:${i}:${kw}`),
      onItemDone: (i, kw) => events.push(`done:${i}:${kw}`),
    });

    expect(events).toEqual(['start:0:猫', 'done:0:猫', 'start:1:犬', 'done:1:犬']);
  });

  it('1件の登録失敗(fetch例外)があっても、残りのキーワードの処理を続ける', async () => {
    let callCount = 0;
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/shares/search')) {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('network error'));
        return Promise.resolve({ json: () => Promise.resolve({ results: [] }) });
      }
      if (u.includes('/api/aichat/search-log/open-modal')) {
        return Promise.resolve({ json: () => Promise.resolve({ entries: [{ shareId: 's1', model: 'm', question: 'q', isNew: true }] }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { bulkRegisterUnregisteredKeywords } = loadFunctions();

    const events: string[] = [];
    await bulkRegisterUnregisteredKeywords('s1', ['猫', '犬'], {
      onStart: (i, kw) => events.push(`start:${i}:${kw}`),
      onItemDone: (i, kw) => events.push(`done:${i}:${kw}`),
    });

    expect(events).toEqual(['start:0:猫', 'done:0:猫', 'start:1:犬', 'done:1:犬']);
  });
});
