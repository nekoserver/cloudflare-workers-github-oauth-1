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

  it('未分類キーワードが0件でも(手入力での探索に使えるよう)パネル自体は常に表示する', () => {
    const html = buildPage();
    expect(html).toContain("keywordBoundaryPanel.classList.add('kb-panel-visible');");
    expect(html).not.toContain("keywordBoundaryPanel.classList.toggle('kb-panel-visible'");
  });
});

describe('探索の境界線パネル: 自動探索ボタンの左の入力欄からも探索を開始できる', () => {
  it('autoExploreManualInput(id)がボタンの直前(左)に配置されている', () => {
    const html = buildPage();
    const panelIdx = html.indexOf('id="keywordBoundaryPanel"');
    expect(panelIdx).toBeGreaterThan(-1);
    const inputIdx = html.indexOf('id="autoExploreManualInput"', panelIdx);
    const btnIdx = html.indexOf('id="autoExploreBtn"', panelIdx);
    expect(inputIdx).toBeGreaterThan(-1);
    expect(btnIdx).toBeGreaterThan(inputIdx);
  });

  it('実行中は入力欄もdisabledにし、完了後に有効へ戻す', () => {
    const html = buildPage();
    const runningIdx = html.indexOf('function setAutoExploreButtonRunning()');
    expect(html.slice(runningIdx, runningIdx + 400)).toContain('autoExploreManualInput.disabled = true;');
    const idleIdx = html.indexOf('function setAutoExploreButtonIdle()');
    expect(html.slice(idleIdx, idleIdx + 400)).toContain('autoExploreManualInput.disabled = false;');
  });
});

describe('探索の境界線パネル: 自動探索は選択(またはチェックボックス外の入力欄)のキーワードだけを起点にする', () => {
  function autoExploreSnippet(html: string, length = 3000): string {
    const idx = html.indexOf('function runAutoExplore()');
    expect(idx).toBeGreaterThan(-1);
    return html.slice(idx, idx + length);
  }

  it('未選択・未入力(seedSetが空)で自動探索を押すと、問い合わせず案内を出して終わる', () => {
    const snippet = autoExploreSnippet(buildPage(), 1000);
    expect(snippet).toContain('var seedSet = {};');
    expect(snippet).toContain('Object.keys(keywordBoundarySelection).forEach(function(keyword) { seedSet[keyword] = true; });');
    expect(snippet).toContain('var seedKeywords = Object.keys(seedSet);');
    expect(snippet).toContain('if (seedKeywords.length === 0)');
    expect(snippet).toContain("showAichatToast('自動探索するキーワードをチェックするか、入力してください'");
    expect(snippet).toContain('return;');
  });

  it('手入力欄(autoExploreManualInput)の値もカンマ・読点区切りでseedSetへ加え、開始時に入力欄をクリアする', () => {
    const snippet = autoExploreSnippet(buildPage(), 1800);
    expect(snippet).toContain("var manualRaw = (autoExploreManualInput.value || '').trim();");
    expect(snippet).toContain('manualRaw.split(/[,、]/)');
    expect(snippet).toContain('manualKeywords.forEach(function(keyword) { seedSet[keyword] = true; });');
    expect(snippet).toContain("autoExploreManualInput.value = '';");
  });

  it('1階層目はseedKeywords(選択+入力欄)だけをautoExploreRunCandidatesへ渡す(一覧APIを叩かない)', () => {
    const snippet = autoExploreSnippet(buildPage(), 2000);
    expect(snippet).toContain('var chain = autoExploreRunCandidates(seedKeywords, processedKeywords)');
  });

  it('2階層目以降はautoExploreNextLevelCandidates(一覧API経由)で新規抽出分へ掘り下げる', () => {
    const snippet = autoExploreSnippet(buildPage(), 2500);
    expect(snippet).toContain('for (var level = 1; level < AUTO_EXPLORE_MAX_LEVELS; level++)');
    expect(snippet).toContain('autoExploreNextLevelCandidates(processedKeywords).then(function(candidates)');
    expect(snippet).toContain('autoExploreRunCandidates(candidates, processedKeywords)');
  });

  it('完了後は選択状態をクリアする', () => {
    const snippet = autoExploreSnippet(buildPage(), 3000);
    expect(snippet).toContain('keywordBoundarySelection = {};');
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
    const snippet = html.slice(idx, idx + 3000);
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

  it('POST /api/aichat/vectorize-answerがHTTP 200でも_keywordsWarningを返した場合は失敗として扱う(実際にはキーワードが1件も切り出せていないのを黙って「完了」にしない)', () => {
    const html = buildPage();
    const idx = html.indexOf('function autoExploreProcessKeyword(');
    const snippet = html.slice(idx, idx + 3600);
    const vecStageIdx = snippet.indexOf("autoExploreRunStage(keyword, 'キー切り出し'");
    expect(vecStageIdx).toBeGreaterThan(-1);
    const vecSnippet = snippet.slice(vecStageIdx, vecStageIdx + 1400);
    expect(vecSnippet).toContain('if (result.data._keywordsWarning) {');
    expect(vecSnippet).toContain("throw new Error(keyword + 'のキー切り出しに失敗しました: ' + result.data._keywordsWarning);");
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
    const snippet = html.slice(idx, idx + 1600);
    expect(snippet).toContain("autoExploreProgressLog.innerHTML = '';");
    expect(snippet).toContain("autoExploreProgressLog.classList.add('kb-progress-log-visible');");
  });
});
