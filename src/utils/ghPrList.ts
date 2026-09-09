// /neko gh pr list・GET /api/gh/pr-list 用の純粋関数群。
// 実際のGitHub API呼び出し・gh-wasm(.wasm)実行を伴う部分はテスト環境
// (vitest)で実際に動かせない(wasm-bindgen出力の内部import解決がNode/Vite
// では失敗する)ため、CLAUDE.mdルール15に従い、テスト可能な純粋ロジックだけを
// ここに切り出す(src/index.tsのfetchAndFormatGhPrListから呼び出す)。

/**
 * 設定ページの「スラッシュコマンドからのプルリク応答で作成者を伏せる」
 * トグル(Cookie: neko_pr_hide_author)の値から、作成者を伏せるかどうかを
 * 判定する。Cookie未設定(初回訪問等)の場合はデフォルトON(伏せる)として
 * 扱う(設定ページ側の初期表示デフォルトと合わせる)。'off'のときのみ
 * 実名表示にする。
 */
export function resolveHideAuthorFromCookie(cookieValue: string | null): boolean {
  return cookieValue !== 'off';
}

/**
 * GitHub REST APIの一覧取得(GET /repos/{owner}/{repo}/pulls)はmergeable_state
 * を返さないため、Worker側で1件ずつ個別取得(GET /repos/{owner}/{repo}/pulls/{number})
 * した結果をstatesへ集約し、この関数で一覧のJSON配列へ結合する。
 * statesに該当するnumberが無い(個別取得に失敗した等)場合はmergeable_stateを
 * 付与せず、gh-wasm側で「確認中」表示にフォールバックさせる。
 */
export function mergePrMergeableStates(
  prs: Array<Record<string, unknown>>,
  states: Map<number, string | null>
): Array<Record<string, unknown>> {
  return prs.map((pr) => {
    const number = pr.number;
    if (typeof number !== 'number' || !states.has(number)) {
      return pr;
    }
    return { ...pr, mergeable_state: states.get(number) };
  });
}
