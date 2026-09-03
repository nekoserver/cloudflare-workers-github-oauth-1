// /json-explorer ページ(JSONの展開/折り畳みツリー表示・要素抽出)が使う純粋関数群。
// DOM操作(展開/折り畳みのUI状態)を伴わない部分だけをここに切り出し、
// CLAUDE.mdルール15に従いテスト可能にする。

export type JsonPathSegment = string | number;

/**
 * JSON文字列をパースする。失敗時は例外を投げず{ok:false, error}を返す
 * (呼び出し元でユーザーへエラーメッセージを表示するため)。
 */
export function parseJsonSafe(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * パスのセグメント配列(例: ['a', 0, 'b'])をJS風のドット/添字表記
 * (例: "root.a[0].b")へ整形する。ツリーのノードをクリックした際に
 * 「どこを抽出したか」を利用者へ示すために使う。
 */
export function formatJsonPath(segments: JsonPathSegment[]): string {
  let out = 'root';
  for (const seg of segments) {
    if (typeof seg === 'number') {
      out += '[' + seg + ']';
    } else {
      out += '.' + seg;
    }
  }
  return out;
}

/**
 * ルート値からパスのセグメント配列をたどって値を取得する。
 * 途中で存在しないキー/範囲外の添字に当たった場合はundefinedを返す
 * (クラッシュさせない)。
 */
export function getValueAtPath(root: unknown, segments: JsonPathSegment[]): unknown {
  let current: unknown = root;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string | number, unknown>)[seg as never];
  }
  return current;
}
