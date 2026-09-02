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
//   (3) No.・作成者・コンフリクト列の中央寄せ(parseMdの列揃え記法)が
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
  '| No. | タイトル | 作成者 | 状態 | コンフリクト |',
  '|:---:|---|:---:|---|:---:|',
  '| [000042](https://github.com/o/r/pull/42) | Fix bug | alice | open | あり |',
  '| [000043](https://github.com/o/r/pull/43) | WIP feature | *** | draft | なし |',
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
    const rows = el.querySelectorAll('table tbody tr');
    const row0Badges = rows[0].querySelectorAll('.gh-pr-state-badge');
    const row1Badges = rows[1].querySelectorAll('.gh-pr-state-badge');
    expect(row0Badges[0].classList.contains('gh-pr-state-open')).toBe(true);
    expect(row0Badges[0].textContent).toBe('Open');
    expect(row1Badges[0].classList.contains('gh-pr-state-draft')).toBe(true);
    expect(row1Badges[0].textContent).toBe('Draft');
  });

  it('closed状態もバッジに変換する(将来state=allになった場合の保険)', () => {
    const parseMd = loadParseMd();
    const styleGhPrListBubble = loadStyleGhPrListBubble();
    const md = [
      '## Pulls 一覧(Draft : 0/Open : 1)',
      '| No. | タイトル | 作成者 | 状態 | コンフリクト |',
      '|:---:|---|:---:|---|:---:|',
      '| [000001](https://github.com/o/r/pull/1) | t | a | closed | 確認中 |',
    ].join('\n');
    const el = document.createElement('div');
    el.innerHTML = parseMd(md);
    styleGhPrListBubble(el, md);
    const badges = el.querySelectorAll('table tbody tr:first-child .gh-pr-state-badge');
    expect(badges[0].classList.contains('gh-pr-state-closed')).toBe(true);
    expect(badges[0].textContent).toBe('Closed');
  });

  it('コンフリクト列(あり/なし/確認中)をGitHub準拠の色バッジ(span)へ置き換える', () => {
    const parseMd = loadParseMd();
    const styleGhPrListBubble = loadStyleGhPrListBubble();
    const md = [
      '## Pulls 一覧(Draft : 0/Open : 3)',
      '| No. | タイトル | 作成者 | 状態 | コンフリクト |',
      '|:---:|---|:---:|---|:---:|',
      '| [000001](https://github.com/o/r/pull/1) | a | a | open | あり |',
      '| [000002](https://github.com/o/r/pull/2) | b | b | open | なし |',
      '| [000003](https://github.com/o/r/pull/3) | c | c | open | 確認中 |',
    ].join('\n');
    const el = document.createElement('div');
    el.innerHTML = parseMd(md);
    styleGhPrListBubble(el, md);
    const rows = el.querySelectorAll('table tbody tr');
    const conflictBadge0 = rows[0].querySelectorAll('.gh-pr-state-badge')[1];
    const conflictBadge1 = rows[1].querySelectorAll('.gh-pr-state-badge')[1];
    const conflictBadge2 = rows[2].querySelectorAll('.gh-pr-state-badge')[1];
    expect(conflictBadge0.classList.contains('gh-pr-conflict-yes')).toBe(true);
    expect(conflictBadge0.textContent).toBe('あり');
    expect(conflictBadge1.classList.contains('gh-pr-conflict-no')).toBe(true);
    expect(conflictBadge1.textContent).toBe('なし');
    expect(conflictBadge2.classList.contains('gh-pr-conflict-unknown')).toBe(true);
    expect(conflictBadge2.textContent).toBe('確認中');
  });

  it('コンフリクト「あり」はピンク背景、「なし」は薄緑背景のCSSで定義されている', () => {
    const html = getAiChatPage(minimalUser);
    expect(html).toMatch(/\.gh-pr-state-badge\.gh-pr-conflict-yes\s*\{\s*background:\s*#ffd7e6/);
    expect(html).toMatch(/\.gh-pr-state-badge\.gh-pr-conflict-no\s*\{\s*background:\s*#d4f5d4/);
  });

  it('見出しのDraft/Open件数をGitHub準拠の色バッジ(span)へ置き換える', () => {
    const parseMd = loadParseMd();
    const styleGhPrListBubble = loadStyleGhPrListBubble();
    const el = document.createElement('div');
    el.innerHTML = parseMd(SAMPLE_MARKDOWN);
    styleGhPrListBubble(el, SAMPLE_MARKDOWN);
    const heading = el.querySelector('h2');
    expect(heading).toBeTruthy();
    const draftBadge = heading!.querySelector('.gh-pr-state-badge.gh-pr-state-draft');
    const openBadge = heading!.querySelector('.gh-pr-state-badge.gh-pr-state-open');
    expect(draftBadge?.textContent).toBe('Draft : 1');
    expect(openBadge?.textContent).toBe('Open : 1');
    expect(heading!.textContent).toContain('Pulls 一覧(');
  });

  it('No.・作成者・コンフリクト列は中央寄せになる(parseMdの列揃え反映)', () => {
    const parseMd = loadParseMd();
    const html = parseMd(SAMPLE_MARKDOWN);
    const el = document.createElement('div');
    el.innerHTML = html;
    const headerCells = el.querySelectorAll('th');
    expect(headerCells[0].getAttribute('style')).toContain('text-align:center');
    expect(headerCells[2].getAttribute('style')).toContain('text-align:center');
    expect(headerCells[4].getAttribute('style')).toContain('text-align:center');
    const firstRowCells = el.querySelectorAll('tbody tr:first-child td');
    expect(firstRowCells[0].getAttribute('style')).toContain('text-align:center');
    expect(firstRowCells[2].getAttribute('style')).toContain('text-align:center');
    expect(firstRowCells[4].getAttribute('style')).toContain('text-align:center');
  });
});
