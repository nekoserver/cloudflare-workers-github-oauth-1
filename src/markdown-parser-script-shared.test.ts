import { describe, it, expect } from 'vitest';
import { getMarkdownParserScript } from './utils/markdownRenderer';
import { getAiChatPage } from './views/aichat';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: AIチャットページ(aichat.ts)とanswer-graphページ(answerGraph.ts)の
// クライアント側Markdownパーサーを、既存の共有ユーティリティ
// src/utils/markdownRenderer.ts (getMarkdownParserScript) へ一元化したこと。
//
// 背景: 当初、aichat.tsとanswerGraph.tsは同じparseMd実装(mdEsc/mdInline/
// mdSplitRow/mdParseList/parseMd)をそれぞれ個別に複製していた。ところが
// webglHeritage.ts・heritageArea.ts・markdown-preview.tsは既に
// src/utils/markdownRenderer.ts の getMarkdownParserScript() を共有利用しており、
// aichat.ts/answerGraph.ts独自の複製はこの既存の共有基盤を見落として作られた
// 車輪の再発明だった。両ページを既存の共有ユーティリティへ差し替えて統合した。
//
// 既存実装(markdownRenderer.ts)はXSS対策(isSafeMdUrlによるjavascript:等の
// 危険なURLスキーム拒否)も備えており、aichat.ts/answerGraph.tsが個別に
// 複製していた実装より安全である。
//
// 故障シナリオ:
//   (1) aichat.ts/answerGraph.tsがparseMd(...)以外にmdEsc/mdInline等の
//       内部ヘルパー関数名を直接呼び出している箇所が残っていて、
//       markdownRenderer.ts側の内部関数名(esc/inline等)と食い違い、
//       差し替え後に参照エラーになる
//   (2) 差し替えにより生成されたJSが構文エラーになる
//   (3) 2ページの出力するMarkdownパーサーのソースが一致しない(片方だけ
//       差し替えが漏れている)

describe('aichat.ts / answerGraph.ts: 既存の共有Markdownパーサー(markdownRenderer.ts)を利用する', () => {
  it('aichat.ts が parseMd(...) 以外の内部ヘルパー(mdEsc/mdInline等)を直接呼び出していない', () => {
    const html = getAiChatPage({
      username: 'testuser',
      aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      modelColors: {},
    });
    expect(html).not.toContain('mdEsc(');
    expect(html).not.toContain('mdInline(');
    expect(html).not.toContain('mdSplitRow(');
    expect(html).not.toContain('mdParseList(');
    expect(html).toContain('parseMd(');
  });

  it('answerGraph.ts が parseMd(...) 以外の内部ヘルパー(mdEsc/mdInline等)を直接呼び出していない', () => {
    const html = getAnswerGraphPage('testuser');
    expect(html).not.toContain('mdEsc(');
    expect(html).not.toContain('mdInline(');
    expect(html).not.toContain('mdSplitRow(');
    expect(html).not.toContain('mdParseList(');
    expect(html).toContain('parseMd(');
  });

  it('aichatページとanswer-graphページに埋め込まれるMarkdownパーサーのソースは完全に一致する(共有元が同一)', () => {
    const aichatHtml = getAiChatPage({
      username: 'testuser',
      aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      modelColors: {},
    });
    const answerGraphHtml = getAnswerGraphPage('testuser');
    const shared = getMarkdownParserScript();
    expect(aichatHtml).toContain(shared);
    expect(answerGraphHtml).toContain(shared);
  });

  it('共有パーサーは危険なURLスキーム(javascript:)を無害化する(既存実装のXSS対策を引き継いでいること)', () => {
    const src = getMarkdownParserScript();
    const fn = new Function(`${src}\nreturn parseMd;`);
    const parseMd = fn() as (s: string) => string;
    const out = parseMd('[click](javascript:alert(1))');
    expect(out).not.toContain('href="javascript:');
  });

  it('共有パーサーは見出し・太字・リストを正しくHTML化する(実動作確認)', () => {
    const src = getMarkdownParserScript();
    const fn = new Function(`${src}\nreturn parseMd;`);
    const parseMd = fn() as (s: string) => string;
    const out = parseMd('# 見出し\n\n**太字**\n\n- 項目');
    expect(out).toContain('<h1>見出し</h1>');
    expect(out).toContain('<strong>太字</strong>');
    expect(out).toContain('<li>項目</li>');
  });
});
