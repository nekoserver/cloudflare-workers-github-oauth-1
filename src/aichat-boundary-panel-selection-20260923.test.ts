import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: /aichat ページの「探索の境界線」パネル(未分類キーワード一覧)・
// 「自動探索」ボタン(src/views/aichat.ts)。
//
// 背景: 当初は自動探索を押すと、一覧に出ている未分類キーワードを
// 無差別に(チェックの有無に関わらず)自動で問い合わせていた。
// 「選択されたものだけを問い合わせろ」という指摘を受け、1階層目は
// ユーザーがチェックボックスで選んだキーワードだけを起点にするよう
// 修正した(2階層目以降は、そこから新たに抽出されたキーワードへ
// 自然に掘り下げる)。
//
// 故障シナリオ:
//   (1) チェックボックスを描画しない、またはクリックしても選択状態が
//       保持されない
//   (2) 自動探索の1階層目が、選択に関係なく一覧APIを叩いて無差別に
//       処理してしまう(当初の不具合の再発)
//   (3) 何も選択していない状態で自動探索を押しても、何も問い合わせず
//       静かに終わる(エラーにも案内にもならない)
//   (4) キーワード本文クリック(単発の質問への差し込み)が壊れる

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('探索の境界線パネル: キーワードのチェックボックス選択', () => {
  it('各キーワードにチェックボックス(kb-chip-check)を描画し、change時にkeywordBoundarySelectionへ反映する', () => {
    const html = buildPage();
    expect(html).toContain("checkbox.className = 'kb-chip-check'");
    expect(html).toContain('keywordBoundarySelection[entry.keyword] = true;');
    expect(html).toContain('delete keywordBoundarySelection[entry.keyword];');
  });

  it('一覧から消えたキーワードの選択状態は残さない', () => {
    const html = buildPage();
    expect(html).toContain('if (!stillPresent[keyword]) delete keywordBoundarySelection[keyword];');
  });

  it('キーワード本文(kb-chip)クリックは従来通り入力欄へテンプレートを差し込む', () => {
    const html = buildPage();
    expect(html).toContain("chip.addEventListener('click', function() { fillChatInputWithBoundaryTemplate(entry.keyword); });");
  });
});

describe('探索の境界線パネル: 自動探索は選択されたキーワードだけを起点にする', () => {
  it('未選択(keywordBoundarySelectionが空)で自動探索を押すと、問い合わせず案内を出して終わる', () => {
    const html = buildPage();
    const idx = html.indexOf('function runAutoExplore()');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('var seedKeywords = Object.keys(keywordBoundarySelection);');
    expect(snippet).toContain('if (seedKeywords.length === 0)');
    expect(snippet).toContain("showAichatToast('自動探索するキーワードをチェックしてください'");
    expect(snippet).toContain('return;');
  });

  it('1階層目はseedKeywords(選択されたキーワード)だけをautoExploreRunCandidatesへ渡す(一覧APIを叩かない)', () => {
    const html = buildPage();
    const idx = html.indexOf('function runAutoExplore()');
    const snippet = html.slice(idx, idx + 1200);
    expect(snippet).toContain('var chain = autoExploreRunCandidates(seedKeywords, processedKeywords)');
  });

  it('2階層目以降はautoExploreNextLevelCandidates(一覧API経由)で新規抽出分へ掘り下げる', () => {
    const html = buildPage();
    const idx = html.indexOf('function runAutoExplore()');
    const snippet = html.slice(idx, idx + 1600);
    expect(snippet).toContain('for (var level = 1; level < AUTO_EXPLORE_MAX_LEVELS; level++)');
    expect(snippet).toContain('autoExploreNextLevelCandidates(processedKeywords).then(function(candidates)');
    expect(snippet).toContain('autoExploreRunCandidates(candidates, processedKeywords)');
  });

  it('完了後は選択状態をクリアする', () => {
    const html = buildPage();
    const idx = html.indexOf('function runAutoExplore()');
    const snippet = html.slice(idx, idx + 2000);
    expect(snippet).toContain('keywordBoundarySelection = {};');
  });
});
