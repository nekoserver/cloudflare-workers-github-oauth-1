import { describe, it, expect } from 'vitest';
import { validateRepoName, checkRepoScope, isPermissionError } from './repoValidation';

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
// checkRepoScope
// =====================================================

describe('checkRepoScope', () => {
  describe('セッションあり・スコープデータあり', () => {
    it('repo スコープが含まれていれば hasRepoScope=true', () => {
      const result = checkRepoScope('read:user user:email repo', true);
      expect(result.hasRepoScope).toBe(true);
      expect(result.scopeList).toContain('repo');
      expect(result.hasScopeData).toBe(true);
    });

    it('repo スコープがなければ hasRepoScope=false', () => {
      const result = checkRepoScope('read:user user:email', true);
      expect(result.hasRepoScope).toBe(false);
      expect(result.scopeList).not.toContain('repo');
      expect(result.hasScopeData).toBe(true);
    });

    it('カンマ区切りのスコープもパースできる', () => {
      const result = checkRepoScope('read:user,user:email,repo', true);
      expect(result.hasRepoScope).toBe(true);
      expect(result.scopeList).toEqual(['read:user', 'user:email', 'repo']);
    });

    it('混合区切り（スペースとカンマ）もパースできる', () => {
      const result = checkRepoScope('read:user, user:email, repo', true);
      expect(result.hasRepoScope).toBe(true);
    });
  });

  describe('セッションあり・スコープデータなし（移行前セッション）', () => {
    it('githubGrantedScopes が null → hasRepoScope=false（再認証が必要）', () => {
      const result = checkRepoScope(null, true);
      expect(result.hasRepoScope).toBe(false);
      expect(result.scopeList).toEqual([]);
      expect(result.hasScopeData).toBe(false);
    });

    it('githubGrantedScopes が undefined → hasRepoScope=false（再認証が必要）', () => {
      const result = checkRepoScope(undefined, true);
      expect(result.hasRepoScope).toBe(false);
      expect(result.scopeList).toEqual([]);
      expect(result.hasScopeData).toBe(false);
    });

    it('githubGrantedScopes が空文字列 → hasRepoScope=false（再認証が必要）', () => {
      const result = checkRepoScope('', true);
      expect(result.hasRepoScope).toBe(false);
      expect(result.scopeList).toEqual([]);
      expect(result.hasScopeData).toBe(false);
    });
  });

  describe('セッションなし（D1 障害時のフォールバック）', () => {
    it('セッションなしの場合は hasRepoScope=true（API 呼び出しに委ねる）', () => {
      const result = checkRepoScope(null, false);
      expect(result.hasRepoScope).toBe(true);
    });

    it('セッションなし・スコープ文字列ありでも hasRepoScope=true', () => {
      const result = checkRepoScope('read:user', false);
      expect(result.hasRepoScope).toBe(true);
    });
  });

  describe('エッジケース', () => {
    it('余分な空白があってもパースできる', () => {
      const result = checkRepoScope('  read:user   repo  ', true);
      expect(result.hasRepoScope).toBe(true);
      expect(result.scopeList).toEqual(['read:user', 'repo']);
    });

    it('repo のみのスコープ', () => {
      const result = checkRepoScope('repo', true);
      expect(result.hasRepoScope).toBe(true);
      expect(result.scopeList).toEqual(['repo']);
    });
  });
});

// =====================================================
// isPermissionError
// =====================================================

describe('isPermissionError', () => {
  it('GitHub App 権限エラーを検出する', () => {
    expect(isPermissionError('Resource not accessible by integration')).toBe(true);
  });

  it('Personal Access Token 権限エラーを検出する', () => {
    expect(isPermissionError('Resource not accessible by personal access token')).toBe(true);
  });

  it('Not Found を権限エラーとして検出する', () => {
    expect(isPermissionError('Not Found')).toBe(true);
  });

  it('HTTP 403 を権限エラーとして検出する', () => {
    expect(isPermissionError('HTTP 403')).toBe(true);
  });

  it('HTTP 401 を権限エラーとして検出する', () => {
    expect(isPermissionError('HTTP 401')).toBe(true);
  });

  it('無関係なエラーメッセージは false を返す', () => {
    expect(isPermissionError('Validation Failed')).toBe(false);
  });

  it('名前の重複エラーは false を返す', () => {
    expect(isPermissionError('name already exists on this account')).toBe(false);
  });

  it('空文字列は false を返す', () => {
    expect(isPermissionError('')).toBe(false);
  });

  it('部分一致で検出する（前後に他のテキストがあっても）', () => {
    expect(isPermissionError('Error: Resource not accessible by integration - please re-auth')).toBe(true);
  });
});
