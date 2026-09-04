/**
 * 「縦線+丸(list-style:circle)」のスレッド/タイムライン表現を、どのページでも
 * 使い回せる共通CSSアセットとして切り出したもの。
 *
 * 由来: 姉妹リポジトリcf-authの/wspaceフィード画面で、AI要約への自動診断
 * レビュー(reviewer_name='auto-diagnosis')をMarkdown箇条書きとして表示する際、
 * `<ul class="thread">`(border-leftで縦線)の中に`<ul>`(list-style:circle)を
 * ネストする形で偶然できていた見た目。CSSだけで実現できているため、このリポジトリ
 * でも同じ視覚表現を再利用できるよう、getThemeCSS()等と同じ「関数でCSSを返し、
 * 埋め込みたいページの<style>内で呼び出す」方式で切り出した。
 *
 * 使い方: getThreadTimelineCSS()を<style>内に展開し、`<ul class="thread-timeline">`
 * の中に`<li>`を並べる(各<li>の中でさらに`<ul>`/`<li>`のMarkdownリストを使うと、
 * 縦線に沿って丸が並ぶタイムライン風の見た目になる)。用途例: リポジトリの
 * コミット履歴を時系列に並べる、AI要約や診断コメントを積み重ねて表示する、など。
 */

/** <style>内に展開する、スレッド/タイムライン表現のCSS。 */
export function getThreadTimelineCSS(): string {
  return `
    .thread-timeline {
      list-style: none;
      border-left: 2px solid var(--border-color);
      margin: 8px 0;
      padding: 4px 0 4px 12px;
    }
    .thread-timeline > li {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    .thread-timeline > li:last-child { margin-bottom: 0; }
    .thread-timeline ul {
      list-style: circle;
      margin: 4px 0 4px 20px;
      color: var(--text-secondary);
    }
    .thread-timeline ul li { margin-bottom: 2px; }
  `;
}

/**
 * 呼び出し元が組み立て済みの(エスケープ・Markdown変換済みの)HTML文字列を
 * `<ul class="thread-timeline"><li>...</li>...</ul>`へ並べる純粋関数。
 * itemsHtmlの各要素はそのまま<li>の中身として展開されるため、エスケープや
 * Markdown変換は呼び出し元の責任で行うこと(このリポジトリでは
 * src/utils/html.tsのescapeHtml()やgetMarkdownParserScript()の
 * parseMd()を使う想定)。空配列なら空文字列を返す(何も描画しない)。
 */
export function renderThreadTimelineList(itemsHtml: string[]): string {
  if (itemsHtml.length === 0) return '';
  const items = itemsHtml.map((html) => `<li>${html}</li>`).join('');
  return `<ul class="thread-timeline">${items}</ul>`;
}
