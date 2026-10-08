import { describe, expect, it } from 'vitest';
import { buildCrossModelQuestionGroups, type AichatCrossModelShareRow } from './aichatCrossModelQuestions';

function row(overrides: Partial<AichatCrossModelShareRow>): AichatCrossModelShareRow {
  return {
    question_hash: 'hash1',
    model: 'claude',
    id: 'id1',
    user_hash: 'uh1',
    question: '質問A',
    created_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildCrossModelQuestionGroups', () => {
  it('同じquestion_hashでclaudeとcodexの両方が存在する質問だけを抜き出す', () => {
    const rows: AichatCrossModelShareRow[] = [
      row({ model: 'claude', id: 'c1' }),
      row({ model: 'codex', id: 'x1' }),
    ];
    const result = buildCrossModelQuestionGroups(rows);
    expect(result).toHaveLength(1);
    expect(result[0].questionHash).toBe('hash1');
    expect(result[0].claude.id).toBe('c1');
    expect(result[0].codex.id).toBe('x1');
  });

  it('claudeのみ、またはcodexのみの質問は除外する', () => {
    const rows: AichatCrossModelShareRow[] = [
      row({ question_hash: 'onlyClaude', model: 'claude', id: 'c1' }),
      row({ question_hash: 'onlyCodex', model: 'codex', id: 'x1' }),
    ];
    expect(buildCrossModelQuestionGroups(rows)).toHaveLength(0);
  });

  it('claude/codex以外のmodel(通常のWorkers AIモデル等)の行は無視する', () => {
    const rows: AichatCrossModelShareRow[] = [
      row({ model: 'claude', id: 'c1' }),
      row({ model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', id: 'm1' }),
    ];
    expect(buildCrossModelQuestionGroups(rows)).toHaveLength(0);
  });

  it('question_hashがnullの行は無視する(未設定の古いデータ対策)', () => {
    const rows: AichatCrossModelShareRow[] = [
      row({ model: 'claude', id: 'c1', question_hash: null }),
      row({ model: 'codex', id: 'x1', question_hash: null }),
    ];
    expect(buildCrossModelQuestionGroups(rows)).toHaveLength(0);
  });

  it('同じモデルで複数回答がある場合は最新(created_atが新しい)ものだけを採用する', () => {
    const rows: AichatCrossModelShareRow[] = [
      row({ model: 'claude', id: 'c-old', created_at: '2026-06-01T00:00:00.000Z' }),
      row({ model: 'claude', id: 'c-new', created_at: '2026-06-05T00:00:00.000Z' }),
      row({ model: 'codex', id: 'x1', created_at: '2026-06-03T00:00:00.000Z' }),
    ];
    const result = buildCrossModelQuestionGroups(rows);
    expect(result).toHaveLength(1);
    expect(result[0].claude.id).toBe('c-new');
  });

  it('表記揺れ(言い回しの違い)は完全一致でしかマッチしない(異なるquestion_hashは別グループになる)', () => {
    const rows: AichatCrossModelShareRow[] = [
      row({ question_hash: 'hashA', model: 'claude', id: 'c1', question: '富士山について教えて' }),
      row({ question_hash: 'hashB', model: 'codex', id: 'x1', question: '富士山とは？' }),
    ];
    expect(buildCrossModelQuestionGroups(rows)).toHaveLength(0);
  });

  it('latestCreatedAtが新しい順(降順)に並ぶ', () => {
    const rows: AichatCrossModelShareRow[] = [
      row({ question_hash: 'old', model: 'claude', id: 'c1', created_at: '2026-06-01T00:00:00.000Z' }),
      row({ question_hash: 'old', model: 'codex', id: 'x1', created_at: '2026-06-01T00:00:00.000Z' }),
      row({ question_hash: 'new', model: 'claude', id: 'c2', created_at: '2026-06-10T00:00:00.000Z' }),
      row({ question_hash: 'new', model: 'codex', id: 'x2', created_at: '2026-06-10T00:00:00.000Z' }),
    ];
    const result = buildCrossModelQuestionGroups(rows);
    expect(result.map((r) => r.questionHash)).toEqual(['new', 'old']);
  });

  it('空配列は空配列を返す', () => {
    expect(buildCrossModelQuestionGroups([])).toEqual([]);
  });
});
