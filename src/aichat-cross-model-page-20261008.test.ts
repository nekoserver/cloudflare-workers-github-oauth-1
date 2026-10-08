// @vitest-environment jsdom
// 対象: 新規ページ /aichat-cross-model(src/views/aichatCrossModel.ts の
// getAichatCrossModelPage)。AIチャットでclaudeとcodexの両方から回答を
// 得ている質問(question_hashの完全一致)だけを一覧表示する。
// データは /api/aichat/cross-model-questions (buildCrossModelQuestionGroups)。
//
// 故障シナリオ:
//   (1) usernameのHTML特殊文字がエスケープされずXSSになる
//   (2) <script>内のJSに構文エラーがある
//   (3) renderGroups がユーザー入力(question/userHash/id)をエスケープせずXSSになる
//   (4) groups が0件のときに空メッセージが出ず、空のまま固まる
import { describe, it, expect } from 'vitest';
import { getAichatCrossModelPage } from './views/aichatCrossModel';
import { extractFunctionSource } from './utils/extractFunctionSource';

describe('getAichatCrossModelPage: HTML構造', () => {
  const html = getAichatCrossModelPage('tester');

  it('ナビバーが44px固定のstickyで、右上に外部ナビリンクを置かない(PWAルール)', () => {
    const idx = html.indexOf('.navbar {');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('height: 44px');
    expect(snippet).toContain('position: sticky');
    // ナビバー内に外部へのaタグは brand(左端、/aichatへ)以外に存在しない
    const navStart = html.indexOf('<nav class="navbar">');
    const navEnd = html.indexOf('</nav>');
    const navHtml = html.slice(navStart, navEnd);
    const anchorCount = (navHtml.match(/<a\s/g) || []).length;
    expect(anchorCount).toBe(1);
  });

  it('usernameのHTML特殊文字をエスケープする(XSS対策)', () => {
    const xssHtml = getAichatCrossModelPage('<script>alert(1)</script>');
    expect(xssHtml).not.toContain('<script>alert(1)</script>');
    expect(xssHtml).toContain('&lt;script&gt;');
  });

  it('/api/aichat/cross-model-questions を fetch する', () => {
    expect(html).toContain("fetch('/api/aichat/cross-model-questions')");
  });

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });
});

describe('getAichatCrossModelPage: renderGroups のレンダリングロジック', () => {
  function loadRenderGroups() {
    const html = getAichatCrossModelPage('tester');
    const source = extractFunctionSource(html, 'renderGroups');
    expect(source).toBeTruthy();
    const escHtmlSrc = extractFunctionSource(html, 'escHtml');
    const formatDateSrc = extractFunctionSource(html, 'formatDate');
    document.body.innerHTML =
      '<div class="count-badge" id="countBadge"></div>' +
      '<div class="empty" id="emptyMsg" style="display:none;"></div>' +
      '<div id="list"></div>';
    const fn = new Function(
      'document',
      `var listEl = document.getElementById('list');
       var emptyEl = document.getElementById('emptyMsg');
       var countEl = document.getElementById('countBadge');
       ${escHtmlSrc}\n${formatDateSrc}\n${source}\nreturn renderGroups;`
    );
    return fn(document) as (groups: unknown[]) => void;
  }

  it('groupsが0件のとき空メッセージを表示し、listを空にする', () => {
    const renderGroups = loadRenderGroups();
    renderGroups([]);
    expect(document.getElementById('emptyMsg')!.style.display).toBe('block');
    expect(document.getElementById('list')!.innerHTML).toBe('');
  });

  it('groupsがある場合、質問文とclaude/codexへのリンクを描画する', () => {
    const renderGroups = loadRenderGroups();
    renderGroups([
      {
        questionHash: 'h1',
        question: '富士山について教えて',
        claude: { id: 'c1', userHash: 'uh1', createdAt: '2026-06-01T00:00:00.000Z' },
        codex: { id: 'x1', userHash: 'uh1', createdAt: '2026-06-02T00:00:00.000Z' },
      },
    ]);
    const listHtml = document.getElementById('list')!.innerHTML;
    expect(listHtml).toContain('富士山について教えて');
    expect(listHtml).toContain('/s/uh1/c1');
    expect(listHtml).toContain('/s/uh1/x1');
    expect(document.getElementById('countBadge')!.textContent).toBe('1件');
  });

  it('question/userHash/idにHTML特殊文字があってもエスケープする(XSS対策)', () => {
    const renderGroups = loadRenderGroups();
    renderGroups([
      {
        questionHash: 'h2',
        question: '<img src=x onerror=alert(1)>',
        claude: { id: 'c1', userHash: 'uh1', createdAt: '2026-06-01T00:00:00.000Z' },
        codex: { id: 'x1', userHash: 'uh1', createdAt: '2026-06-02T00:00:00.000Z' },
      },
    ]);
    const listHtml = document.getElementById('list')!.innerHTML;
    expect(listHtml).not.toContain('<img src=x onerror=alert(1)>');
    expect(listHtml).toContain('&lt;img');
  });
});

describe('getAichatCrossModelPage: ルート配線', () => {
  it("app.get('/aichat-cross-model', authMiddleware, ...) が index.ts に登録されている", () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain("app.get('/aichat-cross-model', authMiddleware, async (c) => {");
  });

  it("app.get('/api/aichat/cross-model-questions', authMiddleware, ...) が index.ts に登録されている", () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf-8');
    expect(src).toContain("app.get('/api/aichat/cross-model-questions', authMiddleware, async (c) => {");
  });
});
