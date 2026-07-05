export interface CommitAgentLogEntryInput {
  requestId: string;
  repoFullName: string;
  prNumber: number;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthorName: string | null;
  commitAuthorEmail: string | null;
  detectedAgentName: string | null;
  detectedAgentVersion: string | null;
  detectedSignal: 'message' | 'author' | 'pr' | null;
  createdAtIso: string;
}

export interface CommitAgentLogEntry {
  requestId: string;
  repoFullName: string;
  prNumber: number;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthorName: string | null;
  commitAuthorEmail: string | null;
  detectedAgentName: string | null;
  detectedAgentVersion: string | null;
  detectedSignal: 'message' | 'author' | 'pr' | null;
  createdAtIso: string;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export type CommitAgentFetchDiagnosis = {
  rating: 'bad';
  comment: string;
};

/**
 * PRコミット取得(fetchLatestPrCommitInfo)が例外を投げた際の診断コメントを組み立てる。
 * GITHUB_TOKEN失効時など、従来はlogger.warnにしか残らずD1から異常に気づけなかった
 * 失敗を ai_summary_reviews に記録できる形にするため。
 */
export function classifyCommitAgentFetchError(error: unknown): CommitAgentFetchDiagnosis {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return { rating: 'bad', comment: `[COMMIT_FETCH_ERROR] ${message}` };
}

export function buildCommitAgentLogEntry(input: CommitAgentLogEntryInput): CommitAgentLogEntry | null {
  const hasCommitContext = hasText(input.commitMessage) || hasText(input.commitSha);
  const hasDetection = hasText(input.detectedAgentName) || input.detectedSignal !== null;

  if (!hasCommitContext && !hasDetection) {
    return null;
  }

  return {
    requestId: input.requestId,
    repoFullName: input.repoFullName,
    prNumber: input.prNumber,
    commitSha: hasText(input.commitSha) ? input.commitSha : null,
    commitMessage: hasText(input.commitMessage) ? input.commitMessage : null,
    commitAuthorName: hasText(input.commitAuthorName) ? input.commitAuthorName : null,
    commitAuthorEmail: hasText(input.commitAuthorEmail) ? input.commitAuthorEmail : null,
    detectedAgentName: hasText(input.detectedAgentName) ? input.detectedAgentName : null,
    detectedAgentVersion: hasText(input.detectedAgentVersion) ? input.detectedAgentVersion : null,
    detectedSignal: input.detectedSignal,
    createdAtIso: input.createdAtIso,
  };
}
