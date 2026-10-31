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
// ログイン済みのブラウザで承認してもらい、T3本来のペアリングの資格情報を受け取って、このPWAの中でペアリングする。
// 受け取った資格情報は /#token=<資格情報> に入れてからT3の画面を起動する(T3の画面が起動時に読み取り、自動でペアリングする)。
// 「トークンで入る」で、いつでもT3の標準のペアリング画面へ進める。申請を作れないときも標準画面へ進む(行き止まりにしない)。
async function connect(entry) {
  const { main, message } = panel('PWAにログインを引き継ぐ');
  message.textContent = '引き継ぎの申請を作っています…';
  let pending = null, busy = false, stopped = false, timer;
  const code = document.createElement('p'); code.className = 'comparison-code';
  const note = document.createElement('p');
  note.textContent = 'ログイン済みのブラウザ(Safariなど)で下のリンクを開き、確認コードが同じことを確かめて承認してください。承認されると、このPWAに自動で引き継ぎます。';
  const link = document.createElement('a'); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'ログイン済みのブラウザで承認する'; link.hidden = true;
  const resume = () => { if (document.visibilityState !== 'hidden') void poll(); };
  const cleanup = () => { clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); window.removeEventListener('online', resume); window.removeEventListener('pageshow', resume); };
  async function finish(credential) {
    if (stopped && credential === undefined) return;
    stopped = true; cleanup();
    if (credential) history.replaceState(null, '', '/#token=' + encodeURIComponent(credential));
    await nativeApp(entry);
  }
  const manual = button('トークンで入る', () => finish(null));
  // 「状態を確認する」: 診断の各項目を、OKか、だめなら理由と対処で並べる(ログを見なくても原因と直し方が分かるように)。
  const report = document.createElement('div');
  const line = text => { const node = document.createElement('p'); node.textContent = text; report.append(node); };
  async function diagnose() {
    // 押したことが分かるように、すぐ「確認中」を出し、結果の位置まで画面を動かす(スマホでは結果が画面の外に出るため)。
    report.replaceChildren(); check.disabled = true; line('確認中…');
    report.scrollIntoView?.({ block: 'nearest' });
    try {
      const response = await window.fetch(prefix + '/diagnose', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      for (const check of data.checks || []) {
        line((check.ok ? '✓ ' : '✕ ') + check.name + (check.detail ? ': ' + check.detail : ''));
        if (!check.ok && check.remedy) line('対処: ' + check.remedy);
      }
      if (!(data.checks || []).length) line('診断の結果が空でした(HTTP ' + response.status + ')');
    } catch (error) { line('状態を確認できませんでした: ' + (error && error.message ? error.message : String(error))); }
    finally { report.firstChild?.remove(); check.disabled = false; report.scrollIntoView?.({ block: 'nearest' }); }
  }
  const check = button('状態を確認する', diagnose);
  main.append(code, note, link, manual, check, report);
  function schedule() { if (!stopped && document.visibilityState !== 'hidden') timer = setTimeout(() => void poll(), 2000); }
  async function poll() {
    if (stopped || busy || !pending) return;
    clearTimeout(timer); busy = true;
    try {
      const response = await post('/status', pending);
      if (!response.ok) {
        if (response.status >= 500 || response.status === 429) throw new Error('申請の確認を再試行しています…');
        const failure = await response.json().catch(() => ({}));
        stopped = true; forget(pendingKey); message.textContent = failure.remedy || '申請を確認できません。再読み込みで新しい申請を作るか、「トークンで入る」で進んでください。'; return;
      }
      const status = await response.json(); code.textContent = '確認コード: ' + status.code;
      if (status.state === 'approved') {
        const claim = await post('/claim', pending);
        const result = await claim.json().catch(() => ({}));
        forget(pendingKey);
        if (!claim.ok || typeof result.credential !== 'string' || !result.credential) {
          stopped = true; message.textContent = result.remedy || '引き継ぎの受け取りに失敗しました。再読み込みで新しい申請を作るか、「トークンで入る」で進んでください。'; return;
        }
        await finish(result.credential); return;
      }
      if (['expired', 'rejected', 'failed', 'consumed'].includes(status.state)) {
        stopped = true; forget(pendingKey); message.textContent = '申請の状態: ' + status.state + '。再読み込みで新しい申請を作るか、「トークンで入る」で進んでください。'; return;
      }
      message.textContent = '承認を待っています…';
    } catch (error) { message.textContent = error.message || '通信を再試行しています…'; }
    finally { busy = false; schedule(); }
  }
  document.addEventListener('visibilitychange', resume); window.addEventListener('focus', resume); window.addEventListener('online', resume); window.addEventListener('pageshow', resume);
  try {
    pending = stored(pendingKey);
    if (!pending || !Number.isFinite(pending.expires) || pending.expires * 1000 <= Date.now()) {
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      const response = await post('/create', { secret });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.id !== 'string') {
        // 黙ってT3の標準画面へ進まず、理由と対処を出す(「トークンで入る」「状態を確認する」で先へ進める)。
        stopped = true; cleanup(); message.textContent = result.remedy || '引き継ぎの申請を作れませんでした。「状態を確認する」で原因を確かめるか、「トークンで入る」で進んでください。'; return;
      }
      pending = { id: result.id, secret, expires: result.expires }; save(pendingKey, pending, false); code.textContent = '確認コード: ' + result.code;
    }
    link.href = prefix + '/approve/' + pending.id; link.hidden = false;
    message.textContent = '承認を待っています…';
    await poll();
  } catch (error) {
    stopped = true; cleanup(); message.textContent = '引き継ぎの申請を作れませんでした(' + (error && error.message ? error.message : String(error)) + ')。「状態を確認する」で原因を確かめるか、「トークンで入る」で進んでください。';
  }
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
    // 通信を確認できないときも、ボタンや案内の画面は出さない。保存済みの接続情報は維持したまま、T3の標準画面へ進む。
    await nativeApp(entry); return;
  }
  // セッションが無いときは、ログイン済みのブラウザからの引き継ぎを申請する(行き止まりにせず、「トークンで入る」も出す)。
  bearer = null; forget(tokenKey); await connect(entry);
}
const approvalId = location.pathname.match(/^\/_t3\/pwa\/approve\/([a-f0-9]{32})$/)?.[1];
if (approvalId) void approve(approvalId);
