const prefix = '/_t3/pwa';
const tokenKey = 't3:pwa-native-session:v1';
const pendingKey = 't3:pwa-native-request:v1';
let bearer = null;
let originalFetch = window.fetch.bind(window);
function stored(key) { for (const store of [() => localStorage, () => sessionStorage]) { try { const value = store().getItem(key); if (value) return JSON.parse(value); } catch {} } return null; }
function save(key, value, persistent = true) {
  for (const store of persistent ? [() => localStorage, () => sessionStorage] : [() => sessionStorage]) { try { store().setItem(key, JSON.stringify(value)); return true; } catch {} }
  return false;
}
function forget(key) { for (const store of [() => localStorage, () => sessionStorage]) { try { store().removeItem(key); } catch {} } }
function panel(title) {
  let main = document.getElementById('pwa-connect');
  if (!main) { main = document.createElement('main'); main.id = 'pwa-connect'; document.body.append(main); }
  main.replaceChildren();
  if (!document.getElementById('pwa-connect-style')) {
    const css = document.createElement('link'); css.id = 'pwa-connect-style'; css.rel = 'stylesheet'; css.href = prefix + '/client.css'; document.head.append(css);
  }
  const heading = document.createElement('h1'); heading.textContent = title;
  const message = document.createElement('p'); message.setAttribute('role', 'status'); main.append(heading, message);
  return { main, message };
}
const button = (text, callback) => { const node = document.createElement('button'); node.type = 'button'; node.textContent = text; node.addEventListener('click', callback); return node; };
async function post(path, data, headers = {}) {
  return window.fetch(prefix + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data), credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(path === '/claim' ? 45000 : 15000) });
}
async function session() {
  const response = await window.fetch('/api/auth/session', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  return response.ok && (await response.json()).authenticated === true;
}
function installTransport() {
  window.fetch = (input, init) => {
    const request = new Request(input, init), url = new URL(request.url);
    if (bearer && url.origin === location.origin && (url.pathname.startsWith('/api/') || url.pathname === prefix + '/verified')) {
      const headers = new Headers(request.headers); headers.set('Authorization', 'Bearer ' + bearer.token);
      return originalFetch(new Request(request, { headers, credentials: 'omit' }));
    }
    return originalFetch(request);
  };
  const NativeWebSocket = window.WebSocket;
  class AuthorizedWebSocket extends EventTarget {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    CONNECTING = 0; OPEN = 1; CLOSING = 2; CLOSED = 3;
    socket = null; state = 0; binary = 'blob';
    constructor(url, protocols) {
      super(); this.originalUrl = String(url);
      const target = new URL(url, location.href);
      if (!bearer || target.protocol !== (location.protocol === 'https:' ? 'wss:' : 'ws:') || target.host !== location.host || target.pathname !== '/ws' || target.searchParams.has('wsTicket')) return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
      void (async () => {
        try {
          const response = await window.fetch('/api/auth/websocket-ticket/rpc', { method: 'POST', signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error('WebSocket authorization failed');
          const data = await response.json();
          if (typeof data.ticket !== 'string' || !data.ticket) throw new Error('Invalid WebSocket ticket');
          if (this.state === 3) return;
          target.searchParams.set('wsTicket', data.ticket);
          this.socket = protocols === undefined ? new NativeWebSocket(target) : new NativeWebSocket(target, protocols);
          this.socket.binaryType = this.binary;
          for (const type of ['open', 'message', 'close', 'error']) this.socket.addEventListener(type, event => {
            if (type === 'close') this.state = 3;
            const next = type === 'message' ? new MessageEvent(type, { data: event.data, origin: event.origin }) : type === 'close' ? new CloseEvent(type, { code: event.code, reason: event.reason, wasClean: event.wasClean }) : new Event(type);
            this.dispatchEvent(next);
          });
        } catch {
          if (this.state === 3) return;
          this.state = 3; this.dispatchEvent(new Event('error')); this.dispatchEvent(new CloseEvent('close', { code: 1006 }));
        }
      })();
    }
    get readyState() { return this.socket?.readyState ?? this.state; }
    get url() { return this.originalUrl; }
    get bufferedAmount() { return this.socket?.bufferedAmount ?? 0; }
    get extensions() { return this.socket?.extensions ?? ''; }
    get protocol() { return this.socket?.protocol ?? ''; }
    get binaryType() { return this.socket?.binaryType ?? this.binary; }
    set binaryType(value) { if (['blob', 'arraybuffer'].includes(value)) { this.binary = value; if (this.socket) this.socket.binaryType = value; } }
    send(data) { if (!this.socket || this.readyState !== 1) throw new DOMException('WebSocket is not open', 'InvalidStateError'); this.socket.send(data); }
    close(code, reason) { if (this.socket) this.socket.close(code, reason); else if (this.state !== 3) { this.state = 3; queueMicrotask(() => this.dispatchEvent(new CloseEvent('close', { code: 1000, wasClean: true }))); } }
  }
  for (const name of ['open', 'close', 'message', 'error']) Object.defineProperty(AuthorizedWebSocket.prototype, 'on' + name, {
    get() { return this['_on' + name] ?? null; },
    set(fn) { if (this['_on' + name]) this.removeEventListener(name, this['_on' + name]); this['_on' + name] = typeof fn === 'function' ? fn : null; if (this['_on' + name]) this.addEventListener(name, this['_on' + name]); }
  });
  window.WebSocket = AuthorizedWebSocket;
}
async function nativeApp(entry) {
  document.getElementById('pwa-connect')?.remove();
  await import(entry);
}
async function approve(id) {
  const { main, message } = panel('開発用PWAのT3接続を承認');
  try {
    const response = await originalFetch(prefix + '/approval/' + id, { cache: 'no-store', credentials: 'same-origin' });
    const info = await response.json();
    if (!response.ok) throw new Error(info.error || '申請を確認できませんでした。');
    const code = document.createElement('p'); code.textContent = '確認コード: ' + info.code; code.className = 'comparison-code'; main.append(code);
    const explanation = document.createElement('p'); explanation.textContent = 'PWAとコードが一致することを確認してください。開発用の独自接続経路です。承認すると、このPWA専用のT3セッションを最大24時間発行します。別タブのログインは維持されます。'; main.append(explanation);
    if (info.scopes.some(scope => ['terminal:operate', 'orchestration:operate'].includes(scope))) {
      const authority = document.createElement('p'); authority.textContent = 'ターミナルやエージェントの操作権限は、コンテナ内で強い権限を持ちます。自分のPWAからの申請だけを承認してください。'; main.append(authority);
    }
    const scopes = document.createElement('details'), summary = document.createElement('summary'), list = document.createElement('p'); summary.textContent = '付与する権限'; list.textContent = info.scopes.join(', '); scopes.append(summary, list); main.append(scopes);
    if (info.state !== 'pending') { message.textContent = '申請の状態: ' + info.state + '。PWAへ戻って確認してください。'; return; }
    const decide = async decision => {
      accept.disabled = reject.disabled = true;
      try {
        const result = await post('/approval/' + id, { decision }, { 'X-CSRF-Token': info.csrf });
        const outcome = await result.json();
        if (!result.ok || outcome.state !== (decision === 'approve' ? 'approved' : 'rejected')) throw new Error('承認を送信できませんでした。期限や状態を確認してください。');
        message.textContent = decision === 'approve' ? '承認しました。PWAへ戻ってください。' : '申請を拒否しました。';
      } catch (error) { message.textContent = error.message; accept.disabled = reject.disabled = false; }
    };
    const accept = button('このPWAを承認', () => void decide('approve')), reject = button('拒否', () => void decide('reject')); main.append(accept, reject);
  } catch (error) {
    message.textContent = error.message;
    const link = document.createElement('a'); link.href = '/'; link.textContent = 'T3のログイン画面を開く'; main.append(link);
  }
}
async function connect(entry) {
  const { main, message } = panel('開発用PWAのT3に接続');
  message.textContent = '接続申請を準備しています…';
  let pending = stored(pendingKey), busy = false, stopped = false, timer;
  const code = document.createElement('p'); code.className = 'comparison-code';
  const link = document.createElement('a'); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'ログイン済みの別タブで承認する';
  const restart = button('新しい接続申請を作る', () => { forget(pendingKey); location.reload(); }); restart.hidden = true;
  main.append(code, link, restart); link.hidden = true;
  function schedule() { if (!stopped && document.visibilityState !== 'hidden') timer = setTimeout(() => void poll(), 2000); }
  async function ready() {
    if (!bearer || !(await session())) return false;
    const response = await post('/verified', {});
    if (!response.ok || (await response.json()).verified !== true) throw new Error('セッションの検証を完了できませんでした。');
    forget(pendingKey); stopped = true; cleanup(); await nativeApp(entry); return true;
  }
  async function poll() {
    if (stopped || busy || !pending) return;
    clearTimeout(timer); busy = true;
    try {
      const response = await post('/status', pending);
      if (!response.ok) {
        if (response.status >= 500 || response.status === 429) throw new Error('申請の確認を再試行しています…');
        stopped = true; message.textContent = '申請を確認できません。新しい申請を作ってください。'; restart.hidden = false; return;
      }
      const status = await response.json(); code.textContent = '確認コード: ' + status.code;
      if (status.state === 'approved') {
        const claim = await post('/claim', pending), result = await claim.json();
        if (!claim.ok) throw new Error('接続の受け取りを再確認しています…');
        if (typeof result.token !== 'string' || !Number.isFinite(result.expires) || result.expires * 1000 <= Date.now()) throw new Error('接続情報が無効です。');
        bearer = { token: result.token, expires: result.expires }; save(tokenKey, bearer);
        if (await ready()) return;
      }
      if (status.state === 'consumed') {
        if (await ready()) return;
        stopped = true; message.textContent = '接続情報を受け取れませんでした。新しい申請を作ってください。'; restart.hidden = false; return;
      }
      if (['expired', 'rejected', 'failed'].includes(status.state)) {
        stopped = true; message.textContent = '申請の状態: ' + status.state + '。新しい申請を作ってください。'; restart.hidden = false; return;
      }
      message.textContent = status.state === 'redeeming' ? 'T3の接続を確認しています…' : '別タブでコードを確認して承認し、このPWAへ戻ってください。トークン入力は不要です。';
    } catch (error) { message.textContent = error.message || '通信を再試行しています…'; }
    finally { busy = false; schedule(); }
  }
  const resume = () => { if (document.visibilityState !== 'hidden') void poll(); };
  const cleanup = () => { clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); window.removeEventListener('online', resume); window.removeEventListener('pageshow', resume); };
  document.addEventListener('visibilitychange', resume); window.addEventListener('focus', resume); window.addEventListener('online', resume); window.addEventListener('pageshow', resume);
  window.addEventListener('pagehide', () => { clearTimeout(timer); }, { once: true });
  try {
    if (!pending || pending.expires * 1000 <= Date.now()) {
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      const response = await post('/create', { secret }), result = await response.json();
      if (!response.ok) throw new Error('申請を作成できませんでした。少し待って再読み込みしてください。');
      pending = { id: result.id, secret, expires: result.expires }; save(pendingKey, pending, false); code.textContent = '確認コード: ' + result.code;
    }
    link.href = prefix + '/approve/' + pending.id; link.hidden = false; await poll();
  } catch (error) { message.textContent = error.message; restart.hidden = false; }
}
export async function start(entry) {
  const standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;
  if (window.top === window && !standalone) { await nativeApp(entry); return; }
  bearer = stored(tokenKey);
  if (bearer && (!Number.isFinite(bearer.expires) || bearer.expires * 1000 <= Date.now())) { bearer = null; forget(tokenKey); }
  installTransport();
  try {
    if (await session()) {
      if (bearer) {
        const response = await post('/verified', {});
        if (!response.ok || (await response.json()).verified !== true) throw new Error('保存した接続情報の確認を完了できませんでした。');
      }
      await nativeApp(entry); return;
    }
  } catch {
    const { main, message } = panel('T3の接続を確認できません');
    message.textContent = '通信を確認してから再試行してください。保存済みの接続情報は維持しています。';
    main.append(button('再試行', () => location.reload())); return;
  }
  bearer = null; forget(tokenKey); await connect(entry);
}
const approvalId = location.pathname.match(/^\/_t3\/pwa\/approve\/([a-f0-9]{32})$/)?.[1];
if (approvalId) void approve(approvalId);
