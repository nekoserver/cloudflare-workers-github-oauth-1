import { describe, expect, it } from 'vitest';
import { buildPushNotificationText } from './utils/githubPushNotify';

// 対象: src/utils/githubPushNotify.ts の buildPushNotificationText。
// /webhook/githubがpull_request・installation(_repositories)・repository(created)
// しか通知(Slack/Altワーカー=cf-auth)を送っておらず、pushイベントは
// webhook_logに記録されるだけで通知が飛んでいなかった不具合の修正対象。
//
// 故障シナリオ:
//   (1) repositoryが無いpayloadで例外を投げる、または不正な文字列を返す
//   (2) refからブランチ名を正しく取り出せない(refs/heads/接頭辞の除去漏れ)
//   (3) ブランチ削除(deleted:true)のpushで通常pushと同じ本文になり、
//       「削除された」ことが本文から分からない
//   (4) head_commit.messageが複数行の場合に全文が入り、本文が長大になる

describe('buildPushNotificationText', () => {
  it('通常のpushで、リポジトリ・ブランチ・実行者・コミット数・compareリンクを含む本文を返す', () => {
    const text = buildPushNotificationText({
      ref: 'refs/heads/main',
      repository: { full_name: 'nekoserver/rails-root' },
      pusher: { name: 'okiraku' },
      commits: [{ id: 'a', message: 'first' }, { id: 'b', message: 'second' }],
      head_commit: { id: 'b', message: 'second\n\n詳細説明' },
      compare: 'https://github.com/nekoserver/rails-root/compare/a...b',
    });

    expect(text).toContain('リポジトリ: nekoserver/rails-root');
    expect(text).toContain('ブランチ: main');
    expect(text).toContain('実行者: okiraku');
    expect(text).toContain('コミット数: 2');
    expect(text).toContain('最新コミット: second');
    expect(text).not.toContain('詳細説明');
    expect(text).toContain('https://github.com/nekoserver/rails-root/compare/a...b');
  });

  it('repository.full_nameが無いpayloadはnullを返す(例外にしない)', () => {
    expect(buildPushNotificationText({ ref: 'refs/heads/main' })).toBeNull();
  });

  it('refs/heads/以外のref(タグ等)はそのまま表示する', () => {
    const text = buildPushNotificationText({
      ref: 'refs/tags/v1.0.0',
      repository: { full_name: 'nekoserver/rails-root' },
      sender: { login: 'okiraku' },
      commits: [],
    });
    expect(text).toContain('ブランチ: refs/tags/v1.0.0');
    expect(text).toContain('実行者: okiraku');
  });

  it('pusherが無くsenderだけの場合はsender.loginを使う', () => {
    const text = buildPushNotificationText({
      ref: 'refs/heads/main',
      repository: { full_name: 'nekoserver/rails-root' },
      sender: { login: 'fallback-user' },
      commits: [],
    });
    expect(text).toContain('実行者: fallback-user');
  });

  it('ブランチ削除(deleted:true)は削除であることが分かる専用の本文を返す', () => {
    const text = buildPushNotificationText({
      ref: 'refs/heads/feature/old',
      deleted: true,
      repository: { full_name: 'nekoserver/rails-root' },
      pusher: { name: 'okiraku' },
    });
    expect(text).toContain('ブランチ削除');
    expect(text).toContain('ブランチ: feature/old');
    expect(text).not.toContain('コミット数');
  });
});
