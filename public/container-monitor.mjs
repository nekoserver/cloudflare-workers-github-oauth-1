const WASM_ROOT = '/tailscale-connect/1.102.3-3';
const STORAGE_PREFIX = 'container-monitor.tailscale.';
const labels = { running: '稼働中', provisioning: '起動準備中', starting: '起動中', stopping: '停止処理中', stopped: '停止', inactive: '非稼働', failed: '失敗', unhealthy: '異常', unknown: '不明', online: 'オンライン', offline: 'オフライン', 'no-instances': '記録なし' };

// 状態の色分け(ok=緑・warn=黄・ng=赤・info=灰)。止めたもの(stopped・inactive)は失敗ではないので灰にする。
export function statusLevel(status) {
  if (['running', 'online'].includes(status)) return 'ok';
  if (['provisioning', 'starting', 'stopping'].includes(status)) return 'warn';
  if (['failed', 'unhealthy', 'offline'].includes(status)) return 'ng';
  return 'info';
}
export function normalizeNetMap(value) {
  const map = typeof value === 'string' ? JSON.parse(value) : value;
  if (!map || !Array.isArray(map.peers)) throw new Error('Tailscaleの端末一覧を読み取れません');
  return map.peers.map((peer, index) => ({
    id: String(peer.id ?? peer.name ?? index), name: String(peer.name ?? ''), group: 'Tailnet',
    addresses: Array.isArray(peer.addresses) ? peer.addresses.filter(address => typeof address === 'string') : [],
    status: typeof peer.online === 'boolean' ? peer.online ? 'online' : 'offline' : 'unknown',
    observedAt: null, detail: 'Tailscale接続状態',
  }));
}
export function chooseProvider(config, preferred) {
  return config.providers.some(provider => provider.id === preferred) ? preferred : config.defaultProvider;
}

/** Decode the file container separately from HTTP content encoding. */
export async function loadTailscaleClient(config, fetcher = fetch) {
  const response = await fetcher(config.wasmURL ?? `${WASM_ROOT}/main.wasm.gz`);
  if (!response.ok) throw new Error(`WASM取得 HTTP ${response.status}`);
  let bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if (bytes[0] !== 0 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) throw new Error('WASMの配信形式が不正です');
  const wasmURL = URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }));
  try { return await (await import(`${WASM_ROOT}/pkg.js`)).createIPN({ ...config, wasmURL }); }
  finally { URL.revokeObjectURL(wasmURL); }
}

export function setupContainerMonitor(doc = document, dependencies = {}) {
  const request = dependencies.fetch ?? fetch;
  const createClient = dependencies.createIPN ?? loadTailscaleClient;
  const byId = id => doc.getElementById(id);
  const status = byId('monitor-status'); const body = byId('monitor-targets'); const picker = byId('monitor-provider');
  let providers = []; let snapshot = null; let wasmSnapshot = null; let connectionState = 'Stopped'; let client = null; let clientPromise = null; let busy = false; let generation = 0;
  const rows = (targets) => {
    body.replaceChildren();
    const filter = byId('monitor-filter').value.toLocaleLowerCase();
    for (const target of targets.filter(target => [target.name, target.group, ...target.addresses].join(' ').toLocaleLowerCase().includes(filter))) {
      const row = doc.createElement('tr');
      for (const value of [target.name, target.group, null, target.addresses.join(', '), target.observedAt ? new Date(target.observedAt).toLocaleString() : '—', target.detail]) {
        const cell = doc.createElement('td');
        if (value === null) {
          const badge = doc.createElement('span'); badge.className = 'badge'; badge.dataset.level = statusLevel(target.status);
          badge.textContent = labels[target.status] ?? target.status; cell.append(badge);
        } else cell.textContent = String(value ?? '');
        row.append(cell);
      }
      body.append(row);
    }
    byId('monitor-count').textContent = `${targets.length}件`;
  };
  const display = data => {
    snapshot = data; rows(data.targets);
    byId('monitor-scope').textContent = data.scope;
    status.textContent = `${data.complete ? '取得完了' : '一部未取得'} · ${new Date(data.fetchedAt).toLocaleTimeString()}${data.errors?.length ? ' · ' + data.errors.join(' / ') : ''}`;
  };
  const current = () => providers.find(provider => provider.id === picker.value);
  function updateControls() {
    const wasm = current()?.execution === 'browser';
    byId('monitor-wasm-controls').hidden = !wasm;
    byId('monitor-scope').textContent = current()?.scope ?? '';
    if (!wasm) byId('monitor-login').replaceChildren();
  }
  async function refresh() {
    if (busy) return;
    const provider = current(); if (!provider) return;
    if (provider.execution === 'browser') { if (wasmSnapshot && connectionState === 'Running') { display(wasmSnapshot); return; } status.textContent = client ? 'Tailscaleの接続状態を受信中です' : '「Tailscaleへ接続」でログインしてください'; return; }
    const run = generation; busy = true; byId('monitor-refresh').disabled = true;
    status.textContent = '取得中…';
    try {
      const response = await request(`/api/container-monitor/snapshot?provider=${encodeURIComponent(provider.id)}`, { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (run === generation) display(data);
    } catch (error) { if (run === generation) status.textContent = `取得失敗。${snapshot ? '前回の一覧を表示しています。' : ''}${error.message}`; }
    finally { busy = false; byId('monitor-refresh').disabled = false; if (run !== generation) void refresh(); }
  }
  async function connect() {
    if (clientPromise) return clientPromise;
    byId('monitor-connect').disabled = true; status.textContent = 'Tailscale WASMを読み込み中…';
    clientPromise = (async () => {
      const stateStorage = {
        getState: key => { try { return sessionStorage.getItem(STORAGE_PREFIX + key) ?? ''; } catch { return ''; } },
        setState: (key, value) => { try { sessionStorage.setItem(STORAGE_PREFIX + key, value); } catch { /* memory-only client remains usable */ } },
      };
      client = await createClient({ authKey: '', hostname: 'container-monitor-browser', wasmURL: `${WASM_ROOT}/main.wasm.gz`, stateStorage,
        panicHandler: () => { status.textContent = 'Tailscale接続でエラーが発生しました。ページを再読み込みしてください'; } });
      client.run({
        notifyState: state => {
          connectionState = state;
          if (state !== 'Running' && state !== 'Starting') wasmSnapshot = null;
          if (current()?.execution !== 'browser') return;
          status.textContent = `Tailscale: ${state}`;
          if (state === 'Running' && wasmSnapshot) display(wasmSnapshot);
          if (state !== 'Running' && state !== 'Starting') { wasmSnapshot = null; snapshot = null; rows([]); }
          if (state === 'NeedsLogin') byId('monitor-connect').disabled = false;
        },
        notifyNetMap: value => {
          try { wasmSnapshot = { provider: 'tailscale-wasm', scope: providers.find(item => item.id === 'tailscale-wasm')?.scope ?? '', fetchedAt: new Date().toISOString(), complete: true, targets: normalizeNetMap(value), errors: [] }; if (connectionState === 'Running' && current()?.execution === 'browser') display(wasmSnapshot); }
          catch (error) { status.textContent = error.message; }
        },
        notifyBrowseToURL: value => {
          let url; try { url = new URL(value); } catch { return; }
          if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname === 'login.tailscale.com' || url.hostname.endsWith('.tailscale.com'))) return;
          const link = doc.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Tailscaleのログイン画面を開く';
          byId('monitor-login').replaceChildren(link);
        },
        notifyPanicRecover: () => { status.textContent = 'Tailscale接続でエラーが発生しました。再接続してください'; },
      });
      client.login();
    })().catch(error => { status.textContent = `WASMの読み込みに失敗しました: ${error.message}`; clientPromise = null; client = null; })
      .finally(() => { byId('monitor-connect').disabled = false; });
    return clientPromise;
  }
  byId('monitor-connect').addEventListener('click', () => { wasmSnapshot = null; return client ? client.login() : connect(); });
  byId('monitor-disconnect').addEventListener('click', () => {
    connectionState = 'Stopped'; client?.logout();
    try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(key); } catch { /* storage may be disabled */ }
    wasmSnapshot = null; snapshot = null; rows([]); byId('monitor-login').replaceChildren(); status.textContent = 'Tailscaleからログアウトしました';
  });
  byId('monitor-filter').addEventListener('input', () => rows(snapshot?.targets ?? []));
  picker.addEventListener('change', () => { generation++; snapshot = null; rows([]); updateControls(); void refresh(); });
  async function reloadProviders() {
    const response = await request('/api/container-monitor/providers', { credentials: 'same-origin', cache: 'no-store' });
    const config = await response.json(); if (!response.ok) throw new Error(config.error || `HTTP ${response.status}`);
    const selected = chooseProvider(config, picker.value);
    if (picker.value !== selected) { generation++; snapshot = null; rows([]); }
    providers = config.providers;
    picker.replaceChildren(...providers.map(provider => { const option = doc.createElement('option'); option.value = provider.id; option.textContent = provider.label; return option; }));
    picker.value = selected; updateControls();
  }
  async function initialize() {
    try { await reloadProviders(); await refresh(); }
    catch (error) { status.textContent = `取得方式を確認できません: ${error.message}`; }
  }
  const interval = setInterval(() => { if (byId('monitor-auto').checked && !doc.hidden) void initialize(); }, 30_000);
  byId('monitor-refresh').addEventListener('click', initialize);
  return { initialize, refresh, reloadProviders, connect, destroy: () => { clearInterval(interval); generation++; } };
}
if (typeof document !== 'undefined' && document.getElementById('monitor-provider')) {
  const monitor = setupContainerMonitor(); void monitor.initialize();
  addEventListener('pagehide', monitor.destroy, { once: true });
}
