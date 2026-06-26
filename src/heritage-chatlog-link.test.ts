import { describe, it, expect } from 'vitest';
import { getHeritageAccessPage } from './views/heritageAccess';

function buildPage(): string {
  return getHeritageAccessPage('testuser');
}

describe('世界遺産チャットログリンク: モーダルHTML', () => {
  it('heritage-chatlog-modal が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="heritage-chatlog-modal"');
  });

  it('heritage-chatlog-modal-body が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="heritage-chatlog-modal-body"');
  });

  it('heritage-chatlog-modal の閉じるボタンが存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="heritage-chatlog-close"');
  });
});

describe('世界遺産チャットログリンク: CSS', () => {
  it('.acc-name-link クラスが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.acc-name-link');
  });

  it('.hcl-entry クラスが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.hcl-entry');
  });
});

describe('世界遺産チャットログリンク: JavaScript関数', () => {
  it('checkHeritageKeywords 関数が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('function checkHeritageKeywords');
  });

  it('openHeritageChatlogModal 関数が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('function openHeritageChatlogModal');
  });

  it('/api/aichat/heritage-keywords-check を呼んでいる', () => {
    const html = buildPage();
    expect(html).toContain('/api/aichat/heritage-keywords-check');
  });

  it('/api/aichat/shares/by-keyword を呼んでいる', () => {
    const html = buildPage();
    expect(html).toContain('/api/aichat/shares/by-keyword');
  });

  it('acc-name-link クラスをアコーディオン内で付与している', () => {
    const html = buildPage();
    expect(html).toContain('acc-name-link');
    const idx = html.indexOf('checkHeritageKeywords');
    expect(idx).toBeGreaterThan(-1);
  });
});


describe('世界遺産チャットログリンク: キャッシュ判定テーブル参照', () => {
  it('heritage-keywords-check がトピック別に heritage_question_view_log を参照している', () => {
    const { readFileSync } = require('fs');
    const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
    // SQL はバインド数チャンク分割のため lookupHeritageKeywordTopics ヘルパーへ集約されている
    const helperIdx = src.indexOf('export async function lookupHeritageKeywordTopics');
    expect(helperIdx).toBeGreaterThan(-1);
    const helperBlock = src.slice(helperIdx, helperIdx + 1200);
    expect(helperBlock).toContain('heritage_question_view_log');
    expect(helperBlock).toContain('heritage_name');
    expect(helperBlock).toContain('topic');
    // エンドポイントは薄く、ヘルパーを呼び出している
    const epIdx = src.indexOf("app.get('/api/aichat/heritage-keywords-check'");
    expect(src.slice(epIdx, epIdx + 900)).toContain('lookupHeritageKeywordTopics');
  });

  it('heritage-keywords-check が aichat_search_log を参照していない', () => {
    const { readFileSync } = require('fs');
    const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
    const idx = src.indexOf('/api/aichat/heritage-keywords-check');
    const block = src.slice(idx, idx + 900);
    expect(block).not.toContain('aichat_search_log');
  });
});

describe('世界遺産チャットログリンク: バッジタップでモーダル起動', () => {
  it('acc-topic-badge に cursor:pointer が設定されている', () => {
    const html = buildPage();
    const idx = html.indexOf('.acc-topic-badge');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 300);
    expect(block).toContain('cursor:pointer');
  });

  it('バッジクリック時に openHeritageChatlogModal を badgeTopic 付きで呼んでいる', () => {
    const html = buildPage();
    const idx = html.indexOf('function checkHeritageKeywords');
    const block = html.slice(idx, idx + 2000);
    expect(block).toContain('openHeritageChatlogModal(name, badgeTopic)');
  });

  it('acc-name-link クリックでは openHeritageChatlogModal を呼ばない', () => {
    const html = buildPage();
    const checkIdx = html.indexOf('function checkHeritageKeywords');
    const checkEnd = html.indexOf('function openAiModal');
    const block = html.slice(checkIdx, checkEnd);
    expect(block).not.toContain('openHeritageChatlogModal(name)');
  });

  it('openHeritageChatlogModal が topic 引数を受け取りタイトルに反映する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openHeritageChatlogModal');
    const block = html.slice(idx, idx + 300);
    expect(block).toContain('topic');
    expect(block).toContain('heritageName + \' — \' + topic');
  });

  it('openHeritageChatlogModal が topic を API の &topic= パラメータとして渡す', () => {
    const html = buildPage();
    const idx = html.indexOf('function openHeritageChatlogModal');
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('&topic=');
  });

  it('index.ts の by-keyword が topic クエリパラメータを受け取り ai_chat_shares を直接クエリする', () => {
    const { readFileSync } = require('fs');
    const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
    const idx = src.indexOf("app.get('/api/aichat/shares/by-keyword'");
    const block = src.slice(idx, idx + 1200);
    expect(block).toContain("query('topic')");
    expect(block).toContain('FROM ai_chat_shares');
    expect(block).toContain('LIKE ?');
  });
});

describe('世界遺産チャットログリンク: AI応答後のボタン色とバッジ更新', () => {
  it('askAI が onComplete に data.shareId を渡している（data.id ではない）', () => {
    const html = buildPage();
    const idx = html.indexOf('function askAI');
    const block = html.slice(idx, idx + 700);
    expect(block).toContain('data.shareId');
    expect(block).not.toContain('onComplete(data.id || null)');
  });

  it('AI応答後に btn.classList.add(answered) を呼んでいる', () => {
    const html = buildPage();
    const idx = html.indexOf('askAI(name, topic, function(newShareId)');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 200);
    expect(block).toContain("btn.classList.add('answered')");
    expect(block).toContain("btn.setAttribute('data-share-id', newShareId)");
  });

  it('checkHeritageKeywords が acc-name-wrap 内の既存バッジを確認して新バッジを追加する', () => {
    const html = buildPage();
    const idx = html.indexOf('function checkHeritageKeywords');
    const block = html.slice(idx, idx + 2000);
    expect(block).toContain('acc-name-wrap');
    expect(block).toContain('acc-name-link[data-heritage]');
    expect(block).toContain('existingTopics');
  });
});

describe('世界遺産チャットログリンク: checkHeritageKeywords 呼び出しタイミング', () => {
  it('checkHeritageKeywords が Promise を返す（return fetch(...) の形式）', () => {
    const html = buildPage();
    const idx = html.indexOf('function checkHeritageKeywords');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 300);
    expect(block).toContain('return Promise.resolve()');
    expect(block).toContain('return fetch(');
  });

  it('kwCheckPromise に checkHeritageKeywords の結果を代入してシリアル化している', () => {
    const html = buildPage();
    expect(html).toContain('var kwCheckPromise = checkHeritageKeywords(filtered, inner)');
  });

  it('acc-row クリック後の check-heritage-questions .then() 内では checkHeritageKeywords を呼ばない（都市タップ時に1回のみ実行済み）', () => {
    const html = buildPage();
    const fetchIdx = html.indexOf('check-heritage-questions?heritage=');
    expect(fetchIdx).toBeGreaterThan(-1);
    const afterFetch = html.slice(fetchIdx, fetchIdx + 1400);
    const thenIdx = afterFetch.indexOf('.then(function(data)');
    const thenBlock = afterFetch.slice(thenIdx, thenIdx + 1000);
    expect(thenBlock).not.toContain('kwCheckPromise = kwCheckPromise.then(function()');
    expect(thenBlock).not.toContain('return checkHeritageKeywords(filtered, inner)');
  });

  it('AI応答完了後にも checkHeritageKeywords を呼んでいる（askAI の onComplete）', () => {
    const html = buildPage();
    const askAiIdx = html.indexOf('function askAI');
    expect(askAiIdx).toBeGreaterThan(-1);
    const block = html.slice(askAiIdx, askAiIdx + 400);
    expect(block).toContain('onComplete');
  });
});

describe('世界遺産チャットログリンク: 都市タップ時の全遺産バッチバッジ処理', () => {
  it('check-heritage-questions-batch エンドポイントをアコーディオン展開時に呼んでいる', () => {
    const html = buildPage();
    expect(html).toContain('/api/aichat/check-heritage-questions-batch');
  });

  it('check-heritage-questions-batch の呼び出しが inner.innerHTML = html の直後（kwCheckPromise 設定の後）にある', () => {
    const html = buildPage();
    const innerHtmlIdx = html.indexOf("inner.innerHTML = html");
    expect(innerHtmlIdx).toBeGreaterThan(-1);
    const batchIdx = html.indexOf('check-heritage-questions-batch', innerHtmlIdx);
    expect(batchIdx).toBeGreaterThan(innerHtmlIdx);
    const kwIdx = html.indexOf('var kwCheckPromise = checkHeritageKeywords', innerHtmlIdx);
    expect(batchIdx).toBeGreaterThan(kwIdx);
  });

  it('バッチ応答の .then() 内で allHeritageNames.forEach と ensureTopicBadge を呼んでいる', () => {
    const html = buildPage();
    const batchIdx = html.indexOf('check-heritage-questions-batch');
    expect(batchIdx).toBeGreaterThan(-1);
    const block = html.slice(batchIdx, batchIdx + 800);
    expect(block).toContain('allHeritageNames.forEach(function(name)');
    expect(block).toContain('ensureTopicBadge(inner, name, t)');
  });

  it('index.ts に /api/aichat/check-heritage-questions-batch エンドポイントが定義されている', () => {
    const { readFileSync } = require('fs');
    const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
    expect(src).toContain("app.post('/api/aichat/check-heritage-questions-batch'");
  });

  it('index.ts の batch エンドポイントが ai_chat_shares を参照している', () => {
    const { readFileSync } = require('fs');
    const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
    // 質問キャッシュ判定の SQL は lookupHeritageQuestionAnswers ヘルパーへ集約されている
    const helperIdx = src.indexOf('export async function lookupHeritageQuestionAnswers');
    expect(helperIdx).toBeGreaterThan(-1);
    expect(src.slice(helperIdx, helperIdx + 1800)).toContain('ai_chat_shares');
    // エンドポイントは heritages を受け取り answered を返し、ヘルパーを呼ぶ
    const idx = src.indexOf("app.post('/api/aichat/check-heritage-questions-batch'");
    const block = src.slice(idx, idx + 900);
    expect(block).toContain('heritages');
    expect(block).toContain('answered');
    expect(block).toContain('lookupHeritageQuestionAnswers');
  });
});

describe('世界遺産チャットログリンク: serverAnswered から直接バッジ生成', () => {
  it('check-heritage-questions の .then() 内で AI_TOPICS.forEach を使って ensureTopicBadge を直接呼んでいる', () => {
    const html = buildPage();
    const fetchIdx = html.indexOf('check-heritage-questions?heritage=');
    expect(fetchIdx).toBeGreaterThan(-1);
    const afterFetch = html.slice(fetchIdx, fetchIdx + 1800);
    const thenIdx = afterFetch.indexOf('.then(function(data)');
    const thenBlock = afterFetch.slice(thenIdx, thenIdx + 1200);
    expect(thenBlock).toContain('AI_TOPICS.forEach(function(t)');
    expect(thenBlock).toContain('ensureTopicBadge(inner, hName, t)');
  });

  it('serverAnswered または localAnswered のどちらかがあればバッジを生成する条件になっている', () => {
    const html = buildPage();
    const fetchIdx = html.indexOf('check-heritage-questions?heritage=');
    const afterFetch = html.slice(fetchIdx, fetchIdx + 1800);
    const thenIdx = afterFetch.indexOf('.then(function(data)');
    const thenBlock = afterFetch.slice(thenIdx, thenIdx + 1200);
    expect(thenBlock).toContain('localAnswered[t] || serverAnswered[t]');
  });
});

describe('世界遺産チャットログリンク: レースコンディション防止', () => {
  it('acc-row クリック前に localAnswered でローカル応答済み状態を保存している', () => {
    const html = buildPage();
    const fetchIdx = html.indexOf('check-heritage-questions?heritage=');
    expect(fetchIdx).toBeGreaterThan(-1);
    const beforeFetch = html.slice(Math.max(0, fetchIdx - 400), fetchIdx);
    expect(beforeFetch).toContain('var localAnswered = {}');
    expect(beforeFetch).toContain('.acc-ai-btn.answered');
  });

  it('check-heritage-questions の応答と localAnswered をマージしてボタン状態を更新している', () => {
    const html = buildPage();
    const fetchIdx = html.indexOf('check-heritage-questions?heritage=');
    const afterFetch = html.slice(fetchIdx, fetchIdx + 1400);
    const thenBlock = afterFetch.slice(afterFetch.indexOf('.then(function(data)'), afterFetch.indexOf('.then(function(data)') + 900);
    expect(thenBlock).toContain('serverAnswered');
    expect(thenBlock).toContain('localAnswered[topic] || serverAnswered[topic]');
  });
});

describe('世界遺産チャットログリンク: キーワードバッジ（紫中抜き）', () => {
  it('.acc-kw-badge CSS クラスが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.acc-kw-badge');
  });

  it('.acc-kw-badge に紫色 (#a371f7) が設定されている', () => {
    const html = buildPage();
    const idx = html.indexOf('.acc-kw-badge');
    const block = html.slice(idx, idx + 200);
    expect(block).toContain('#a371f7');
  });

  it('.acc-kw-badge の background が transparent (中抜きデザイン)', () => {
    const html = buildPage();
    const idx = html.indexOf('.acc-kw-badge');
    const block = html.slice(idx, idx + 200);
    expect(block).toContain('background:transparent');
  });

  it('/api/aichat/heritage-search-keywords-check を呼んでいる', () => {
    const html = buildPage();
    expect(html).toContain('/api/aichat/heritage-search-keywords-check');
  });

  it('hasKeywords を参照してキーワードバッジを追加している', () => {
    const html = buildPage();
    expect(html).toContain('hasKeywords');
    const idx = html.indexOf('heritage-search-keywords-check');
    const block = html.slice(idx, idx + 1800);
    expect(block).toContain('acc-kw-badge');
    expect(block).toContain('キーワード');
  });

  it('既存の acc-name-wrap にもキーワードバッジを追加する処理がある', () => {
    const html = buildPage();
    const idx = html.indexOf('heritage-search-keywords-check');
    const block = html.slice(idx, idx + 1200);
    expect(block).toContain('acc-name-wrap');
    expect(block).toContain('acc-kw-badge');
    expect(block).toContain('querySelector(\'.acc-name-link[data-heritage]');
  });

  it('acc-name span のみの遺産にもキーワードバッジを追加するフォールバック処理がある', () => {
    const html = buildPage();
    const idx = html.indexOf('heritage-search-keywords-check');
    const block = html.slice(idx, idx + 1500);
    expect(block).toContain('.acc-name[data-heritage]');
    expect(block).toContain('acc-kw-badge');
  });

  it('index.ts に /api/aichat/heritage-search-keywords-check エンドポイントが定義されている', () => {
    const { readFileSync } = require('fs');
    const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
    expect(src).toContain("app.get('/api/aichat/heritage-search-keywords-check'");
  });

  it('index.ts の heritage-search-keywords-check が aichat_search_history を参照している', () => {
    const { readFileSync } = require('fs');
    const src = readFileSync(new URL('./index.ts', import.meta.url).pathname, 'utf-8');
    const idx = src.indexOf('heritage-search-keywords-check');
    const block = src.slice(idx, idx + 800);
    expect(block).toContain('aichat_search_history');
    expect(block).toContain('ai_chat_shares');
    expect(block).toContain('hasKeywords');
  });
});

describe('世界遺産チャットログリンク: ラベル処理済み行の空白タップでAIパネル表示', () => {
  it('.acc-name-link が flex:1 を持たない（空白タップがバブルするように）', () => {
    const html = buildPage();
    const idx = html.indexOf('.acc-name-link{');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 150);
    expect(block).not.toContain('flex:1');
  });

  it('.acc-name-wrap が flex:1 を持つ（行全体をカバーする）', () => {
    const html = buildPage();
    const idx = html.indexOf('.acc-name-wrap{');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 100);
    expect(block).toContain('flex:1');
  });
});

describe('世界遺産チャットログリンク: getNextZ', () => {
  it('heritage-chatlog-modal が getNextZ() で z-index を設定している', () => {
    const html = buildPage();
    const idx = html.indexOf('function openHeritageChatlogModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 700);
    expect(fn).toContain('getNextZ()');
  });
});

describe('世界遺産チャットログリンク: タブ式モデル切り替え', () => {
  it('hcl-modal-tabs 要素が HTML に存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="hcl-modal-tabs"');
  });

  it('.hcl-tab CSS が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.hcl-tab');
  });

  it('.hcl-tab.active CSS が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.hcl-tab.active');
  });

  it('openHeritageChatlogModal がモデルごとにタブを生成する処理を含む', () => {
    const html = buildPage();
    const idx = html.indexOf('function openHeritageChatlogModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 2000);
    expect(fn).toContain('hcl-tab');
  });

  it('hcl-modal の幅が 640px より広い', () => {
    const html = buildPage();
    const idx = html.indexOf('.hcl-modal{');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 200);
    expect(block).not.toContain('640px');
  });
});

describe('世界遺産チャットログリンク: タイトルの国旗・アイコン表示', () => {
  it('heritage-chatlog-modal-flag 要素が HTML に存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="heritage-chatlog-modal-flag"');
  });

  it('heritageCountryFlags グローバルマップが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('heritageCountryFlags');
  });

  it('アコーディオン描画時に heritageCountryFlags へ国旗を登録している', () => {
    const html = buildPage();
    const idx = html.indexOf('heritageCountryFlags[h.heritage_name]');
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 80);
    expect(block).toContain('country_flag');
  });

  it('openHeritageChatlogModal が heritageCountryFlags から国旗を取得してヘッダーに表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function openHeritageChatlogModal');
    const fn = html.slice(idx, idx + 800);
    expect(fn).toContain('heritageCountryFlags');
    expect(fn).toContain('hclFlag');
  });
});
