/**
 * /md-previewページの「Text→.md」機能の純粋ロジック。
 * 任意のプレーンテキストを、Markdownとして誤解釈されない
 * フェンス付きコードブロックへ変換する。
 */

/**
 * テキスト中に連続して出現するバッククォート(`)の最大連続数を数える。
 * フェンス文字列(```)自体を含むテキストを埋め込む際に、フェンスの長さを
 * 決めるために使う。
 */
function longestBacktickRun(text: string): number {
  let max = 0;
  let current = 0;
  for (const ch of text) {
    if (ch === '`') {
      current += 1;
      if (current > max) max = current;
    } else {
      current = 0;
    }
  }
  return max;
}

/**
 * プレーンテキストをMarkdownのフェンス付きコードブロックに変換する。
 * テキスト自体にバッククォートの連続(```など)が含まれていても、
 * フェンスがテキスト内容と衝突しないよう、内容中の最長連続数+1本の
 * バッククォートをフェンスとして使う(最低3本)。
 */
export function wrapAsMarkdownCodeBlock(text: string): string {
  const fenceLength = Math.max(3, longestBacktickRun(text) + 1);
  const fence = '`'.repeat(fenceLength);
  return `${fence}\n${text}\n${fence}`;
}
