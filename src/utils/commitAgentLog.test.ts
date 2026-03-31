import { describe, expect, it } from 'vitest';
import { buildCommitAgentLogEntry } from './commitAgentLog';

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
