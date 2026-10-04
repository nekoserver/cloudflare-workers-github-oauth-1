import { describe, expect, it } from 'vitest';
import { buildPushSummaryInput } from './githubPushNotify';
import type { GitHubWebhookPushPayload } from '../types';

// 対象: buildPushSummaryInput(pushイベント→AI要約への入力組み立て)。
//
// 故障シナリオ:
//   (1) ブランチ削除pushでAI要約を生成しようとする(意味のない要約になる)
//   (2) commitsが空/メッセージが全て空文字のときに要約対象が無いのに続行する
//   (3) ブランチ名の取り出し(refs/heads/の除去)を間違える
//   (4) コミットメッセージの順序・内容を取り違える

describe('buildPushSummaryInput', () => {
  it('ブランチ削除pushではnullを返す(要約しない)', () => {
    const payload: GitHubWebhookPushPayload = {
      ref: 'refs/heads/feature-x',
      deleted: true,
      commits: [{ id: 'a', message: 'irrelevant' }],
    };
    expect(buildPushSummaryInput(payload)).toBeNull();
  });

  it('commitsが空のときはnullを返す', () => {
    const payload: GitHubWebhookPushPayload = { ref: 'refs/heads/main', commits: [] };
    expect(buildPushSummaryInput(payload)).toBeNull();
  });

  it('commitsのmessageが全て空文字のときはnullを返す', () => {
    const payload: GitHubWebhookPushPayload = {
      ref: 'refs/heads/main',
      commits: [{ id: 'a', message: '' }, { id: 'b', message: '   ' }],
    };
    expect(buildPushSummaryInput(payload)).toBeNull();
  });

  it('refs/heads/を除いたブランチ名と、各コミットメッセージを箇条書きにしたdescriptionを返す', () => {
    const payload: GitHubWebhookPushPayload = {
      ref: 'refs/heads/main',
      commits: [
        { id: 'a', message: 'feat: add login' },
        { id: 'b', message: 'fix: typo' },
      ],
    };
    const result = buildPushSummaryInput(payload);
    expect(result).toEqual({
      title: 'mainブランチへのpush(2件のコミット)',
      description: '- feat: add login\n- fix: typo',
    });
  });

  it('refが無い場合はブランチ名を(不明)とする', () => {
    const payload: GitHubWebhookPushPayload = { commits: [{ id: 'a', message: 'x' }] };
    const result = buildPushSummaryInput(payload);
    expect(result?.title).toBe('(不明)ブランチへのpush(1件のコミット)');
  });
});
