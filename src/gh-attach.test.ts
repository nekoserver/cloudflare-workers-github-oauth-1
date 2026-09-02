import { describe, expect, it } from 'vitest';
import {
  validateAttachDataUrl,
  decodeAttachDataUrlToBytes,
  parseOwnerRepo,
  canUploadWithPermission,
  buildUserAttachmentUploadUrl,
  parseUploadAssetResponse,
  parseCreateIssueResponse,
  MAX_ATTACH_BASE64_LENGTH,
} from './utils/ghAttach';

// 対象: /gh-attach ページ(gh issue create --attach のブラウザ移植)のバックエンド側
// 純粋関数群(src/utils/ghAttach.ts)。実際のGitHubアップロード・Issue作成の
// fetch自体はindex.tsのハンドラが行うため、ここではリクエスト組み立て・
// レスポンス解釈・入力検証の純粋な部分のみを検証する。
//
// 故障シナリオ:
//   (1) 不正な形式・許可していないMIMEタイプ・巨大すぎる添付データを弾けない
//   (2) owner/repo形式でない入力を弾けない
//   (3) アップロード/Issue作成のレスポンスが期待した形でない場合にエラーを握りつぶす
//   (4) リポジトリのpush権限チェックが漏れる
//
// 注意: 当初「トークンのプレフィックス(gho_/ghp_/github_pat_)で種別を判定し、
// 該当しなければアップロードを拒否する」isUploadableTokenPrefix関数を実装して
// いたが、実際のOAuthトークンで「このトークンの種類はファイル添付に対応して
// いません」と誤って拒否される不具合が発生したため削除した。cli/cli本家の
// checkUploadTokenType はトークンの取得経路(ローカルのkeyring/設定ファイル)
// から種別を判定しており、文字列プレフィックスだけでは正しく判定できない
// (根拠のない推測での事前ブロックだった)。トークン種別の妥当性は実際の
// GitHub API(アップロードエンドポイント自体のレスポンス、および
// canUploadWithPermissionによるpush権限チェック)に委ねる。

describe('validateAttachDataUrl', () => {
  const validBase64 = Buffer.from('hello-image-bytes').toString('base64');

  it('png/jpeg/webp/gifのdata URLを許可する', () => {
    for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      const result = validateAttachDataUrl(`data:${mime};base64,${validBase64}`);
      expect(result.ok, `${mime} が許可されない`).toBe(true);
    }
  });

  it('許可していない形式(svg)は拒否する', () => {
    const result = validateAttachDataUrl(`data:image/svg+xml;base64,${validBase64}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('対応していない');
  });

  it('data URL形式でない文字列は拒否する', () => {
    const result = validateAttachDataUrl('https://example.com/photo.png');
    expect(result.ok).toBe(false);
  });

  it('上限を超える巨大なbase64データは拒否する', () => {
    const huge = 'A'.repeat(MAX_ATTACH_BASE64_LENGTH + 100);
    const result = validateAttachDataUrl(`data:image/png;base64,${huge}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('サイズが大きすぎます');
  });
});

describe('decodeAttachDataUrlToBytes', () => {
  it('base64をデコードして元のバイト列を復元する', () => {
    const original = new Uint8Array([0, 1, 2, 250, 255, 128]);
    const base64 = Buffer.from(original).toString('base64');
    const decoded = decodeAttachDataUrlToBytes(base64);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });
});

describe('parseOwnerRepo', () => {
  it('owner/repo形式を正しくパースする', () => {
    expect(parseOwnerRepo('nekoserver/cloudflare-workers-github-oauth-1')).toEqual({
      owner: 'nekoserver',
      repo: 'cloudflare-workers-github-oauth-1',
    });
  });

  it('スラッシュが無い・複数ある入力はnullを返す', () => {
    expect(parseOwnerRepo('invalid')).toBeNull();
    expect(parseOwnerRepo('a/b/c')).toBeNull();
  });

  it('前後の空白はtrimしてからパースする', () => {
    expect(parseOwnerRepo('  owner/repo  ')).toEqual({ owner: 'owner', repo: 'repo' });
  });
});

describe('canUploadWithPermission', () => {
  it('push権限がtrueの場合のみアップロード可', () => {
    expect(canUploadWithPermission(true)).toBe(true);
    expect(canUploadWithPermission(false)).toBe(false);
    expect(canUploadWithPermission(undefined)).toBe(false);
  });
});

describe('buildUserAttachmentUploadUrl', () => {
  it('name/content_type/repository_idをクエリパラメータに含める', () => {
    const url = buildUserAttachmentUploadUrl({ name: 'login.png', contentType: 'image/png', repositoryId: 12345 });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://github.com/user-attachments/assets');
    expect(parsed.searchParams.get('name')).toBe('login.png');
    expect(parsed.searchParams.get('content_type')).toBe('image/png');
    expect(parsed.searchParams.get('repository_id')).toBe('12345');
  });
});

describe('parseUploadAssetResponse', () => {
  it('urlフィールドを取り出す', () => {
    const r = parseUploadAssetResponse({ url: 'https://example.com/a.png' });
    expect(r).toEqual({ url: 'https://example.com/a.png' });
  });

  it('urlが無い・不正な形式の場合はerrorを返す(握りつぶさない)', () => {
    expect(parseUploadAssetResponse({})).toEqual({ error: expect.any(String) });
    expect(parseUploadAssetResponse(null)).toEqual({ error: expect.any(String) });
    expect(parseUploadAssetResponse({ url: '' })).toEqual({ error: expect.any(String) });
  });
});

describe('parseCreateIssueResponse', () => {
  it('html_url/numberを取り出す', () => {
    const r = parseCreateIssueResponse({ html_url: 'https://github.com/o/r/issues/1', number: 1 });
    expect(r).toEqual({ url: 'https://github.com/o/r/issues/1', number: 1 });
  });

  it('必須フィールドが無い場合はerrorを返す(握りつぶさない)', () => {
    expect(parseCreateIssueResponse({})).toEqual({ error: expect.any(String) });
    expect(parseCreateIssueResponse({ html_url: 'https://x' })).toEqual({ error: expect.any(String) });
  });
});
