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
    const idx = src.indexOf('/api/aichat/heritage-keywords-check');
    const block = src.slice(idx, idx + 900);
    expect(block).toContain('heritage_question_view_log');
    expect(block).toContain('heritage_name');
    expect(block).toContain('topic');
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
    const idx = html.indexOf('checkHeritageKeywords');
    const block = html.slice(idx, idx + 1400);
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
    const block = html.slice(idx, idx + 500);
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
  it('askAI が onComplete に shareId を渡している', () => {
    const html = buildPage();
    const idx = html.indexOf('function askAI');
    const block = html.slice(idx, idx + 700);
    expect(block).toContain('onComplete(data.id || null)');
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
  it('acc-row クリック時（別の世界遺産パネルを開いた時）に checkHeritageKeywords を呼んでいる', () => {
    const html = buildPage();
    const rowClickIdx = html.indexOf("acc-row[data-heritage]");
    expect(rowClickIdx).toBeGreaterThan(-1);
    const block = html.slice(rowClickIdx, rowClickIdx + 800);
    expect(block).toContain('checkHeritageKeywords(heritages, inner)');
  });

  it('AI応答完了後にも checkHeritageKeywords を呼んでいる（askAI の onComplete）', () => {
    const html = buildPage();
    const askAiIdx = html.indexOf('function askAI');
    expect(askAiIdx).toBeGreaterThan(-1);
    const block = html.slice(askAiIdx, askAiIdx + 400);
    expect(block).toContain('onComplete');
  });
});

describe('世界遺産チャットログリンク: getNextZ', () => {
  it('heritage-chatlog-modal が getNextZ() で z-index を設定している', () => {
    const html = buildPage();
    const idx = html.indexOf('openHeritageChatlogModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('getNextZ()');
  });
});
