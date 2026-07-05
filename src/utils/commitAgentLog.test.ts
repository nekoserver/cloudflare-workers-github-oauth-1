import { describe, expect, it } from 'vitest';
import { buildCommitAgentLogEntry, classifyCommitAgentFetchError } from './commitAgentLog';

describe('buildCommitAgentLogEntry', () => {
  it('PR本文由来の検出のみでもログを作成する（commit_message が null でも可）', () => {
    const row = buildCommitAgentLogEntry({
      requestId: 'req-1',
      repoFullName: 'owner/repo',
      prNumber: 10,
      commitSha: null,
      commitMessage: null,
      commitAuthorName: null,
      commitAuthorEmail: null,
      detectedAgentName: 'Codex',
      detectedAgentVersion: '1.2.3',
      detectedSignal: 'pr',
      createdAtIso: '2026-03-31T00:00:00.000Z',
    });

    expect(row).not.toBeNull();
    expect(row?.detectedSignal).toBe('pr');
    expect(row?.commitMessage).toBeNull();
  });

  it('コミット情報も検出結果もない場合は保存対象にしない', () => {
    const row = buildCommitAgentLogEntry({
      requestId: 'req-2',
      repoFullName: 'owner/repo',
      prNumber: 11,
      commitSha: null,
      commitMessage: null,
      commitAuthorName: null,
      commitAuthorEmail: null,
      detectedAgentName: null,
      detectedAgentVersion: null,
      detectedSignal: null,
      createdAtIso: '2026-03-31T00:00:00.000Z',
    });

    expect(row).toBeNull();
  });
});

describe('classifyCommitAgentFetchError', () => {
  it('Errorインスタンスのメッセージをコメントに含める', () => {
    const diagnosis = classifyCommitAgentFetchError(new Error('PR commits fetch failed: 401 Unauthorized'));
    expect(diagnosis.rating).toBe('bad');
    expect(diagnosis.comment).toContain('[COMMIT_FETCH_ERROR]');
    expect(diagnosis.comment).toContain('401 Unauthorized');
  });

  it('Error以外の値がthrowされても空文字やnullにならない（握りつぶし防止）', () => {
    const diagnosis = classifyCommitAgentFetchError('some string thrown');
    expect(diagnosis.rating).toBe('bad');
    expect(diagnosis.comment.length).toBeGreaterThan(0);
    expect(diagnosis.comment).toContain('Unknown error');
  });

  it('undefinedがthrowされても空文字やnullにならない', () => {
    const diagnosis = classifyCommitAgentFetchError(undefined);
    expect(diagnosis.comment.length).toBeGreaterThan(0);
    expect(diagnosis.comment).toContain('Unknown error');
  });
});
