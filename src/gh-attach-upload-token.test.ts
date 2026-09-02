import { describe, it, expect, vi, afterEach } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

// 対象: POST /api/gh-attach/upload。uploads.github.com/user-attachments/assets は
// GitHub Appのuser-to-serverトークン(ghu_)では動作しないことが実際に確認できたため、
// アップロードだけは管理者が設定する専用のclassic PAT(GH_ATTACH_UPLOAD_TOKEN)を
// 使う設計にした。この故障シナリオ(未設定時にエラーメッセージが握りつぶされず
// 具体的に案内されること)を検証する。

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test', github_access_token: 'ghu_dummy' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function createMockDb() {
  return {
    prepare: vi.fn().mockImplementation(() => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ revoked_at: null }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    })),
  };
}

const validDataUrl = `data:image/png;base64,${Buffer.from('fake-image-bytes').toString('base64')}`;

describe('POST /api/gh-attach/upload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GH_ATTACH_UPLOAD_TOKEN未設定の場合、リポジトリ取得成功後にエラーで503を返す(握りつぶさない)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 123, permissions: { push: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ));

    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/gh-attach/upload',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: 'o', repo: 'r', filename: 'a.png', dataUrl: validDataUrl }),
      },
      { JWT_SECRET, DB: createMockDb() }
    );

    expect(res.status).toBe(503);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('GH_ATTACH_UPLOAD_TOKEN');
  });
});
