/**
 * claude/codex(/neko askgk claude_prompt=/codex_prompt=)の回答文に含まれる
 * Markdownリンクを脚注化する。同一URLは重複させず出現順に通し番号を振り、
 * 元のリンク位置には通し番号だけのリンクを残し、本文の末尾に通し番号付きの
 * リンク一覧を縦に追記する(ユーザー要望)。
 *
 * ブラウザの<script>内に埋め込むため(aichat.tsでfunction.toString()経由で
 * 文字列化する)、矢印関数・分割代入・for...of等の新しめの構文は避け、
 * 既存のformatAskgkPromptQuestion等と同じ素朴な関数宣言のみを使う。
 *
 * 画像記法(![alt](url))は対象外(見た目が変わってしまうため、リンクのみ処理する)。
 */
export function convertAnswerLinksToFootnotes(markdown: string): string {
  var urlToNum: Record<string, number> = {};
  var uniqueUrls: string[] = [];
  var linkRe = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;

  var converted = markdown.replace(linkRe, function (match, bang, _label, url) {
    if (bang === '!') return match;
    if (!Object.prototype.hasOwnProperty.call(urlToNum, url)) {
      uniqueUrls.push(url);
      urlToNum[url] = uniqueUrls.length;
    }
    return '[' + urlToNum[url] + '](' + url + ')';
  });

  if (!uniqueUrls.length) return markdown;

  var footerLines: string[] = [];
  for (var i = 0; i < uniqueUrls.length; i++) {
    var url = uniqueUrls[i];
    footerLines.push((i + 1) + '. [' + url + '](' + url + ')');
  }

  return converted + '\n\n---\n' + footerLines.join('\n');
}
