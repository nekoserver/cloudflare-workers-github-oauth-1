/**
 * Workers Buildsのログ解析(MoonBit実装、moonbit/buildlog/)をTypeScriptから呼ぶ。
 * MoonBitから生成したJS(src/generated/moonbit/buildlog.js)はJSON文字列を返すため、
 * ここで形を検証し、成功/失敗を判別可能な型にして返す。
 */
import { analyze_build_log } from '../generated/moonbit/buildlog.js';

export type BuildLogStepState = 'running' | 'done' | 'cached' | 'error' | 'canceled';
export interface AnalyzedBuildStep { id: number; label: string; state: BuildLogStepState; seconds: number | null }
export type BuildLogErrorCode = 'step_id_reused' | 'too_many_steps' | 'invalid_output';
export type BuildLogAnalysis =
  | { ok: true; steps: AnalyzedBuildStep[] }
  | { ok: false; errorCode: BuildLogErrorCode; detail: string };

const STATES: readonly string[] = ['running', 'done', 'cached', 'error', 'canceled'];
const ERROR_CODES: readonly string[] = ['step_id_reused', 'too_many_steps'];

function isStep(value: unknown): value is AnalyzedBuildStep {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return Number.isSafeInteger(s.id) && typeof s.label === 'string' && typeof s.state === 'string' && STATES.includes(s.state)
    && (s.seconds === null || (typeof s.seconds === 'number' && Number.isFinite(s.seconds)));
}

/** MoonBitが返したJSON文字列を検証する。想定外の形はinvalid_outputとして返す(推測で補わない)。 */
export function parseAnalysisOutput(raw: string): BuildLogAnalysis {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return { ok: false, errorCode: 'invalid_output', detail: 'MoonBitの解析結果がJSONではありません: ' + String(error) };
  }
  const v = value as Record<string, unknown> | null;
  if (v && v.ok === true && Array.isArray(v.steps) && v.steps.every(isStep)) return { ok: true, steps: v.steps };
  if (v && v.ok === false && typeof v.errorCode === 'string' && ERROR_CODES.includes(v.errorCode) && typeof v.detail === 'string') {
    return { ok: false, errorCode: v.errorCode as BuildLogErrorCode, detail: v.detail };
  }
  return { ok: false, errorCode: 'invalid_output', detail: 'MoonBitの解析結果の形が想定と異なります: ' + raw.slice(0, 200) };
}

export function analyzeBuildLog(log: string): BuildLogAnalysis {
  return parseAnalysisOutput(analyze_build_log(log));
}
