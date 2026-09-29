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
    expect(html).toMatch(/\.two-pane-mode\{display:grid;grid-template-columns:minmax\(280px,min\(34vw,420px\)\) minmax\(0,1fr\)/);
    expect(html).toContain('.two-pane-mode .detail-pane{grid-column:2;grid-row:1/5;margin-top:0}');
    expect(html).toMatch(/\.detail-pane\{[^}]*height:calc\(100dvh - 32px\)/);
  });

  it('右ペインの回答は共通Markdownパーサーで描画する', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('var renderMarkdown=(function()');
    expect(html).toContain("renderMarkdown(turn.answer||'(応答なし)')");
    expect(html).toContain('class="markdown answer preview-area"');
    expect(html).toContain('function parseMd(src)');
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
    expect(html).toContain("(turns.length>1?' has-followups':'')");
    expect(html).toContain('.thread-card.has-followups{border-left:4px solid var(--accent)}');
    expect(html).toContain('data-conversation-hash');
    expect(html).toContain("+(i?'↳ ':'')+esc(t.question||'(質問なし)')");
  });

  it('POST直後の再取得に新規投稿がまだ無い場合も投稿を保持してターン数を増やす', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain("if(!savedTurns.some(function(turn){return postedTurn.conversationHash&&turn.conversationHash===postedTurn.conversationHash;}))savedTurns.push(postedTurn)");
    expect(html).toContain('thread.turns=savedTurns');
  });

  it('右ペインは最新回答で上書きし、左スワイプまたはボタンで元質問を表示する', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('class="turn-deck"');
    expect(html).toContain('data-turn-view="\'+label+\'"');
    expect(html).toContain('← 左スワイプで元の質問を表示');
    expect(html).toContain("if(delta<-45)show(1)");
    expect(html).toContain("else if(delta>45)show(0)");
    expect(html).toContain('data-slide="1" aria-pressed="false">元の質問');
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

  it('DBで割り当てられたモデル色を既定色より優先する', () => {
    const html = getThreadTrackerPage('alice', { '@cf/google/gemma-4-26b-a4b-it': '#123abc' });
    expect(html).toContain('"@cf/google/gemma-4-26b-a4b-it":"#123abc"');
  });

  it('追加質問を元スレッドへの返信として青線で示し、元の質問を参照できる', () => {
    const html = getThreadTrackerPage('alice');
    expect(html).toContain('.thread-reply{');
    expect(html).toContain('border-left:4px solid var(--accent)');
    expect(html).toContain('↳ 元スレッドへの返信');
    expect(html).toContain('data-parent-thread>元の質問を参照');
    expect(html).toContain("if(parentLink)parentLink.addEventListener('click',function(){show(1);})");
    expect(html).toContain("(isReply?' thread-reply':'')");
  });
});

describe('GET /api/aichat/threads/seed', () => {
  it('期間制限なしの過去ログをスレッドごとのシードデータへ整形する', async () => {
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

  it('期間条件を使わず、所有者のconversation_hash付き未削除行を取得する', async () => {
    let capturedSql = '';
    const db = { prepare(sql: string) { capturedSql = sql; return { bind() { return { async first() { return { last_activity_at: new Date().toISOString(), revoked_at: null, idle_timeout_seconds: null }; }, async all() { return { results: [] }; }, async run() { return { success: true }; } }; } }; } };
    await app.request('/api/aichat/threads/seed', { headers: { Cookie: await authCookie() } }, { JWT_SECRET: SECRET, DB: db });
    expect(capturedSql).toContain('user_id = ?');
    expect(capturedSql).toContain('conversation_hash IS NOT NULL');
    expect(capturedSql).toContain('deleted_at IS NULL');
    expect(capturedSql).toContain('conversation_hash');
    expect(capturedSql).not.toContain('created_at >=');
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
    expect(html).toMatch(/\.two-pane-mode\{display:grid;grid-template-columns:minmax\(280px,min\(34vw,420px\)\) minmax\(0,1fr\)/);
    expect(html).toContain('.two-pane-mode .detail-pane{grid-column:2;grid-row:1/5;margin-top:0}');
    expect(html).toMatch(/\.detail-pane\{[^}]*top:0[^}]*height:calc\(100dvh - 32px\)[^}]*overflow:hidden/);
    expect(html).toContain('<div class="turn-deck">\'+slides+\'</div>');
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
