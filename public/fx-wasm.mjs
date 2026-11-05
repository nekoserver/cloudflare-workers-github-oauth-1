import { createFxEngine } from './vendor/libfx/browser-agent.js';
import { supportsJspi } from './vendor/libfx/engine.js';

export const initialFile = 'export function greet(name) {\n  return `Hello, ${name}!`;\n}\n';
export const demoFile = 'export function greet(name) {\n  return `こんにちは、${name}！`;\n}\n';

export function workspaceTools(workspace, onChange = () => {}) {
  const validate = input => {
    if (!input || input.path !== 'hello.js') throw new Error('Only hello.js is available');
  };
  return [
    { name: 'read_file', description: 'Read the in-memory hello.js file.',
      inputSchema: { type: 'object', properties: { path: { type: 'string', enum: ['hello.js'] } }, required: ['path'], additionalProperties: false },
      idempotent: true,
      execute(input) { validate(input); return workspace.value; } },
    { name: 'write_file', description: 'Replace the in-memory hello.js file. No other files exist.',
      inputSchema: { type: 'object', properties: { path: { type: 'string', enum: ['hello.js'] }, content: { type: 'string', maxLength: 64000 } }, required: ['path', 'content'], additionalProperties: false },
      writes: true,
      execute(input) {
        validate(input);
        if (typeof input.content !== 'string' || new TextEncoder().encode(input.content).length > 64000) throw new Error('File exceeds 64 KB');
        workspace.value = input.content; onChange(); return 'Updated hello.js';
      } },
  ];
}

// Deterministic model transport. The actual fx WASM engine executes each tool.
export function simulatedFetch() {
  let step = 0;
  return async (input, init) => {
    const request = new Request(input, init);
    if (request.url !== 'https://fx-demo.invalid/v1/chat/completions' || request.method !== 'POST') throw new Error('Unexpected demo request');
    if (request.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const tools = [
      { name: 'read_file', arguments: JSON.stringify({ path: 'hello.js' }) },
      { name: 'write_file', arguments: JSON.stringify({ path: 'hello.js', content: demoFile }) },
    ];
    const tool = tools[step++];
    const delta = tool ? { tool_calls: [{ index: 0, id: 'demo-' + step, type: 'function', function: tool }] }
      : { content: 'FX_WASM_DEMO_OK — 模擬モデルでhello.jsの読み取りと日本語への変更を確認しました。' };
    const chunk = (d, finish_reason) => JSON.stringify({ id: 'fx-demo', object: 'chat.completion.chunk', created: 0, model: 'fx-demo', choices: [{ index: 0, delta: d, finish_reason }] });
    return new Response('data: ' + chunk(delta, null) + '\n\ndata: ' + chunk({}, tool ? 'tool_calls' : 'stop') + '\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  };
}

export function gatewayFetch(fetcher = fetch) {
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const allowed = (request.method === 'GET' && url.pathname === '/coding-agent/v1/models')
      || (request.method === 'POST' && url.pathname === '/v4/ai/language-model');
    if (url.origin !== 'https://ai-gateway.vercel.sh' || url.search || !allowed) throw new Error('Unexpected model endpoint');
    return fetcher(new Request(request, { redirect: 'error' }));
  };
}

if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  let controller = null;
  $('workspace').value = initialFile;
  const supported = supportsJspi();
  $('runtime').textContent = supported ? 'WASM / JSPIに対応しています。libfx 0.0.16' : 'このブラウザはJSPI非対応です。JSPI対応のChrome等で開いてください。';
  $('run').disabled = !supported;
  $('mode').addEventListener('change', () => {
    $('gateway-options').hidden = $('mode').value !== 'gateway';
    $('demo-note').hidden = $('mode').value !== 'demo';
    $('api-key').value = '';
  });
  $('reset').addEventListener('click', () => { if (!controller) $('workspace').value = initialFile; });
  $('stop').addEventListener('click', () => controller?.abort());
  window.addEventListener('pagehide', () => controller?.abort());
  $('fx-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (controller || !supported) return;
    const prompt = $('prompt').value.trim();
    if (!prompt || new TextEncoder().encode(prompt).length > 16000) { $('status').textContent = '依頼を16 KB以内で入力してください。'; return; }
    const demo = $('mode').value === 'demo';
    let key = $('api-key').value.trim();
    const model = $('model').value.trim();
    if (!demo && (!key || !model)) { $('status').textContent = 'モデルIDと自分のAPIキーを入力してください。'; return; }
    $('api-key').value = '';
    controller = new AbortController();
    const signal = controller.signal;
    for (const name of ['run', 'reset', 'mode', 'workspace']) $(name).disabled = true;
    $('stop').disabled = false;
    $('output').textContent = ''; $('events').textContent = '';
    $('status').textContent = 'WASMを準備しています…';
    let engine;
    try {
      const options = { tools: workspaceTools($('workspace')), instructions: 'Work only on hello.js using read_file and write_file. Explain the changes briefly in Japanese.' };
      if (demo) Object.assign(options, { provider: { name: 'demo', baseUrl: 'https://fx-demo.invalid/v1', models: { 'fx-demo': { contextWindow: 32000, maxOutputTokens: 1024, supportsToolUse: true } } }, model: 'fx-demo', fetch: simulatedFetch() });
      else Object.assign(options, { apiKey: key, model, fetch: gatewayFetch() });
      engine = await createFxEngine(options);
      key = '';
      signal.throwIfAborted();
      $('status').textContent = demo ? '模擬モデルで実行中…' : 'モデルへ問い合わせ中…';
      const turn = engine.prompt(prompt, { signal });
      for await (const e of turn) {
        if (e.type === 'text_delta') $('output').textContent += e.delta;
        if (e.type === 'tool_start') $('events').textContent += (e.name || e.toolName || 'tool') + '\n';
      }
      await turn.result;
      $('status').textContent = demo ? '完了（模擬モデル）' : '完了';
    } catch {
      $('status').textContent = signal.aborted ? '停止しました。変更済みのファイルは画面に残ります。' : '実行できませんでした。ブラウザのWASM対応、モデルID・キー・通信状態を確認してください。';
    } finally {
      key = '';
      try { await engine?.close(); } catch { /* Keep controls available on runtime shutdown errors. */ }
      controller = null;
      for (const name of ['run', 'reset', 'mode', 'workspace']) $(name).disabled = false;
      $('stop').disabled = true;
    }
  });
}
