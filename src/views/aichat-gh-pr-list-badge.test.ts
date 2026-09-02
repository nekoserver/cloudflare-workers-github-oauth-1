// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './aichat';
import { getMarkdownParserScript } from '../utils/markdownRenderer';
import { extractFunctionSource } from '../utils/extractFunctionSource';

const minimalUser = {
  username: 'testuser',
  aiChatModel: 'claude-sonnet-4-6',
};

// 対象: /neko gh pr list の応答バブル(src/views/aichat.ts の styleGhPrListBubble)。
// gh-wasm(Rust)が返すMarkdownテーブルをparseMdでHTML化した後、状態
// (open/draft)列をGitHub準拠の色バッジへ置き換え、応答バブルに
// gh-pr-list-bubbleクラス(右端の余白ゼロ)を付与する。
//
// 故障シナリオ:
//   (1) 見出し(「のプルリクエスト一覧」)を含まない通常のMarkdownテーブルにまで
//       誤って適用してしまう(他の機能のテーブル表示を壊す)
//   (2) 状態列がopen/draft以外の値(closed等)のときに未対応でエラーになる、
//       またはバッジに変換されない
//   (3) No.列の右寄せ・作成者列の中央寄せ(parseMdの列揃え記法)が
//       実際にth/tdのstyle属性へ反映されない
function loadParseMd() {
  const script = getMarkdownParserScript();
  const fn = new Function(script + '\nreturn parseMd;');
  return fn();
}

function loadStyleGhPrListBubble() {
  const html = getAiChatPage(minimalUser);
  const src = extractFunctionSource(html, 'styleGhPrListBubble');
  expect(src, 'styleGhPrListBubble が生成HTMLから見つからない').toBeTruthy();
  const fn = new Function('document', `${src}\nreturn styleGhPrListBubble;`);
  return fn(document);
}

const SAMPLE_MARKDOWN = [
  '## Pulls 一覧(Draft : 1/Open : 1)',
  '| No. | タイトル | 作成者 | 状態 |',
  '|---:|---|:---:|---|',
  '| [000042](https://github.com/o/r/pull/42) | Fix bug | alice | open |',
  '| [000043](https://github.com/o/r/pull/43) | WIP feature | *** | draft |',
].join('\n');

describe('styleGhPrListBubble', () => {
  it('見出しを含む場合、bubble要素にgh-pr-list-bubbleクラスを付与する', () => {
    const parseMd = loadParseMd();
    const styleGhPrListBubble = loadStyleGhPrListBubble();
    const el = document.createElement('div');
    el.innerHTML = parseMd(SAMPLE_MARKDOWN);
    styleGhPrListBubble(el, SAMPLE_MARKDOWN);
    expect(el.classList.contains('gh-pr-list-bubble')).toBe(true);
  });

  it('見出しを含まない通常のMarkdownには適用しない(誤爆しない)', () => {
    const parseMd = loadParseMd();
    const styleGhPrListBubble = loadStyleGhPrListBubble();
    const el = document.createElement('div');
    const other = '| A | B |\n|---|---|\n| x | y |';
    el.innerHTML = parseMd(other);
    styleGhPrListBubble(el, other);
    expect(el.classList.contains('gh-pr-list-bubble')).toBe(false);
    expect(el.querySelector('.gh-pr-state-badge')).toBeNull();
  });

  it('open/draftの状態セルをGitHub準拠の色バッジ(span)へ置き換える', () => {
    const parseMd = loadParseMd();
    const styleGhPrListBubble = loadStyleGhPrListBubble();
    const el = document.createElement('div');
    el.innerHTML = parseMd(SAMPLE_MARKDOWN);
    styleGhPrListBubble(el, SAMPLE_MARKDOWN);
    const badges = el.querySelectorAll('.gh-pr-state-badge');
    expect(badges.length).toBe(2);
    expect(badges[0].classList.contains('gh-pr-state-open')).toBe(true);
    expect(badges[0].textContent).toBe('Open');
    expect(badges[1].classList.contains('gh-pr-state-draft')).toBe(true);
    expect(badges[1].textContent).toBe('Draft');
  });

  it('closed状態もバッジに変換する(将来state=allになった場合の保険)', () => {
    const parseMd = loadParseMd();
    const styleGhPrListBubble = loadStyleGhPrListBubble();
    const md = [
      '## Pulls 一覧(Draft : 0/Open : 1)',
      '| No. | タイトル | 作成者 | 状態 |',
      '|---:|---|:---:|---|',
      '| [000001](https://github.com/o/r/pull/1) | t | a | closed |',
    ].join('\n');
    const el = document.createElement('div');
    el.innerHTML = parseMd(md);
    styleGhPrListBubble(el, md);
    const badge = el.querySelector('.gh-pr-state-badge');
    expect(badge?.classList.contains('gh-pr-state-closed')).toBe(true);
    expect(badge?.textContent).toBe('Closed');
  });

  it('No.列は右寄せ(th/tdにtext-align:right)、作成者列は中央寄せになる(parseMdの列揃え反映)', () => {
    const parseMd = loadParseMd();
    const html = parseMd(SAMPLE_MARKDOWN);
    const el = document.createElement('div');
    el.innerHTML = html;
    const headerCells = el.querySelectorAll('th');
    expect(headerCells[0].getAttribute('style')).toContain('text-align:right');
    expect(headerCells[2].getAttribute('style')).toContain('text-align:center');
    const firstRowCells = el.querySelectorAll('tbody tr:first-child td');
    expect(firstRowCells[0].getAttribute('style')).toContain('text-align:right');
    expect(firstRowCells[2].getAttribute('style')).toContain('text-align:center');
  });
});
