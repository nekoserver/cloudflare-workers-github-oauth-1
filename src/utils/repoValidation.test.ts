import { describe, it, expect } from 'vitest';
import { validateRepoName, isTokenOrPermissionError } from './repoValidation';

// =====================================================
// validateRepoName
// =====================================================

describe('validateRepoName', () => {
  describe('正常系', () => {
    it('英数字のみの名前は有効', () => {
      expect(validateRepoName('my-repo')).toEqual({ valid: true });
    });

    it('ドットを含む名前は有効', () => {
      expect(validateRepoName('my.repo')).toEqual({ valid: true });
    });

    it('アンダースコアを含む名前は有効', () => {
      expect(validateRepoName('my_repo')).toEqual({ valid: true });
    });

    it('数字で始まる名前は有効', () => {
      expect(validateRepoName('123repo')).toEqual({ valid: true });
    });

    it('前後の空白はトリムされる', () => {
      expect(validateRepoName('  my-repo  ')).toEqual({ valid: true });
    });
  });

  describe('空・未定義の入力', () => {
    it('空文字列はエラー', () => {
      const result = validateRepoName('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('リポジトリ名を入力');
    });

    it('空白のみはエラー', () => {
      const result = validateRepoName('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('リポジトリ名を入力');
    });

    it('null はエラー', () => {
      const result = validateRepoName(null);
      expect(result.valid).toBe(false);
    });

    it('undefined はエラー', () => {
      const result = validateRepoName(undefined);
      expect(result.valid).toBe(false);
    });
  });

  describe('不正な文字', () => {
    it('日本語はエラー', () => {
      const result = validateRepoName('リポジトリ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('英数字、ハイフン、ドット、アンダースコアのみ');
    });

    it('スペースを含む名前はエラー', () => {
      const result = validateRepoName('my repo');
      expect(result.valid).toBe(false);
    });

    it('スラッシュを含む名前はエラー', () => {
      const result = validateRepoName('my/repo');
      expect(result.valid).toBe(false);
    });

    it('@ を含む名前はエラー', () => {
      const result = validateRepoName('my@repo');
      expect(result.valid).toBe(false);
    });
  });

  describe('ドットの位置', () => {
    it('ドットで始まる名前はエラー', () => {
      const result = validateRepoName('.hidden');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ドットで開始・終了できません');
    });

    it('ドットで終わる名前はエラー', () => {
      const result = validateRepoName('repo.');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ドットで開始・終了できません');
    });

    it('ドットのみはエラー（開始かつ終了がドット）', () => {
      const result = validateRepoName('.');
      expect(result.valid).toBe(false);
    });
  });
});

// =====================================================
// isTokenOrPermissionError
// =====================================================

describe('isTokenOrPermissionError', () => {
  describe('トークン無効・権限不足パターン', () => {
    it('GitHub App 権限エラーを検出する', () => {
      expect(isTokenOrPermissionError('Resource not accessible by integration')).toBe(true);
    });

    it('Personal Access Token 権限エラーを検出する', () => {
      expect(isTokenOrPermissionError('Resource not accessible by personal access token')).toBe(true);
    });

    it('Not Found を検出する（プライベートリソースへのアクセス拒否）', () => {
      expect(isTokenOrPermissionError('Not Found')).toBe(true);
    });

    it('HTTP 403 を検出する', () => {
      expect(isTokenOrPermissionError('HTTP 403')).toBe(true);
    });

    it('HTTP 401 を検出する', () => {
      expect(isTokenOrPermissionError('HTTP 401')).toBe(true);
    });

    it('Bad credentials を検出する（トークン期限切れ）', () => {
      expect(isTokenOrPermissionError('Bad credentials')).toBe(true);
    });
  });

  describe('権限不足ではないエラー', () => {
    it('バリデーションエラーは false を返す', () => {
      expect(isTokenOrPermissionError('Validation Failed')).toBe(false);
    });

    it('名前の重複エラーは false を返す', () => {
      expect(isTokenOrPermissionError('name already exists on this account')).toBe(false);
    });

    it('空文字列は false を返す', () => {
      expect(isTokenOrPermissionError('')).toBe(false);
    });

    it('レート制限エラーは false を返す', () => {
      expect(isTokenOrPermissionError('API rate limit exceeded')).toBe(false);
    });
  });

  describe('エッジケース', () => {
    it('部分一致で検出する（前後に他のテキストがあっても）', () => {
      expect(isTokenOrPermissionError('Error: Resource not accessible by integration - please re-auth')).toBe(true);
    });

    it('Bad credentials が長いメッセージに含まれても検出する', () => {
      expect(isTokenOrPermissionError('HttpError: Bad credentials (401)')).toBe(true);
    });
  });
});
