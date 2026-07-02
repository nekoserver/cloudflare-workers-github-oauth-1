import { describe, it, expect } from 'vitest';
import { extractCfAuthUsername } from './cfAuthAccess';

describe('extractCfAuthUsername', () => {
  it('username フィールドを最優先で採用する', () => {
    expect(extractCfAuthUsername({ username: 'octocat', user: 'other' })).toBe('octocat');
  });

  it('username がなければ user を採用する', () => {
    expect(extractCfAuthUsername({ user: 'octocat', login: 'other' })).toBe('octocat');
  });

  it('username, user がなければ login を採用する', () => {
    expect(extractCfAuthUsername({ login: 'octocat', email: 'other@example.com' })).toBe('octocat');
  });

  it('username, user, login がなければ email を採用する', () => {
    expect(extractCfAuthUsername({ email: 'octocat@example.com' })).toBe('octocat@example.com');
  });

  it('該当フィールドが存在しない場合は null を返す', () => {
    expect(extractCfAuthUsername({})).toBeNull();
  });

  it('空文字のみのフィールドは無視して次の候補を探す', () => {
    expect(extractCfAuthUsername({ username: '   ', user: 'octocat' })).toBe('octocat');
  });

  it('文字列以外の型は無視する', () => {
    expect(extractCfAuthUsername({ username: 123 as unknown as string, login: 'octocat' })).toBe('octocat');
  });

  it('前後の空白をトリムする', () => {
    expect(extractCfAuthUsername({ username: '  octocat  ' })).toBe('octocat');
  });
});
