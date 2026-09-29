import { describe, expect, it } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getThreadTrackerPage } from './views/threadTracker';

const SECRET = 'thread-tracker-test-secret';
const THREAD_ID = '0123456789abcdef0123456789abcdef';

function makeDb(rows: Array<Record<string, unknown>>) {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() { return sql.includes('FROM user_sessions') ? { last_activity_at: new Date().toISOString(), revoked_at: null, idle_timeout_seconds: null } : null; },
            async all() { return { results: sql.includes('FROM ai_chat_shares') && args[0] === 'alice' ? rows : [] }; },
            async run() { return { success: true }; },
          };
        },
      };
    },
  };
}

function makeFailingDb(message: string) {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes('FROM user_sessions')) {
                return { last_activity_at: new Date().toISOString(), revoked_at: null, idle_timeout_seconds: null };
              }
              return null;
            },
            async all() { throw new Error(message); },
            async run() { return { success: true }; },
          };
        },
      };
    },
  };
}

async function authCookie(): Promise<string> {
  return 'auth_token=' + await createJWT({ sub: 'alice' }, SECRET, 60) + '; last_activity=' + Date.now();
}

describe('thread tracker page', () => {
  it('再質問ID付きAI応答の検索・閲覧・追加質問UIを含む', () => {
    const html = getThreadTrackerPage('<alice>');
    expect(html).toContain('再質問スレッド検索');
    expect(html).toContain('/api/aichat/threads/seed');
    expect(html).toContain('id="responseSearch"');
    expect(html).toContain('質問・回答・モデルを検索');
    expect(html).toContain('このスレッドへの追加質問');
    expect(html).toContain('placeholder="このスレッドへの追加質問"');
    expect(html).not.toContain('<label>このスレッドへの追加質問</label>');
    expect(html).toContain('type="submit">送信</button>');
    expect(html).not.toContain('AIチャットで質問する');
    expect(html).not.toContain('このスレッドを開く');
    expect(html).toContain("searchEl.addEventListener('input',renderThreads)");
    expect(html).not.toContain('<alice>');
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeDefined();
    expect(() => new Function(script!)).not.toThrow();
  });

  it('追加質問をページ内から再質問ID付きで直接送信する', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain("fetch('/api/aichat'");
    expect(html).toContain("threadId:thread.threadId||''");
    expect(html).toContain("status.textContent='送信中…'");
    expect(html).toContain("postedTurn={id:data.shareId||'',conversationHash:data.conversationHash||'',question:message,answer:data.response||'(応答なし)'");
  });

  it('追加質問で所有者の過去ターンを取得し、AI入力の会話文脈に使う', () => {
    const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, 'index.ts'), 'utf8');
    const route = source.slice(source.indexOf("app.post('/api/aichat'"), source.indexOf("app.post('/api/aichat/moondream-analysis'"));
    expect(route).toContain('SELECT question, answer');
    expect(route).toContain('WHERE user_id = ? AND thread_id = ? AND deleted_at IS NULL');
    expect(route).toContain('ORDER BY created_at DESC, id DESC');
    expect(route).toContain('LIMIT 12');
    expect(route).toContain('addThreadHistoryToAiMessages(');
    expect(route).toContain('threadHistory');
  });

  it('投稿ボタン上のモデル一覧はGemma-4を既定にし、選択モデルを投稿へ渡す', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('class="model-picker"');
    expect(html).toContain('aria-label="言語モデルを選択"');
    expect(html).toContain('@cf/google/gemma-4-26b-a4b-it');
    expect(html).toContain('Gemma-4');
    expect(html).toContain("DEFAULT_MODEL='@cf/google/gemma-4-26b-a4b-it'");
    expect(html).toContain('selectedModel=DEFAULT_MODEL');
    expect(html).toContain('model:selectedModel');
    expect(html).toMatch(/\.model-menu\{[^}]*bottom:calc\(100% \+ 6px\)/);
  });

  it('選択した言語モデルをCookieへ保存し、次回表示時に復元する', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain("MODEL_COOKIE='thread_tracker_model'");
    expect(html).toContain('savedModel=readCookie(MODEL_COOKIE)');
    expect(html).toContain("option.getAttribute('data-model')===savedModel");
    expect(html).toContain("document.cookie=MODEL_COOKIE+'='+encodeURIComponent(selectedModel)");
    expect(html).toContain('Max-Age=31536000; SameSite=Lax; Secure');
  });

  it('トップバナーを撤去し、右ペインへ画面幅と高さを最大限割り当てる', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).not.toContain('<header>');
    expect(html).toMatch(/main\{width:100%;padding:16px\}/);
    expect(html).toMatch(/\.two-pane-mode\{display:grid;grid-template-columns:minmax\(260px,min\(30vw,380px\)\) minmax\(0,1fr\);column-gap:8px;align-items:start;padding:8px/);
    expect(html).toContain('.two-pane-mode .detail-pane{grid-column:2;grid-row:1/5;margin-top:0}');
    expect(html).toMatch(/\.detail-pane\{[^}]*height:calc\(100dvh - 16px\)[^}]*padding:12px/);
  });

  it('右ペインの回答は共通Markdownパーサーで描画する', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('var renderMarkdown=(function()');
    expect(html).toContain("renderMarkdown(turn.answer||'(応答なし)')");
    expect(html).toContain('class="markdown answer preview-area"');
    expect(html).toContain('function parseMd(src)');
  });

  it('質問に登録された追加質問を取得し、対応する各回答の直後にリンク表示する', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain("fetchJson('/api/aichat/share-subquery-links/all')");
    expect(html).toContain('function attachSubqueries(threads,items)');
    expect(html).toContain('(turn.questionHash&&byHash.get(turn.questionHash))||byQuestion.get(turn.question)||[]');
    expect(html).toContain('function subqueriesHtml(turn)');
    expect(html).toContain('aria-label="この回答の追加質問"');
    expect(html).toContain("renderMarkdown(turn.answer||'(応答なし)')+'</div>'+subqueriesHtml(turn)");
    expect(html).toContain("url.protocol==='https:'||url.protocol==='http:'");
  });

  it('追加質問フォームを右ペインの最下部に寄せ、空の送信状態は余白を取らない', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toMatch(/\.actions\{[^}]*flex:none;[^}]*margin-top:auto;[^}]*padding-top:12px/);
    expect(html).toContain('.model-trigger,.continue,.followup textarea{height:var(--control-height)}');
    expect(html).toContain('.followup textarea{display:block;width:100%;min-height:var(--control-height);resize:none');
    expect(html).toContain('.send-status:empty{display:none}');
  });

  it('conversation_hashで投稿を直接呼び出し、質問一覧から各投稿へ切り替える', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain("requestedConversationHash=new URLSearchParams(location.search).get('conversationHash')||''");
    expect(html).toContain('data-conversation-hash');
    expect(html).toContain("url.searchParams.set('conversationHash',turn.conversationHash)");
    expect(html).toContain('function findTurnByConversationHash(hash)');
    expect(html).toContain('openConversation(requestedConversationHash,false)');
  });

  it('送信受付後は波状SVGを表示し、完了まで二重投稿を防ぐ', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('class="send-wave"');
    expect(html).toContain('@keyframes send-wave-flow');
    expect(html).toContain("if(submitting)return");
    expect(html).toContain("submitting=true;form.setAttribute('aria-busy','true');button.disabled=true");
    expect(html).toContain("button.setAttribute('aria-label','送信中');button.innerHTML=wave");
    expect(html).toContain("submitting=false;form.removeAttribute('aria-busy')");
    expect(html).toContain('button.innerHTML=sendLabel');
  });

  it('更新中も波状SVGを表示して更新ボタンの二重操作を防ぐ', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain("if(reloading)return;reloading=true;reloadButton.disabled=true");
    expect(html).toContain("reloadButton.setAttribute('aria-label','更新中');reloadButton.innerHTML=wave");
    expect(html).toContain("finally{if(fromReload){reloading=false;reloadButton.disabled=false");
    expect(html).toContain("reloadButton.addEventListener('click',function(){loadThreads(true);})");
  });

  it('追加回答の完了時に元スレッドへ戻り、成長を通知する', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain(".then(function(){revealGrownThread(thread);})");
    expect(html).toContain("card.classList.add('has-growth','thread-grew')");
    expect(html).toContain("card.scrollIntoView({behavior:'smooth',block:'start'})");
    expect(html).toContain('新規 +1ターン');
    expect(html).toContain('@keyframes thread-grew');
    expect(html).toContain('@media(prefers-reduced-motion:reduce)');
  });

  it('追加投稿を最新アクティビティ順の先頭へ移し、再読込後も青線と質問一覧を表示する', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('function activityAt(thread)');
    expect(html).toContain('function sortThreads()');
    expect(html).toContain('thread.latestActivityAt=now');
    expect(html).toContain("fetchJson('/api/aichat/threads/'+encodeURIComponent(thread.threadId))");
    expect(html).toContain("(hasFollowupQuestions?' has-followups':'')");
    expect(html).toContain('.thread-card.has-followups{border-left:4px solid var(--accent)}');
    expect(html).toContain('data-conversation-hash');
    expect(html).toContain("+'\">↳ '+esc(group.question)");
  });

  it('同じ質問文を1行に束ね、対応するモデルの色丸をスレッドアイコン位置に横並びで表示する', () => {
    const html = getThreadTrackerPage('alice', {
      'model-a': '#123456',
      'model-b': '#abcdef',
    });
    expect(html).toContain('function groupQuestionTurns(turns)');
    expect(html).toContain('byQuestion.get(question)');
    expect(html).toContain('if(group.models.indexOf(model)<0)group.models.push(model)');
    expect(html).toContain('groups=groupQuestionTurns(turns)');
    expect(html).toContain('questionModels=groups.reduce(function(models,group){group.models.forEach(function(model){if(models.indexOf(model)<0)models.push(model);})');
    expect(html).toContain('followupGroups=groups.slice(1)');
    expect(html).toContain('questions=followupGroups.map(function(group)');
    expect(html).toContain('class="model-dots"');
    expect(html).toContain('class="model-dot"');
    expect(html).toContain('MODEL_COLORS[model]');
    expect(html).toContain('<div class="card-top">\'+modelDots(questionModels)+\'<span class="title">');
    expect(html).not.toContain('<span aria-hidden="true">🧵</span>');
    expect(html).not.toContain("'+modelDots(group.models)+(i?'↳ ':'")
    expect(html).toContain('"model-a":"#123456"');
    expect(html).toContain('"model-b":"#abcdef"');
    expect(html).toMatch(/\.model-dots\{[^}]*display:inline-flex;flex:none;flex-wrap:nowrap/);
  });

  it('同じ質問から短時間に作られたモデル別スレッドを1枚のカードへまとめる', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('function mergeParallelThreads(threads)');
    expect(html).toContain('windowMs=10*60*1000');
    expect(html).toContain('root===candidateRoot');
    expect(html).toContain('target.turns=target.turns.concat(thread.turns||[])');
    expect(html).toContain('allThreads=mergeParallelThreads(data.threads||[])');
    expect(html).toContain("'+groups.length+'ターン");
    expect(html).toContain("(hasFollowupQuestions?' has-followups':'')");
  });

  it('カード見出しと質問一覧に同じ質問文を重複表示しない', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('followupGroups=groups.slice(1)');
    expect(html).toContain("hasFollowupQuestions=followupGroups.length>0");
    expect(html).toContain("(hasFollowupQuestions?'':' hidden')");
    expect(html).not.toContain('questions=groups.map');
  });

  it('POST直後の再取得に新規投稿がまだ無い場合も投稿を保持してターン数を増やす', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain("if(!savedTurns.some(function(turn){return postedTurn.conversationHash&&turn.conversationHash===postedTurn.conversationHash;}))savedTurns.push(postedTurn)");
    expect(html).toContain('thread.turns=savedTurns');
  });

  it('右ペインは全質問回答ペアを保持し、案内行を表示せず左右スワイプで順番に表示する', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('class="turn-deck"');
    expect(html).toContain('data-turn-view="\'+label+\'"');
    expect(html).toContain('turns.map(function(turn,index)');
    expect(html).not.toContain('← 左右にスワイプして各投稿を表示 →');
    expect(html).not.toContain('class="turn-nav"');
    expect(html).toContain("if(delta<-45)show(activeIndex+1)");
    expect(html).toContain("else if(delta>45)show(activeIndex-1)");
  });

  it('右ペインでは作成日時・投稿数・モデル名を表示せず、モデル色を質問枠へ使う', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).not.toContain("return '<h2>'+esc(latest.question||'質問なし')+'</h2>");
    expect(html).not.toContain("return '<div class=\"meta\">作成 '+esc(fmt(thread.createdAt))");
    expect(html).not.toContain("esc(turn.model||'model不明')");
    expect(html).toContain('MODEL_COLORS[turn.model]');
    expect(html).toContain('class="markdown question" style="--question-model-color:');
    expect(html).toContain('.markdown.question{border-color:var(--question-model-color,var(--border))');
  });

  it('元の質問見出しを削除し、表示中の各質問文のJevスコアがある場合だけ最上段へ詰めて表示する', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('function jevScoreHtml(turn)');
    expect(html).toContain('Jevスコア: ');
    expect(html).toContain("heading=index===0?'':'<h3>'");
    expect(html).toContain("+'\">'+jevScoreHtml(turn)+context+heading+'<div class=\"markdown question\"");
    expect(html).not.toContain("heading=index===0?jevScoreHtml(turn)");
    expect(html).not.toContain("context+'<h3>'+esc(label)+' · 質問 '");
    expect(html).toMatch(/\.jev-score\{margin:0 0 2px/);
    expect(html).toMatch(/\.turn-slide \.turn\{[^}]*margin-top:0/);
  });

  it('DBで割り当てられたモデル色を既定色より優先する', () => {
    const html = getThreadTrackerPage('alice', { '@cf/google/gemma-4-26b-a4b-it': '#123abc' });
    expect(html).toContain('"@cf/google/gemma-4-26b-a4b-it":"#123abc"');
  });

  it('元投稿以外の全質問回答ペアを青線で示し、各ペアから元投稿を参照できる', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('.thread-reply{');
    expect(html).toContain('border-left:4px solid var(--accent)');
    expect(html).toContain('↳ 元投稿への返信');
    expect(html).toContain('data-parent-thread>元投稿を表示');
    expect(html).toContain("parentLinks=root.querySelectorAll('[data-parent-thread]')");
    expect(html).toContain("parentLinks.forEach(function(parentLink){parentLink.addEventListener('click',function(){show(0);});})");
    expect(html).toContain('turnHtml(turn,index,label,index===activeIndex,index>0)');
  });
});

describe('GET /api/aichat/threads/seed', () => {
  it('新しい100件をスレッドごとのシードデータへ整形する', async () => {
    const rows = [
      { id: 'share-1', thread_id: THREAD_ID, conversation_hash: 'hash-1', question: '昔の質問', answer: '昔の回答', model: 'gemma', source: 'textbox', created_at: '2025-01-01T00:00:00.000Z' },
      { id: 'share-2', thread_id: THREAD_ID, conversation_hash: 'hash-2', question: '続き', answer: '続きの回答', model: 'gemma', source: 'textbox', created_at: '2025-01-02T00:00:00.000Z' },
    ];
    const res = await app.request('/api/aichat/threads/seed', { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeDb(rows) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ threads: [{
      threadId: THREAD_ID,
      createdAt: '2025-01-01T00:00:00.000Z',
      latestActivityAt: '2025-01-02T00:00:00.000Z',
      turns: rows.map((row) => ({ id: row.id, conversationHash: row.conversation_hash, question: row.question, answer: row.answer, model: row.model, source: row.source, createdAt: row.created_at })),
    }] });
  });

  it('期間条件を使わず、所有者のconversation_hash付き未削除行を新しい順に100件取得する', async () => {
    let capturedSql = '';
    const db = { prepare(sql: string) { capturedSql = sql; return { bind() { return { async first() { return { last_activity_at: new Date().toISOString(), revoked_at: null, idle_timeout_seconds: null }; }, async all() { return { results: [] }; }, async run() { return { success: true }; } }; } }; } };
    await app.request('/api/aichat/threads/seed', { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: db });
    expect(capturedSql).toContain('user_id = ?');
    expect(capturedSql).toContain('conversation_hash IS NOT NULL');
    expect(capturedSql).toContain('deleted_at IS NULL');
    expect(capturedSql).toContain('conversation_hash');
    expect(capturedSql).toContain('question_hash');
    expect(capturedSql).toContain("e.target_type = 'source_question'");
    expect(capturedSql).toContain('evaluated_share.question_hash = recent_shares.question_hash');
    expect(capturedSql).toContain('AS question_jev_scores');
    expect(capturedSql).not.toContain('created_at >=');
    expect(capturedSql).toContain('ORDER BY created_at DESC, id DESC');
    expect(capturedSql).toContain('LIMIT 100');
    expect(capturedSql).toContain('AS recent_shares');
  });

  it('thread_id導入前の回答も回答ごとの検索結果として返す', async () => {
    const legacy = { id: 'legacy-share', thread_id: null, conversation_hash: 'legacy-hash', question: '以前の質問', answer: '以前の回答', model: 'gemma', source: 'textbox', created_at: '2025-01-01T00:00:00.000Z' };
    const res = await app.request('/api/aichat/threads/seed', { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeDb([legacy]) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ threads: [{
      threadId: null,
      createdAt: legacy.created_at,
      latestActivityAt: legacy.created_at,
      turns: [{ id: legacy.id, conversationHash: legacy.conversation_hash, question: legacy.question, answer: legacy.answer, model: legacy.model, source: legacy.source, createdAt: legacy.created_at }],
    }] });
  });

  it('質問を俯瞰でき、conversation_hashを前面に出さず、2ペインでMarkdown詳細を表示する', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('id="viewToggle"');
    expect(html).toContain('class="questions"');
    expect(html).toContain("workspace.classList.toggle('two-pane',twoPane)");
    expect(html).toContain('class="markdown answer preview-area"');
    expect(html).not.toContain('item.turn.conversationHash');
  });

  it('2ペイン切替前に個別回答を閉じ、質問一覧を▲▼で再表示できる', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain("if(nextTwoPane)closeInlineDetails()");
    expect(html).toContain("main.setAttribute('aria-expanded','false')");
    expect(html).toContain('class="questions-toggle"');
    expect(html).toContain("questionToggle.textContent=opening?'▲':'▼'");
    expect(html).toContain("questionList.hidden=!opening");
  });

  it('2ペイン状態をCookieへ保存し、検索欄と右ペインのスクロール範囲を切り替える', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain("VIEW_COOKIE='thread_tracker_two_pane'");
    expect(html).toContain("twoPane=document.cookie.split(';').some");
    expect(html).toContain("document.cookie=VIEW_COOKIE+'='+(twoPane?'1':'0')");
    expect(html).toContain("mainContent.classList.toggle('two-pane-mode',twoPane)");
    expect(html).toMatch(/\.two-pane-mode\{display:grid;grid-template-columns:minmax\(260px,min\(30vw,380px\)\) minmax\(0,1fr\);column-gap:8px;align-items:start;padding:8px/);
    expect(html).toContain('.two-pane-mode .detail-pane{grid-column:2;grid-row:1/5;margin-top:0}');
    expect(html).toMatch(/\.detail-pane\{[^}]*top:0[^}]*height:calc\(100dvh - 16px\)[^}]*overflow:hidden[^}]*padding:12px/);
    expect(html).toContain('<div class="turn-deck" data-active-slide="\'+activeIndex+\'">\'+slides+\'</div>');
    expect(html).toMatch(/\.turn-deck\{[^}]*flex:1;min-height:0[^}]*overflow:hidden/);
    expect(html).toMatch(/\.turn-slide\.active\{display:flex/);
    expect(html).toMatch(/\.detail-pane \.markdown\.answer\{[^}]*flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain/);
    expect(html).not.toContain('スレッドを俯瞰して、続きを質問');
    expect(html).not.toContain('各カードで質問の流れを確認できます');
  });
});

describe('GET /api/aichat/threads/:threadId', () => {
  it('本人のターンだけを時系列レスポンスへ整形する', async () => {
    const rows = [{ id: 'share-1', conversation_hash: 'conversation-1', question: '最初の質問', answer: '回答', model: 'gemma', source: 'textbox', created_at: '2026-09-28T00:00:00.000Z' }];
    const res = await app.request('/api/aichat/threads/' + THREAD_ID, { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeDb(rows) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ threadId: THREAD_ID, turns: [{ id: 'share-1', conversationHash: 'conversation-1', question: '最初の質問', answer: '回答', model: 'gemma', source: 'textbox', createdAt: '2026-09-28T00:00:00.000Z' }] });
  });

  it('不正なthreadIdをDB照会前に拒否する', async () => {
    const res = await app.request('/api/aichat/threads/not-valid', { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeDb([]) });
    expect(res.status).toBe(400);
  });

  it('他ユーザーの行がなく空なら404を返す', async () => {
    const res = await app.request('/api/aichat/threads/' + THREAD_ID, { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeDb([]) });
    expect(res.status).toBe(404);
  });

  it('DBエラーの詳細を汎用サーバーエラーで隠さない', async () => {
    const res = await app.request('/api/aichat/threads/' + THREAD_ID, { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeFailingDb('no such column: thread_id') });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'スレッドの取得に失敗しました: no such column: thread_id' });
  });
});

describe('GET /api/aichat/threads/growing', () => {
  it('DBエラーの詳細をページへ返す', async () => {
    const res = await app.request('/api/aichat/threads/growing?limit=50', { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: makeFailingDb('no such column: thread_id') });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: '成長中スレッドの取得に失敗しました: no such column: thread_id' });
  });
});
