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
