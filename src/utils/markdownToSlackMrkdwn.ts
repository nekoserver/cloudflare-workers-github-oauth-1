/**
 * Slackの@メンションAI応答用。AIが生成したMarkdown(GFM相当)を、Slackの
 * メッセージ記法(mrkdwn)へ変換する。フェンスコードブロック(```)・インライン
 * コード(`code`)は退避してから変換し、他の変換の影響を受けないようにする。
 * & < > はSlack側でリンク/メンション記法と衝突するため先にエスケープする。
 */
export function convertMarkdownToSlackMrkdwn(markdown: string): string {
  if (!markdown) return markdown;

  let text = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const codeBlocks: string[] = [];
  text = text.replace(/```[\s\S]*?```/g, (m) => {
    codeBlocks.push(m);
    return `\u0000CODEBLOCK${codeBlocks.length - 1}\u0000`;
  });

  const inlineCodes: string[] = [];
  text = text.replace(/`[^`\n]+`/g, (m) => {
    inlineCodes.push(m);
    return `\u0000INLINECODE${inlineCodes.length - 1}\u0000`;
  });

  // リンク [text](url) → <url|text>
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<$2|$1>');

  // 箇条書き(- item / * item) → • item(先にitalicと区別する必要があるため
  // 太字/斜体の変換より前に処理する)
  text = text.replace(/^[ \t]*[-*][ \t]+(.+)$/gm, '• $1');

  // **bold** → *bold*、*italic* → _italic_(**が*より優先してマッチするよう
  // 1つの正規表現でまとめて処理し、太字変換後の*が再度斜体化されないようにする)
  text = text.replace(/\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g, (_m, bold: string | undefined, italic: string | undefined) => {
    return bold !== undefined ? `*${bold}*` : `_${italic}_`;
  });

  // __bold__ → *bold*(mrkdwnの太字表記に統一。**/*の変換より後に行うことで
  // 変換結果の*が再度斜体化されるのを防ぐ)
  text = text.replace(/__([^_\n]+)__/g, '*$1*');

  // 見出し(# 〜 ######) → 太字1行(**/*の変換より後に行うことで
  // 変換結果の*が再度斜体化されるのを防ぐ)
  text = text.replace(/^#{1,6}[ \t]+(.+)$/gm, '*$1*');

  text = text.replace(/\u0000INLINECODE(\d+)\u0000/g, (_m, i: string) => inlineCodes[Number(i)]);
  text = text.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_m, i: string) => codeBlocks[Number(i)]);

  return text;
}
