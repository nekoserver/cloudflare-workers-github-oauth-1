import { describe, it, expect, vi } from 'vitest';
import app, { KIMI_CODE_MODEL } from './index';
import { getKimiCodePage } from './views/kimiCode';
import { createJWT } from './utils/jwt';

// 対象: /kimi-code ページと /api/kimi-code/generate エンドポイント。
// Cloudflare Workers AIのkimi-k2.7-codeモデルへプロンプトを送りコードを
// 生成する。account ID/APIトークンは使わず、Worker既存のAIバインディング
// (env.AI)経由で呼び出す設計(認証情報を新たに管理・漏洩させない)。
//
// 故障シナリオ:
//   (1) プロンプト未入力でリクエストしてしまい、無意味なAI課金が発生する
//   (2) AIバインディング未設定の環境でも例外で落ちず、分かりやすいエラーを返す
//   (3) AI呼び出しが例外を投げた場合、汎用500ではなく実際のエラー内容を返す
//      (このセッションで繰り返し発生した「原因不明の汎用エラー」問題を
//      同じ轍で再発させない)
//   (4) AIが空応答を返した場合、成功扱いで空のcodeを返してしまう

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function makeEnv(ai: unknown) {
  return {
    AI: ai,
    GITHUB_CLIENT_ID: 'test',
    GITHUB_CLIENT_SECRET: 'test',
    JWT_SECRET,
  };
}

describe('/kimi-code ページ', () => {
  function buildPage(): string {
    return getKimiCodePage('testuser');
  }

  it('プロンプト入力欄・生成ボタン・出力欄が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="kimiPrompt"');
    expect(html).toContain('id="kimiSystemPrompt"');
    expect(html).toContain('id="kimiGenerateBtn"');
    expect(html).toContain('id="kimiOutput"');
  });

  it('/api/kimi-code/generate を fetch する', () => {
    const html = buildPage();
    expect(html).toContain('/api/kimi-code/generate');
  });

  it('プロンプト未入力の場合はfetchせずエラー表示する(無駄なAI課金を防ぐ)', () => {
    const html = buildPage();
    const idx = html.indexOf("generateBtn.addEventListener('click'");
    const block = html.slice(idx, idx + 400);
    expect(block).toContain('if (!prompt)');
    expect(block).toContain('showError(');
  });

  it('従量課金モデルであることの注意書きが表示される', () => {
    const html = buildPage();
    expect(html).toContain('従量課金');
  });

  it('生成結果を安全なMarkdown HTMLとして描画し、生Markdownは後続操作用に保持する', () => {
    const html = buildPage();
    expect(html).toContain('function parseMd(src)');
    expect(html).toContain('id="kimiOutput" class="preview-area"');
    expect(html).toContain('outputEl.innerHTML = parseMd(d.code)');
    expect(html).toContain('var latestOutput =');
    expect(html).toContain('navigator.clipboard.writeText(latestOutput)');
    expect(html).toContain('var code = latestOutput');
  });
});

describe('POST /api/kimi-code/generate', () => {
  it('promptを渡すとkimi-k2.7-codeを呼び出し、生成結果を返す', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ response: 'const x = 1;' }) };
    const auth = await makeAuthHeader();

    const res = await app.request('/api/kimi-code/generate', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'add two numbers' }),
    }, makeEnv(ai));

    expect(res.status).toBe(200);
    const data = await res.json() as { code: string; model: string };
    expect(data.code).toBe('const x = 1;');
    expect(data.model).toBe(KIMI_CODE_MODEL);
    expect(ai.run).toHaveBeenCalledWith(
      KIMI_CODE_MODEL,
      expect.objectContaining({ messages: [{ role: 'user', content: 'add two numbers' }] })
    );
  });

  it('systemPromptを渡すとmessagesの先頭にsystemロールとして含まれる', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ response: 'ok' }) };
    const auth = await makeAuthHeader();

    await app.request('/api/kimi-code/generate', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello', systemPrompt: 'You are terse.' }),
    }, makeEnv(ai));

    expect(ai.run).toHaveBeenCalledWith(
      KIMI_CODE_MODEL,
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'You are terse.' },
          { role: 'user', content: 'hello' },
        ],
      })
    );
  });

  it('promptが空の場合は400を返しAIを呼ばない', async () => {
    const ai = { run: vi.fn() };
    const auth = await makeAuthHeader();

    const res = await app.request('/api/kimi-code/generate', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '  ' }),
    }, makeEnv(ai));

    expect(res.status).toBe(400);
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('AIの応答が.responseではなく.choices[0].message.content形式(チャット補完形式)の場合もcodeとして取得する', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ choices: [{ message: { content: 'def add(a, b): return a + b' } }] }) };
    const auth = await makeAuthHeader();

    const res = await app.request('/api/kimi-code/generate', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'add two numbers' }),
    }, makeEnv(ai));

    expect(res.status).toBe(200);
    const data = await res.json() as { code: string };
    expect(data.code).toBe('def add(a, b): return a + b');
  });

  it('AIバインディング未設定の場合は503を返す', async () => {
    const auth = await makeAuthHeader();

    const res = await app.request('/api/kimi-code/generate', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    }, makeEnv(undefined));

    expect(res.status).toBe(503);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('AIバインディング');
  });

  it('AI呼び出しが例外を投げた場合、汎用500ではなく実際のエラー内容を返す', async () => {
    const ai = { run: vi.fn().mockRejectedValue(new Error('rate limited: too many requests')) };
    const auth = await makeAuthHeader();

    const res = await app.request('/api/kimi-code/generate', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    }, makeEnv(ai));

    expect(res.status).toBe(500);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('rate limited: too many requests');
  });

  it('AIが空応答を返した場合は502を返す(成功扱いにしない)', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ response: '' }) };
    const auth = await makeAuthHeader();

    const res = await app.request('/api/kimi-code/generate', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' }),
    }, makeEnv(ai));

    expect(res.status).toBe(502);
  });
});
