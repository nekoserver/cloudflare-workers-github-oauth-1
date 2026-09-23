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
    expect(snippet).toContain('var typedKeyword = autoExploreKeywordInput.value.trim();');
    expect(snippet).toContain('var seedKeywords = typedKeyword ? [typedKeyword] : Object.keys(keywordBoundarySelection);');
    expect(snippet).toContain('if (seedKeywords.length === 0)');
    expect(snippet).toContain("showAichatToast('キーワードを入力するか、自動探索するキーワードをチェックしてください'");
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

describe('探索の境界線パネル: 検索窓と再探索抑止', () => {
  it('自動探索ボタンの左に検索窓を置き、入力値を最優先の起点にする', () => {
    const html = buildPage();
    expect(html.indexOf('id="autoExploreKeywordInput"')).toBeLessThan(html.indexOf('id="autoExploreBtn"'));
    expect(html).toContain('var seedKeywords = typedKeyword ? [typedKeyword] : Object.keys(keywordBoundarySelection);');
  });

  it('候補が0件でも手入力できるようパネルを表示する', () => {
    const html = buildPage();
    expect(html).toContain("keywordBoundaryPanel.classList.add('kb-panel-visible');");
  });

  it('各候補のAI問い合わせ前に1週間の探索履歴をclaimする', () => {
    const html = buildPage();
    const idx = html.indexOf('function autoExploreProcessKeyword(');
    const snippet = html.slice(idx, idx + 900);
    expect(snippet).toContain("fetch('/api/aichat/keyword-boundary/auto-explore/claim'");
    expect(snippet).toContain("r.status === 409");
  });
});

describe('探索の境界線パネル: 実行中にもう一度押すと停止できる', () => {
  it('実行中でなければrunAutoExplore()を呼び、実行中ならキャンセル要求を立てる(ボタンは無効化しない=押し直せる)', () => {
    const html = buildPage();
    const idx = html.indexOf("autoExploreBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('if (autoExploreRunning) {');
    expect(snippet).toContain('autoExploreCancelRequested = true;');
    expect(snippet).toContain('runAutoExplore();');
  });

  it('実行中はボタンをdisabledにせず(押し直せる)、⏹ 停止のラベル・kb-runningクラスにする', () => {
    const html = buildPage();
    const idx = html.indexOf('function setAutoExploreButtonRunning()');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('autoExploreBtn.disabled = false;');
    expect(snippet).toContain("autoExploreBtn.classList.add('kb-running');");
    expect(snippet).toContain("autoExploreBtn.textContent = '⏹ 停止';");
  });

  it('候補の処理直前にキャンセル要求を確認し、要求済みならそのキーワードを処理しない', () => {
    const html = buildPage();
    const idx = html.indexOf('function autoExploreRunCandidates(');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('if (autoExploreCancelRequested) return;');
  });

  it('階層の切り替わり時にもキャンセル要求とエラー停止の両方を確認する', () => {
    const html = buildPage();
    const idx = html.indexOf('function runAutoExplore()');
    const snippet = html.slice(idx, idx + 2200);
    expect(snippet).toContain('if (stoppedByError || autoExploreCancelRequested) return;');
  });
});

describe('探索の境界線パネル: 各キーワードはAI問い合わせ→Jev処理→キー切り出しの順で処理する', () => {
  it('autoExploreProcessKeywordはAI問い合わせ→Jev処理→キー切り出しの順にステージを呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function autoExploreProcessKeyword(');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 2500);
    const aiIdx = snippet.indexOf("autoExploreRunStage(keyword, 'AI問い合わせ'");
    const jevIdx = snippet.indexOf("autoExploreRunStage(keyword, 'Jev処理'");
    const vecIdx = snippet.indexOf("autoExploreRunStage(keyword, 'キー切り出し'");
    expect(aiIdx).toBeGreaterThan(-1);
    expect(jevIdx).toBeGreaterThan(aiIdx);
    expect(vecIdx).toBeGreaterThan(jevIdx);
  });

  it('Jev処理は/api/aichat/jev-scoreを呼び、verified!==trueなら失敗としてキー切り出しへ進めない', () => {
    const html = buildPage();
    const idx = html.indexOf('function autoExploreProcessKeyword(');
    const snippet = html.slice(idx, idx + 2500);
    expect(snippet).toContain("fetch('/api/aichat/jev-score'");
    expect(snippet).toContain('if (!result.ok || !result.data || result.data.verified !== true)');
  });

  it('キー切り出し(vectorizeAnswerAndExtractKeywords)はJev処理の結果(answer)を受け取ってから呼ばれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function autoExploreProcessKeyword(');
    const snippet = html.slice(idx, idx + 2500);
    const jevStageIdx = snippet.indexOf("autoExploreRunStage(keyword, 'Jev処理'");
    const vecStageIdx = snippet.indexOf("autoExploreRunStage(keyword, 'キー切り出し'");
    const between = snippet.slice(jevStageIdx, vecStageIdx);
    // Jevステージ呼び出し後、.then(function(answer) {...})を1回挟んでからキー切り出しステージへ渡る。
    expect(between).toContain('.then(function(answer) {');
    expect(snippet.slice(vecStageIdx, vecStageIdx + 300)).toContain('vectorizeAnswerAndExtractKeywords(answer.shareId');
  });
});

describe('探索の境界線パネル: 各段階の開始・完了時刻と所要時間を進捗ログに表示する', () => {
  it('autoExploreRunStageは開始時刻・完了(または失敗)時刻と所要秒数をログへ出す', () => {
    const html = buildPage();
    const idx = html.indexOf('function autoExploreRunStage(');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 900);
    expect(snippet).toContain("stageLabel + '開始 ' + autoExploreClock()");
    expect(snippet).toContain("stageLabel + '完了 ' + autoExploreClock() + ' (' + elapsed + 's)'");
    expect(snippet).toContain("stageLabel + '失敗 ' + autoExploreClock() + ' (' + elapsed + 's)'");
  });

  it('自動探索の開始時にログをクリアして表示状態にする', () => {
    const html = buildPage();
    const idx = html.indexOf('function runAutoExplore()');
    const snippet = html.slice(idx, idx + 700);
    expect(snippet).toContain("autoExploreProgressLog.innerHTML = '';");
    expect(snippet).toContain("autoExploreProgressLog.classList.add('kb-progress-log-visible');");
  });
});
