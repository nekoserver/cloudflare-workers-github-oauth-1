import { describe, expect, it, vi } from 'vitest';
import { runJevRecursiveDrilldown, type JevDrilldownNode } from './jevRecursiveDrilldown';

const tree: JevDrilldownNode[] = [
  {
    id: 1,
    question: '事実の正確さ',
    criteria: ['不正確', '正確'],
    children: [
      { id: 11, question: '根拠の明示', criteria: ['根拠なし', '根拠あり'] },
      { id: 12, question: '情報の鮮度', criteria: ['古い', '新しい'] },
    ],
  },
  {
    id: 2,
    question: '伝わりやすさ',
    criteria: ['不明瞭', '明瞭'],
    children: [{ id: 21, question: '具体性', criteria: ['抽象的', '具体的'] }],
  },
];

describe('runJevRecursiveDrilldown', () => {
  it('閾値以下の枝だけを次の問い合わせで掘り下げる', async () => {
    const evaluate = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        scores: [{ labelId: 1, value: 0.4 }, { labelId: 2, value: 0.9 }],
      })
      .mockResolvedValueOnce({
        ok: true,
        scores: [{ labelId: 11, value: 0.2 }, { labelId: 12, value: 0.8 }],
      });

    const result = await runJevRecursiveDrilldown({ state: '評価対象', roots: tree, evaluate });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(evaluate.mock.calls.map((call) => call[1].map((label: { id: number }) => label.id))).toEqual([
      [1, 2],
      [11, 12],
    ]);
    expect(result.findings.map((finding) => [finding.labelId, finding.depth, finding.parentLabelId])).toEqual([
      [1, 0, null],
      [2, 0, null],
      [11, 1, 1],
      [12, 1, 1],
    ]);
    expect(result.stopReason).toBe('completed');
  });

  it('質問数上限を超えてJevを呼ばず、上限到達を結果に残す', async () => {
    const evaluate = vi.fn().mockResolvedValue({
      ok: true,
      scores: [{ labelId: 1, value: 0.1 }],
    });

    const result = await runJevRecursiveDrilldown({
      state: '評価対象', roots: tree, evaluate, maxQuestions: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate.mock.calls[0][1]).toHaveLength(1);
    expect(result.stopReason).toBe('question_budget');
    expect(result.evaluatedQuestionCount).toBe(1);
  });

  it('深さ上限に未探索の低スコア枝があればmax_depthで停止する', async () => {
    const evaluate = vi.fn().mockResolvedValue({
      ok: true,
      scores: [{ labelId: 1, value: 0.1 }, { labelId: 2, value: 0.9 }],
    });

    const result = await runJevRecursiveDrilldown({
      state: '評価対象', roots: tree, evaluate, maxDepth: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stopReason).toBe('max_depth');
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('重複IDを含む循環相当のツリーは問い合わせ前に拒否する', async () => {
    const cyclicById: JevDrilldownNode[] = [{
      id: 1,
      question: '親',
      criteria: ['悪い', '良い'],
      children: [{ id: 1, question: '同じIDの子', criteria: ['悪い', '良い'] }],
    }];
    const evaluate = vi.fn();

    const result = await runJevRecursiveDrilldown({ state: '評価対象', roots: cyclicById, evaluate });

    expect(result).toEqual({ ok: false, errorCode: 'invalid_tree', detail: '質問ID 1 が重複しています' });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('途中のJevエラーを、それまでの評価結果と失敗した深さ付きで返す', async () => {
    const evaluate = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        scores: [{ labelId: 1, value: 0.4 }, { labelId: 2, value: 0.9 }],
      })
      .mockResolvedValueOnce({ ok: false, errorCode: 'http_error', detail: 'timeout' });

    const result = await runJevRecursiveDrilldown({ state: '評価対象', roots: tree, evaluate });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe('jev_error');
    if (result.errorCode !== 'jev_error') return;
    expect(result.failedDepth).toBe(1);
    expect(result.findings).toHaveLength(2);
    expect(result.detail).toContain('timeout');
  });
});
