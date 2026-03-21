import { describe, it, expect, vi } from 'vitest';
import { executeCreateRepo, type GitHubApiDeps } from './repoValidation';
import type { GitHubRepo } from './github';

// =====================================================
// テスト用ヘルパー
// =====================================================

/** 成功する GitHub API モック */
function happyDeps(overrides?: Partial<GitHubApiDeps>): GitHubApiDeps {
  return {
    getUserRepos: overrides?.getUserRepos ?? vi.fn().mockResolvedValue([]),
    createRepo: overrides?.createRepo ?? vi.fn().mockResolvedValue({
      name: 'new-repo',
      html_url: 'https://github.com/testuser/new-repo',
      private: false,
    } as GitHubRepo),
  };
}

/** createRepo が特定のエラーで失敗するモック */
function failingCreateDeps(errorMessage: string): GitHubApiDeps {
  return {
    getUserRepos: vi.fn().mockResolvedValue([]),
    createRepo: vi.fn().mockRejectedValue(new Error(errorMessage)),
  };
}

// =====================================================
// 最悪の状況: ユーザーが正しいことをしているのに詰む
// =====================================================

describe('ユーザーがリポジトリ作成できない最悪のシナリオ', () => {

  it('GitHub API が 401 Bad credentials を返す → トークン切れと明示し、再ログインを案内する', async () => {
    const result = await executeCreateRepo({
      accessToken: 'expired-token-abc',
      userId: 'testuser',
      name: 'my-repo',
      isPrivate: false,
      deps: failingCreateDeps('Bad credentials'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toContain('期限切れ');
      expect(result.requireReauth).toBe(true);
    }
  });

  it('GitHub API が 401 を返す → 再ログインを案内する', async () => {
    const result = await executeCreateRepo({
      accessToken: 'revoked-token',
      userId: 'testuser',
      name: 'my-repo',
      isPrivate: false,
      deps: failingCreateDeps('HTTP 401'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.requireReauth).toBe(true);
    }
  });

  it('GitHub API が 403 を返す → 再ログインを案内する', async () => {
    const result = await executeCreateRepo({
      accessToken: 'some-token',
      userId: 'testuser',
      name: 'my-repo',
      isPrivate: false,
      deps: failingCreateDeps('HTTP 403'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.requireReauth).toBe(true);
    }
  });

  it('D1 にもJWT にもアクセストークンがない → 再ログインを案内する', async () => {
    const result = await executeCreateRepo({
      accessToken: undefined,
      userId: 'testuser',
      name: 'my-repo',
      isPrivate: false,
      deps: happyDeps(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toContain('再ログイン');
      expect(result.requireReauth).toBe(true);
    }
  });

  it('GitHub API が "Resource not accessible by personal access token" → 再ログインを案内する', async () => {
    const result = await executeCreateRepo({
      accessToken: 'fine-grained-token-without-repo',
      userId: 'testuser',
      name: 'my-repo',
      isPrivate: false,
      deps: failingCreateDeps('Resource not accessible by personal access token'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.requireReauth).toBe(true);
      expect(result.error).not.toContain('スコープ');
    }
  });
});

// =====================================================
// 正常系: ユーザーが期待通りの結果を得る
// =====================================================

describe('リポジトリ作成の正常系', () => {

  it('リポジトリが作成され、名前とURLが返る', async () => {
    const createRepo = vi.fn().mockResolvedValue({
      name: 'awesome-project',
      html_url: 'https://github.com/testuser/awesome-project',
      private: true,
    } as GitHubRepo);

    const result = await executeCreateRepo({
      accessToken: 'valid-token',
      userId: 'testuser',
      name: 'awesome-project',
      isPrivate: true,
      description: 'My project',
      deps: happyDeps({ createRepo }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(201);
      expect(result.repository.name).toBe('awesome-project');
      expect(result.repository.htmlUrl).toBe('https://github.com/testuser/awesome-project');
      expect(result.repository.isPrivate).toBe(true);
    }

    // createRepo に正しい引数が渡されたか
    expect(createRepo).toHaveBeenCalledWith({
      accessToken: 'valid-token',
      name: 'awesome-project',
      isPrivate: true,
      description: 'My project',
    });
  });

  it('リポジトリ名の前後空白はトリムされて渡される', async () => {
    const createRepo = vi.fn().mockResolvedValue({
      name: 'trimmed',
      html_url: 'https://github.com/testuser/trimmed',
      private: false,
    } as GitHubRepo);

    await executeCreateRepo({
      accessToken: 'valid-token',
      userId: 'testuser',
      name: '  trimmed  ',
      isPrivate: false,
      deps: happyDeps({ createRepo }),
    });

    expect(createRepo).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'trimmed' })
    );
  });
});

// =====================================================
// バリデーション: 不正な入力は GitHub API に到達する前に止める
// =====================================================

describe('入力バリデーション', () => {

  it('空のリポジトリ名は 400 で止まり、GitHub API は呼ばれない', async () => {
    const deps = happyDeps();

    const result = await executeCreateRepo({
      accessToken: 'valid-token',
      userId: 'testuser',
      name: '',
      isPrivate: false,
      deps,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
    expect(deps.createRepo).not.toHaveBeenCalled();
  });

  it('日本語のリポジトリ名は 400 で止まる', async () => {
    const deps = happyDeps();

    const result = await executeCreateRepo({
      accessToken: 'valid-token',
      userId: 'testuser',
      name: 'テスト',
      isPrivate: false,
      deps,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
    expect(deps.createRepo).not.toHaveBeenCalled();
  });

  it('ドットで始まるリポジトリ名は 400 で止まる', async () => {
    const result = await executeCreateRepo({
      accessToken: 'valid-token',
      userId: 'testuser',
      name: '.hidden-repo',
      isPrivate: false,
      deps: happyDeps(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });
});

// =====================================================
// 重複チェック
// =====================================================

describe('重複リポジトリのチェック', () => {

  it('同名リポジトリが既に存在する場合は 409 で止まる', async () => {
    const getUserRepos = vi.fn().mockResolvedValue([
      { name: 'existing-repo', owner: { login: 'testuser' } } as GitHubRepo,
    ]);

    const result = await executeCreateRepo({
      accessToken: 'valid-token',
      userId: 'testuser',
      name: 'existing-repo',
      isPrivate: false,
      deps: happyDeps({ getUserRepos }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toContain('既に存在');
    }
  });

  it('大文字小文字が異なっても重複と判定する', async () => {
    const getUserRepos = vi.fn().mockResolvedValue([
      { name: 'My-Repo', owner: { login: 'TestUser' } } as GitHubRepo,
    ]);

    const result = await executeCreateRepo({
      accessToken: 'valid-token',
      userId: 'testuser',
      name: 'my-repo',
      isPrivate: false,
      deps: happyDeps({ getUserRepos }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
    }
  });

  it('重複チェック自体が失敗しても、作成処理は続行する', async () => {
    const getUserRepos = vi.fn().mockRejectedValue(new Error('network error'));
    const createRepo = vi.fn().mockResolvedValue({
      name: 'my-repo',
      html_url: 'https://github.com/testuser/my-repo',
      private: false,
    } as GitHubRepo);

    const result = await executeCreateRepo({
      accessToken: 'valid-token',
      userId: 'testuser',
      name: 'my-repo',
      isPrivate: false,
      deps: { getUserRepos, createRepo },
    });

    expect(result.ok).toBe(true);
    expect(createRepo).toHaveBeenCalled();
  });
});

// =====================================================
// GitHub API のエラーがユーザーに正確に伝わるか
// =====================================================

describe('GitHub API エラーのユーザーへの伝達', () => {

  it('名前の重複エラー（422）は GitHub のメッセージがそのまま伝わる', async () => {
    const result = await executeCreateRepo({
      accessToken: 'valid-token',
      userId: 'testuser',
      name: 'duplicate-name',
      isPrivate: false,
      deps: failingCreateDeps('name already exists on this account'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain('name already exists on this account');
      expect(result.requireReauth).toBeUndefined();
    }
  });

  it('レート制限エラーは requireReauth なしでそのまま伝わる', async () => {
    const result = await executeCreateRepo({
      accessToken: 'valid-token',
      userId: 'testuser',
      name: 'my-repo',
      isPrivate: false,
      deps: failingCreateDeps('API rate limit exceeded for user'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain('rate limit');
      expect(result.requireReauth).toBeUndefined();
    }
  });

  it('不明なエラーは requireReauth なしでメッセージを伝える', async () => {
    const result = await executeCreateRepo({
      accessToken: 'valid-token',
      userId: 'testuser',
      name: 'my-repo',
      isPrivate: false,
      deps: failingCreateDeps('Something unexpected happened'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain('Something unexpected happened');
      expect(result.requireReauth).toBeUndefined();
    }
  });
});
