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

  // dynamicnekoのpush通知は、GitHubリポジトリのpush webhookペイロードを
  // そのまま転送している(username等のトップレベルキーは持たず、
  // pusher.name / sender.loginしか持たない)。
  it('トップレベルのusername/user/login/emailが無ければ pusher.name を採用する', () => {
    expect(extractCfAuthUsername({
      pusher: { name: 'nekoserver', email: 'nekoserver@example.com' },
      sender: { login: 'other-sender' },
    })).toBe('nekoserver');
  });

  it('pusher.name も無ければ sender.login を採用する', () => {
    expect(extractCfAuthUsername({ sender: { login: 'nekoserver' } })).toBe('nekoserver');
  });

  it('トップレベルのフィールドはpusher/senderより優先される', () => {
    expect(extractCfAuthUsername({
      username: 'top-level-user',
      pusher: { name: 'nekoserver' },
    })).toBe('top-level-user');
  });

  it('pusher/senderが存在してもname/loginが無ければ次に進み、結果的にnullを返す', () => {
    expect(extractCfAuthUsername({ pusher: { email: 'no-name@example.com' }, sender: {} })).toBeNull();
  });

  it('pusher/senderがオブジェクトでない場合も例外を投げずnullを返す', () => {
    expect(extractCfAuthUsername({ pusher: 'not-an-object', sender: null })).toBeNull();
  });
});
