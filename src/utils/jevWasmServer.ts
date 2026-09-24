import {
  initSync,
  parse_label_criteria,
  compute_jev_evaluation_plan,
  build_jev_request_body,
  parse_jev_api_response,
} from '../../public/wasm/jev.js';
import jevWasmModule from '../../public/wasm/jev_bg.wasm';
import type { JevLabel, JevScoreResult, JevEvaluationPlan, JevApiResult } from './jevEvaluation';

let initialized = false;

function ensureInit(): void {
  if (!initialized) {
    initSync(jevWasmModule);
    initialized = true;
  }
}

/**
 * Jev評価の「純粋ロジック」(入力検証・APIペイロード生成・レスポンス解析・
 * 出力整形)をRust/WASM実装(wasm/jev-wasm/)経由で実行する。HTTP通信・
 * APIキー・D1・認可はこのファイルの外(Worker/index.ts)側に残す。
 * jevEvaluation.tsの同名関数(TS実装)と入出力互換になるようJSON文字列で橋渡しする。
 *
 * このファイルはindex.ts側からdynamic import()でのみ読み込むこと
 * (NOTICE.rust-WASM.mdの5番: .wasmの静的importをindex.tsから辿ると
 * Vite/vitest環境でテスト収集が壊れる)。
 */
export function parseLabelCriteriaViaWasm(optionsJson: string | null): string[] | null {
  ensureInit();
  const result = parse_label_criteria(optionsJson ?? undefined);
  if (result === null || result === undefined) return null;
  return JSON.parse(result as unknown as string) as string[];
}

export function computeJevEvaluationPlanViaWasm(
  allLabels: JevLabel[],
  evaluatedRows: { jev_label_id: number; value: number }[],
): JevEvaluationPlan {
  ensureInit();
  const json = compute_jev_evaluation_plan(JSON.stringify(allLabels), JSON.stringify(evaluatedRows));
  return JSON.parse(json) as JevEvaluationPlan;
}

export function buildJevRequestBodyViaWasm(state: string, labels: JevLabel[]): unknown {
  ensureInit();
  const json = build_jev_request_body(state, JSON.stringify(labels));
  return JSON.parse(json);
}

export function parseJevApiResponseViaWasm(labels: JevLabel[], response: unknown): JevApiResult {
  ensureInit();
  const json = parse_jev_api_response(JSON.stringify(labels), JSON.stringify(response));
  const parsed = JSON.parse(json) as
    | { ok: true; scores: JevScoreResult[] }
    | { ok: false; errorCode: 'unexpected_shape'; detail: string };
  return parsed;
}
