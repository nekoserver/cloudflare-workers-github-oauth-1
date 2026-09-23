import { isMissingTableError } from './jevAnswerValues';

// 「ある問いへの回答に含まれるキーワードのうち、まだ理解していないもの
// (探索の境界線の外側)を追跡し、次の探索でその境界線を意識しながら
// 問い進められるようにする」機能。jev_evaluations/jev_country_keyword_evaluations
// と同じ「keyword + ラベル + value」のテーブル形(=「jev形式」)を踏襲するが、
// このvalueはJev API(callJevApi)による客観的な判定結果ではなく、
// ユーザー本人の理解状況というアプリ側・ユーザー側が持つ主観的な状態である
// 点が他のjev_*テーブルと異なる(Jev APIには「このユーザーが理解済みか」を
// 判定させようがないため)。テーブル名にboundaryを含めて区別している。
//
// マイグレーション0156(jev_keyword_boundary_labels/jev_keyword_boundary_evaluations)
// を前提とする。ラベルは常に1件(BOUNDARY_LABEL_QUESTION_TEXT)のみ想定だが、
// 将来の拡張に備えてjev_country_keyword_labelsと同じくラベルをテーブルに
// 分けている。

export const BOUNDARY_LABEL_QUESTION_TEXT = 'このキーワードをユーザーは理解済みですか?';

export type KeywordBoundaryStatus = 'known' | 'unknown';

export type KeywordBoundaryEntry = { keyword: string; status: KeywordBoundaryStatus };

export type KeywordBoundaryDb = {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      all<T>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
    };
  };
};

/** 前後の空白を除去し、空文字列・重複を取り除く(最初に現れた順を保つ)。 */
function dedupeKeywords(rawKeywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawKeywords) {
    const keyword = raw.trim();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    result.push(keyword);
  }
  return result;
}

type LabelIdResult = { ok: true; id: number } | { ok: false; error: string };

/**
 * jev_keyword_boundary_labelsの先頭(id昇順)の1件をラベルとして使う。
 * マイグレーション0156が必ず1件シードするため、0件はマイグレーション
 * 未適用を意味する。
 */
async function getBoundaryLabelId(db: KeywordBoundaryDb): Promise<LabelIdResult> {
  try {
    const rows = await db
      .prepare('SELECT id FROM jev_keyword_boundary_labels ORDER BY id ASC LIMIT 1')
      .bind()
      .all<{ id: number }>();
    const row = rows.results?.[0];
    if (!row) {
      return { ok: false, error: 'jev_keyword_boundary_labelsが1件も登録されていません(マイグレーション未適用の可能性があります)' };
    }
    return { ok: true, id: row.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingTableError(message)) {
      return { ok: false, error: 'jev_keyword_boundary_labelsテーブルが存在しません(マイグレーション未適用の可能性があります)' };
    }
    return { ok: false, error: 'jev_keyword_boundary_labels取得でサーバーエラーが発生しました: ' + message };
  }
}

export type SyncKeywordBoundaryResult = { ok: true; entries: KeywordBoundaryEntry[] } | { ok: false; error: string };

/**
 * keywords(重複・空白は除去)それぞれについて、jev_keyword_boundary_evaluations
 * に既に行があるかを確認する。無いものだけ「未理解(value=0)」として新規登録
 * する(INSERT OR IGNOREのため、既存行があっても上書きしない=手動で
 * 「理解済み」に切り替えた行を巻き戻さない)。書き込みのSQL成功report
 * だけで判断せず、最終的な状態を実際に読み戻して返す(runJevScoreForShareと
 * 同じベリファイ方針)。
 */
export async function syncKeywordBoundary(
  db: KeywordBoundaryDb,
  userId: string,
  rawKeywords: string[],
  sourceShareId: string | null
): Promise<SyncKeywordBoundaryResult> {
  const keywords = dedupeKeywords(rawKeywords);
  if (keywords.length === 0) return { ok: true, entries: [] };

  const labelResult = await getBoundaryLabelId(db);
  if (!labelResult.ok) return { ok: false, error: labelResult.error };
  const labelId = labelResult.id;

  try {
    for (const keyword of keywords) {
      await db
        .prepare(
          'INSERT OR IGNORE INTO jev_keyword_boundary_evaluations (keyword, user_id, jev_keyword_boundary_label_id, value, source_share_id) VALUES (?, ?, ?, 0, ?)'
        )
        .bind(keyword, userId, labelId, sourceShareId)
        .run();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: 'jev_keyword_boundary_evaluations登録でサーバーエラーが発生しました: ' + message };
  }

  try {
    const placeholders = keywords.map(() => '?').join(', ');
    const rows = await db
      .prepare(
        `SELECT keyword, value FROM jev_keyword_boundary_evaluations WHERE user_id = ? AND jev_keyword_boundary_label_id = ? AND keyword IN (${placeholders})`
      )
      .bind(userId, labelId, ...keywords)
      .all<{ keyword: string; value: number }>();
    const valueByKeyword = new Map((rows.results ?? []).map((r) => [r.keyword, r.value]));
    const missing = keywords.filter((k) => !valueByKeyword.has(k));
    if (missing.length > 0) {
      return { ok: false, error: `登録した${missing.length}件のキーワードを読み戻せませんでした(ベリファイ失敗): ${missing.join(', ')}` };
    }
    const entries: KeywordBoundaryEntry[] = keywords.map((keyword) => ({
      keyword,
      status: Number(valueByKeyword.get(keyword)) > 0 ? 'known' : 'unknown'
    }));
    return { ok: true, entries };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: 'jev_keyword_boundary_evaluations読み戻しでサーバーエラーが発生しました: ' + message };
  }
}

export type ToggleKeywordBoundaryResult = { ok: true; entry: KeywordBoundaryEntry } | { ok: false; error: string };

/**
 * 1キーワードの理解状態を明示的にknown/unknownへ切り替える(ユーザーが
 * キーワードチップをクリックした操作に対応)。UPSERT(ON CONFLICT DO UPDATE)
 * で既存行があれば上書き、無ければ新規作成し、書き込み後に読み戻して
 * 実際に反映されたかをベリファイする。
 */
export async function toggleKeywordBoundary(
  db: KeywordBoundaryDb,
  userId: string,
  rawKeyword: string,
  known: boolean
): Promise<ToggleKeywordBoundaryResult> {
  const keyword = rawKeyword.trim();
  if (!keyword) return { ok: false, error: 'keyword は必須です' };

  const labelResult = await getBoundaryLabelId(db);
  if (!labelResult.ok) return { ok: false, error: labelResult.error };
  const labelId = labelResult.id;
  const value = known ? 1 : 0;

  try {
    await db
      .prepare(
        `INSERT INTO jev_keyword_boundary_evaluations (keyword, user_id, jev_keyword_boundary_label_id, value)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, keyword, jev_keyword_boundary_label_id) DO UPDATE SET value = excluded.value, computed_at = datetime('now')`
      )
      .bind(keyword, userId, labelId, value)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: 'jev_keyword_boundary_evaluations更新でサーバーエラーが発生しました: ' + message };
  }

  try {
    const rows = await db
      .prepare('SELECT value FROM jev_keyword_boundary_evaluations WHERE user_id = ? AND keyword = ? AND jev_keyword_boundary_label_id = ?')
      .bind(userId, keyword, labelId)
      .all<{ value: number }>();
    const row = rows.results?.[0];
    if (!row || Number(row.value) !== value) {
      return { ok: false, error: `更新後の値を読み戻せませんでした(ベリファイ失敗): ${keyword}` };
    }
    return { ok: true, entry: { keyword, status: value > 0 ? 'known' : 'unknown' } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: 'jev_keyword_boundary_evaluations読み戻しでサーバーエラーが発生しました: ' + message };
  }
}

export type ListUnknownKeywordsResult =
  | { ok: true; keywords: { keyword: string; computedAt: string; sourceShareId: string | null }[] }
  | { ok: false; error: string };

/**
 * 「未理解(境界線の外側)」のキーワード一覧を、更新が新しい順に返す。
 * 次の質問を組み立てるときに使う想定。
 */
export async function listUnknownKeywords(db: KeywordBoundaryDb, userId: string, limit: number): Promise<ListUnknownKeywordsResult> {
  const labelResult = await getBoundaryLabelId(db);
  if (!labelResult.ok) return { ok: false, error: labelResult.error };
  const labelId = labelResult.id;

  try {
    const rows = await db
      .prepare(
        `SELECT keyword, computed_at, source_share_id FROM jev_keyword_boundary_evaluations
         WHERE user_id = ? AND jev_keyword_boundary_label_id = ? AND value = 0
         ORDER BY computed_at DESC LIMIT ?`
      )
      .bind(userId, labelId, limit)
      .all<{ keyword: string; computed_at: string; source_share_id: string | null }>();
    return {
      ok: true,
      keywords: (rows.results ?? []).map((r) => ({ keyword: r.keyword, computedAt: r.computed_at, sourceShareId: r.source_share_id }))
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: 'jev_keyword_boundary_evaluations取得でサーバーエラーが発生しました: ' + message };
  }
}
