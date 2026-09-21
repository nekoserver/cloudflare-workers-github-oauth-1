import type { JevApiResult, JevLabel } from './jevEvaluation';

export type JevDrilldownNode = {
  id: number;
  question: string;
  criteria: [string, string] | string[];
  children?: JevDrilldownNode[];
};

export type JevDrilldownFinding = {
  labelId: number;
  question: string;
  value: number;
  depth: number;
  parentLabelId: number | null;
  shouldDrillDown: boolean;
};

export type JevDrilldownStopReason = 'completed' | 'max_depth' | 'question_budget';

export type JevDrilldownResult =
  | {
      ok: true;
      findings: JevDrilldownFinding[];
      evaluatedQuestionCount: number;
      rounds: number;
      stopReason: JevDrilldownStopReason;
    }
  | {
      ok: false;
      errorCode: 'invalid_config' | 'invalid_tree';
      detail: string;
    }
  | {
      ok: false;
      errorCode: 'jev_error';
      detail: string;
      failedDepth: number;
      findings: JevDrilldownFinding[];
      evaluatedQuestionCount: number;
      rounds: number;
    };

export type JevDrilldownEvaluator = (state: string, labels: JevLabel[]) => Promise<JevApiResult>;

type PendingNode = { node: JevDrilldownNode; depth: number; parentLabelId: number | null };

/**
 * 広い観点から評価を始め、閾値以下だった観点の子質問だけを次のラウンドで
 * Jevへ送る。深さと総質問数を必ず制限し、再帰的な外部API呼び出しの暴走を防ぐ。
 */
export async function runJevRecursiveDrilldown(params: {
  state: string;
  roots: JevDrilldownNode[];
  evaluate: JevDrilldownEvaluator;
  threshold?: number;
  maxDepth?: number;
  maxQuestions?: number;
}): Promise<JevDrilldownResult> {
  const threshold = params.threshold ?? 0.6;
  const maxDepth = params.maxDepth ?? 3;
  const maxQuestions = params.maxQuestions ?? 20;

  const configError = validateConfig(threshold, maxDepth, maxQuestions);
  if (configError) return { ok: false, errorCode: 'invalid_config', detail: configError };
  const treeError = validateTree(params.roots);
  if (treeError) return { ok: false, errorCode: 'invalid_tree', detail: treeError };

  let frontier: PendingNode[] = params.roots.map((node) => ({ node, depth: 0, parentLabelId: null }));
  const findings: JevDrilldownFinding[] = [];
  let evaluatedQuestionCount = 0;
  let rounds = 0;
  let stoppedByDepth = false;
  let stoppedByBudget = false;

  while (frontier.length > 0) {
    const remaining = maxQuestions - evaluatedQuestionCount;
    if (remaining <= 0) {
      stoppedByBudget = true;
      break;
    }
    if (frontier.length > remaining) stoppedByBudget = true;
    const current = frontier.slice(0, remaining);
    const labels = current.map(({ node }) => ({
      id: node.id,
      question_text: node.question,
      criteria: node.criteria,
    }));
    const response = await params.evaluate(params.state, labels);
    rounds += 1;
    if (response.ok === false) {
      return {
        ok: false,
        errorCode: 'jev_error',
        detail: response.detail,
        failedDepth: current[0]?.depth ?? 0,
        findings,
        evaluatedQuestionCount,
        rounds,
      };
    }

    const scores = new Map(response.scores.map((score) => [score.labelId, score.value]));
    const next: PendingNode[] = [];
    for (const pending of current) {
      const value = scores.get(pending.node.id);
      if (value === undefined) {
        return {
          ok: false,
          errorCode: 'jev_error',
          detail: `質問ID ${pending.node.id} の評価結果がありません`,
          failedDepth: pending.depth,
          findings,
          evaluatedQuestionCount,
          rounds,
        };
      }
      const shouldDrillDown = value <= threshold && (pending.node.children?.length ?? 0) > 0;
      findings.push({
        labelId: pending.node.id,
        question: pending.node.question,
        value,
        depth: pending.depth,
        parentLabelId: pending.parentLabelId,
        shouldDrillDown,
      });
      evaluatedQuestionCount += 1;
      if (!shouldDrillDown) continue;
      if (pending.depth >= maxDepth) {
        stoppedByDepth = true;
        continue;
      }
      for (const child of pending.node.children ?? []) {
        next.push({ node: child, depth: pending.depth + 1, parentLabelId: pending.node.id });
      }
    }
    frontier = next;
  }

  return {
    ok: true,
    findings,
    evaluatedQuestionCount,
    rounds,
    stopReason: stoppedByBudget ? 'question_budget' : stoppedByDepth ? 'max_depth' : 'completed',
  };
}

function validateConfig(threshold: number, maxDepth: number, maxQuestions: number): string | null {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) return 'thresholdは0以上1以下で指定してください';
  if (!Number.isInteger(maxDepth) || maxDepth < 0) return 'maxDepthは0以上の整数で指定してください';
  if (!Number.isInteger(maxQuestions) || maxQuestions < 1) return 'maxQuestionsは1以上の整数で指定してください';
  return null;
}

function validateTree(roots: JevDrilldownNode[]): string | null {
  const ids = new Set<number>();
  const pending = [...roots];
  while (pending.length > 0) {
    const node = pending.pop() as JevDrilldownNode;
    if (ids.has(node.id)) return `質問ID ${node.id} が重複しています`;
    ids.add(node.id);
    if (!Number.isInteger(node.id)) return '質問IDは整数で指定してください';
    if (!node.question.trim()) return `質問ID ${node.id} の質問文が空です`;
    if (node.criteria.length !== 2 || node.criteria.some((value) => typeof value !== 'string')) {
      return `質問ID ${node.id} のcriteriaは2要素の文字列配列にしてください`;
    }
    pending.push(...(node.children ?? []));
  }
  return null;
}
