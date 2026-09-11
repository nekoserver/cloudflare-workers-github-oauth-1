import { looksLikeRubyCode } from './rubyCodeDetector';

/**
 * kimi-codeの生成結果を「Markdownとして保存」した後、/kimi-code/markdown/:id
 * ページで表示するために使う。```で囲まれたコードブロックと、それ以外の地の文
 * (説明文)を分割する純粋関数。dynamicneko(姉妹リポジトリ)のanswer-segments.ts
 * と同じ考え方(正規表現ベースの軽量パーサ)を踏襲している。
 */
export type MarkdownCodeBlockSegment =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; lang: string };

const FENCE_RE = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;

export function splitMarkdownCodeBlocks(markdown: string): MarkdownCodeBlockSegment[] {
  const segments: MarkdownCodeBlockSegment[] = [];
  let lastIndex = 0;

  for (const match of markdown.matchAll(FENCE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', content: markdown.slice(lastIndex, index) });
    }
    const lang = (match[1] || '').toLowerCase();
    const content = match[2].replace(/\n$/, '');
    segments.push({ type: 'code', content, lang });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < markdown.length) {
    segments.push({ type: 'text', content: markdown.slice(lastIndex) });
  }
  if (segments.length === 0) {
    segments.push({ type: 'text', content: markdown });
  }
  return segments;
}

/**
 * kimi-codeの生成結果(通常は素のコード文字列で、```によるMarkdownフェンスを
 * 含まないことが多い)を、保存用のMarkdown文字列に変換する。既に```フェンスを
 * 含んでいれば(モデルがMarkdown形式で返した場合)そのまま使い、二重にフェンス
 * しない。フェンスが無い場合はlooksLikeRubyCode()で言語を推定し(Rubyらしければ
 * ```ruby、そうでなければ言語指定なしの```)、コード全体を1個のフェンスで囲む。
 */
export function wrapCodeAsMarkdown(code: string): string {
  if (code.includes('```')) {
    return code;
  }
  const lang = looksLikeRubyCode(code) ? 'ruby' : '';
  return '```' + lang + '\n' + code + '\n```';
}

/** コードブロックがRuby/WASMで実行可能とみなせるかどうか(言語指定がruby、または未指定でヒューリスティック判定がRuby)。 */
export function isRunnableRubyCodeBlock(segment: { lang: string; content: string }): boolean {
  if (segment.lang === 'ruby' || segment.lang === 'rb') return true;
  if (segment.lang === '') return looksLikeRubyCode(segment.content);
  return false;
}
