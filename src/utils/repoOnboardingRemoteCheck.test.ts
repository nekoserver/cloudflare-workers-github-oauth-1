import { describe, expect, it, vi } from 'vitest';
import {
  fetchCfAuthWspaceRepoCheck,
  evaluateWspaceCheck,
  fetchDynamicnekoTreeViewRepoCheck,
  evaluateTreeViewCheck,
  type RemoteCheckResult,
  type CfAuthWspaceRepoCheckData,
  type DynamicnekoTreeViewRepoCheckData,
} from './repoOnboardingRemoteCheck';

// 対象: /repo-onboarding-check の④(cf-auth /wspace)・⑤(dynamicneko tree-view)。
//
// 故障シナリオ:
//   (1) Service Bindingが未設定なのにfetchを呼んで例外を投げる
//   (2) secret未設定なのに署名なしでリクエストを送ってしまう
//   (3) レスポンス形式が不正(フィールド欠落・型違い)なのにokとして扱う
//   (4) hasEntries=falseを「オンボーディング不備」のmissingと誤判定する
//      (実際はAI要約イベント未発生の可能性があるためwarningが適切)
//   (5) inAllowedRepos/inTreeViewOptionsの片方だけ登録漏れのケースを見落とす

describe('fetchCfAuthWspaceRepoCheck', () => {
  it('fetcherが未設定ならbinding_missing', async () => {
    const result = await fetchCfAuthWspaceRepoCheck(undefined, 'secret', 'nekoserver/railway');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('binding_missing');
  });

  it('secretが未設定ならsecret_missing(fetchを呼ばない)', async () => {
    const fetchMock = vi.fn();
    const result = await fetchCfAuthWspaceRepoCheck({ fetch: fetchMock }, undefined, 'nekoserver/railway');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('secret_missing');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('正常なJSONが返ればokで中身を返す。署名ヘッダーが付与される', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers['CF-Worker']).toBe('cloudflare-workers-github-oauth-1');
      expect(headers['CF-Worker-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
      return new Response(JSON.stringify({ repo: 'nekoserver/railway', hasEntries: true, entryCount: 3, lastActivity: '2026-10-12T00:00:00Z' }), { status: 200 });
    });
    const result = await fetchCfAuthWspaceRepoCheck({ fetch: fetchMock as unknown as typeof fetch }, 'secret', 'nekoserver/railway');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.entryCount).toBe(3);
  });

  it('レスポンス形式が不正(hasEntriesが数値等)ならinvalid_response', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ repo: 'x', hasEntries: 1, entryCount: 0, lastActivity: null }), { status: 200 }));
    const result = await fetchCfAuthWspaceRepoCheck({ fetch: fetchMock as unknown as typeof fetch }, 'secret', 'nekoserver/railway');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('invalid_response');
  });

  it('HTTPエラー(非200)ならhttp_error', async () => {
    const fetchMock = vi.fn(async () => new Response('forbidden', { status: 403 }));
    const result = await fetchCfAuthWspaceRepoCheck({ fetch: fetchMock as unknown as typeof fetch }, 'secret', 'nekoserver/railway');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('http_error');
  });
});

describe('evaluateWspaceCheck', () => {
  it('hasEntries=trueならok', () => {
    const data: CfAuthWspaceRepoCheckData = { repo: 'nekoserver/railway', hasEntries: true, entryCount: 2, lastActivity: '2026-10-12T01:00:00Z' };
    const result = evaluateWspaceCheck({ ok: true, data });
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('2026-10-12T01:00:00Z');
  });

  it('hasEntries=falseはmissingではなくwarning(AI要約未発生の可能性があるため)', () => {
    const data: CfAuthWspaceRepoCheckData = { repo: 'nekoserver/railway', hasEntries: false, entryCount: 0, lastActivity: null };
    const result = evaluateWspaceCheck({ ok: true, data });
    expect(result.status).toBe('warning');
  });

  it('取得失敗(binding_missing等)はwarningで断定しない', () => {
    const result: RemoteCheckResult<CfAuthWspaceRepoCheckData> = { ok: false, errorCode: 'binding_missing', detail: 'no binding' };
    const evaluated = evaluateWspaceCheck(result);
    expect(evaluated.status).toBe('warning');
    expect(evaluated.detail).toBe('no binding');
  });
});

describe('fetchDynamicnekoTreeViewRepoCheck', () => {
  it('fetcherが未設定ならbinding_missing', async () => {
    const result = await fetchDynamicnekoTreeViewRepoCheck(undefined, 'secret', 'nekoserver/railway');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('binding_missing');
  });

  it('正常なJSONが返ればokで中身を返す', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ repo: 'nekoserver/railway', inAllowedRepos: true, inTreeViewOptions: true }), { status: 200 }));
    const result = await fetchDynamicnekoTreeViewRepoCheck({ fetch: fetchMock as unknown as typeof fetch }, 'secret', 'nekoserver/railway');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.inAllowedRepos).toBe(true);
  });
});

describe('evaluateTreeViewCheck', () => {
  it('両方登録済みならok', () => {
    const data: DynamicnekoTreeViewRepoCheckData = { repo: 'nekoserver/railway', inAllowedRepos: true, inTreeViewOptions: true };
    const result = evaluateTreeViewCheck({ ok: true, data });
    expect(result.status).toBe('ok');
  });

  it('両方未登録ならmissing', () => {
    const data: DynamicnekoTreeViewRepoCheckData = { repo: 'nekoserver/railway', inAllowedRepos: false, inTreeViewOptions: false };
    const result = evaluateTreeViewCheck({ ok: true, data });
    expect(result.status).toBe('missing');
  });

  it('片方だけ登録されている場合はwarning(登録漏れの疑い)', () => {
    const data: DynamicnekoTreeViewRepoCheckData = { repo: 'nekoserver/railway', inAllowedRepos: true, inTreeViewOptions: false };
    const result = evaluateTreeViewCheck({ ok: true, data });
    expect(result.status).toBe('warning');
    expect(result.detail).toContain('未登録');
  });

  it('取得失敗はwarningで断定しない', () => {
    const result: RemoteCheckResult<DynamicnekoTreeViewRepoCheckData> = { ok: false, errorCode: 'http_error', detail: '500' };
    const evaluated = evaluateTreeViewCheck(result);
    expect(evaluated.status).toBe('warning');
  });
});
