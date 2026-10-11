// Cloudflare Workers AIのClef(決定モデル)プレイグラウンド用。
// Clefは「Jev互換」(state+questions、質問type=noul/choice/scoreが同じ形)を
// 公式に名乗っているため、既存のJev Playground(validateJevPlaygroundPayload、
// src/index.ts)のリクエスト検証をそのまま使い、ここではモデルIDの解決と
// env.AI.run呼び出しだけを担う。
//
// 2026-10-11、実機で確認(ユーザー報告のエラーで裏取り): inputオブジェクト
// 内のmodelフィールドは、Workers AIカタログの完全なID
// (@cf/cloudflare/clef-flash等)ではなく、正規表現
// ^\s*(clef|clef-flash)\s*$ に一致する短い名前のみ受け付ける
// (実際に返ってきたエラー: "'/model' failed test ^\s*(clef|clef-flash)\s*$
// patttern")。ai.run()の第一引数(Workers AIバインディングのモデル選択)は
// 従来通りカタログの完全なIDを使うが、input.model(Clef自身のリクエスト
// スキーマが要求するフィールド)は短い名前にする必要がある。
//
// なお clef-omni(音声・動画対応モデル、@cf/cloudflare/clef-omni)は実在
// する(2026-10-11、ユーザー提示の公式モデル一覧で確認)。上記の正規表現
// がclef/clef-flashの2つしか列挙していないのは「存在しないから」では
// なく、音声・動画入力を扱う別のリクエストスキーマを使うためと考えられる
// (未検証)。本プレイグラウンドはテキストのみのstate+questions形式
// (Jev互換)専用のため、clef-omniはスキーマ非対応として選択肢から除外
// している。

/** Workers AIバインディングへ渡す、カタログ上の完全なモデルID。 */
export const CLEF_PLAYGROUND_MODELS = [
  '@cf/cloudflare/clef',
  '@cf/cloudflare/clef-flash',
] as const;

export type ClefPlaygroundModel = (typeof CLEF_PLAYGROUND_MODELS)[number];

/** 既定モデル。レイテンシ・コストが低いclef-flashを試用のデフォルトにする。 */
export const DEFAULT_CLEF_MODEL: ClefPlaygroundModel = '@cf/cloudflare/clef-flash';

/**
 * リクエストのmodel指定を検証する。CLEF_PLAYGROUND_MODELSに無い値
 * (未指定・誤記・他モデルのID等)は既定モデルへフォールバックする
 * (存在しないモデルIDをそのままenv.AI.run()へ渡して例外にしない)。
 */
export function resolveClefPlaygroundModel(model: unknown): ClefPlaygroundModel {
  return typeof model === 'string' && (CLEF_PLAYGROUND_MODELS as readonly string[]).includes(model)
    ? (model as ClefPlaygroundModel)
    : DEFAULT_CLEF_MODEL;
}

/**
 * ai.run()の第一引数(カタログの完全なID、@cf/cloudflare/clef-flash等)から、
 * Clef自身のリクエストスキーマが要求する短い名前(clef・clef-flash)を
 * 取り出す。Clefのinput.modelフィールドは正規表現
 * ^\s*(clef|clef-flash)\s*$ でしか検証を通らないため、完全なIDをそのまま
 * 渡すと "'/model' failed test ... pattern" で失敗する(実機で確認)。
 */
export function toClefShortModelName(model: ClefPlaygroundModel): string {
  return model.replace(/^@cf\/cloudflare\//, '');
}

export type ClefAiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

export type ClefPlaygroundOutcome =
  | { ok: true; model: ClefPlaygroundModel; result: unknown }
  | { ok: false; errorDetail: string };

/**
 * ai.run()の成功結果をHTTPレスポンス本文用のオブジェクトに整形する。
 * 呼び出したmodel名(カタログの完全なID)を先頭に付け、result自体が
 * オブジェクトならそのフィールドを展開し、オブジェクトでない場合
 * (文字列・配列等)は{result: ...}へ包む。
 * /api/clef-playground・/api/clef-playground-externalの両方で使う。
 */
export function buildClefPlaygroundResponseBody(outcome: { model: ClefPlaygroundModel; result: unknown }): Record<string, unknown> {
  const resultFields = typeof outcome.result === 'object' && outcome.result !== null
    ? outcome.result as Record<string, unknown>
    : { result: outcome.result };
  return { model: outcome.model, ...resultFields };
}

/**
 * 検証済みpayload({state, questions, model?})からmodelを解決し、
 * env.AI.run(完全なモデルID, {model: 短い名前, state, questions})を呼ぶ。
 * input.modelはClef自身のスキーマが要求する短い名前(clef・clef-flash)に
 * する必要があり、ai.run()の第一引数(カタログの完全なID)とは別物
 * (詳細はファイル先頭のコメント参照)。
 *
 * 失敗はerrorDetailにメッセージを入れて返す(呼び出し元でログ記録・
 * HTTPステータス決定を行う)。
 */
export async function callClefPlaygroundModel(
  ai: ClefAiBinding,
  payload: Record<string, unknown>
): Promise<ClefPlaygroundOutcome> {
  const model = resolveClefPlaygroundModel(payload.model);
  const { model: _model, ...rest } = payload;
  const input = { ...rest, model: toClefShortModelName(model) };
  try {
    const result = await ai.run(model, input);
    return { ok: true, model, result };
  } catch (error) {
    return { ok: false, errorDetail: error instanceof Error ? error.message : String(error) };
  }
}
