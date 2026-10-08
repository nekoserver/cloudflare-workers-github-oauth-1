export type AichatCrossModelShareRow = {
  question_hash: string | null;
  model: string;
  id: string;
  user_hash: string;
  question: string;
  created_at: string;
};

export type AichatCrossModelAnswerRef = {
  id: string;
  userHash: string;
  createdAt: string;
};

export type AichatCrossModelQuestionGroup = {
  questionHash: string;
  question: string;
  claude: AichatCrossModelAnswerRef;
  codex: AichatCrossModelAnswerRef;
  latestCreatedAt: string;
};

/**
 * ai_chat_sharesの行から、同じquestion_hash(同一ユーザー・同一質問文の完全一致)で
 * claudeとcodexの両方から回答を得ている質問だけを抜き出す。
 * 表記揺れ(言い回しの違い)は意図的に無視し、完全一致のみを対象とする(ユーザー判断)。
 * 同じ質問を複数回askgkした場合はモデルごとに最新の回答のみを採用する。
 */
export function buildCrossModelQuestionGroups(rows: AichatCrossModelShareRow[]): AichatCrossModelQuestionGroup[] {
  const groups = new Map<string, { question: string; claude?: AichatCrossModelShareRow; codex?: AichatCrossModelShareRow }>();

  for (const row of rows) {
    if (row.model !== 'claude' && row.model !== 'codex') continue;
    if (!row.question_hash) continue;

    let group = groups.get(row.question_hash);
    if (!group) {
      group = { question: row.question };
      groups.set(row.question_hash, group);
    }

    const current = row.model === 'claude' ? group.claude : group.codex;
    if (!current || row.created_at > current.created_at) {
      if (row.model === 'claude') group.claude = row;
      else group.codex = row;
    }
  }

  const result: AichatCrossModelQuestionGroup[] = [];
  for (const [questionHash, group] of groups) {
    if (!group.claude || !group.codex) continue;
    const latestCreatedAt = group.claude.created_at > group.codex.created_at
      ? group.claude.created_at
      : group.codex.created_at;
    result.push({
      questionHash,
      question: group.question,
      claude: { id: group.claude.id, userHash: group.claude.user_hash, createdAt: group.claude.created_at },
      codex: { id: group.codex.id, userHash: group.codex.user_hash, createdAt: group.codex.created_at },
      latestCreatedAt,
    });
  }

  result.sort((a, b) => (a.latestCreatedAt < b.latestCreatedAt ? 1 : a.latestCreatedAt > b.latestCreatedAt ? -1 : 0));
  return result;
}
