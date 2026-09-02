function escGhAttach(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// /gh-attach: gh CLI(cli/cli)の `gh issue create --attach` をブラウザから
// 使えるようにしたページ。画像添付付きのGitHub Issueを作成する。
//
// アップロード先URLの組み立て・本文Markdownの書き換え(参照の差し替え・
// 未参照分の追記)はwasm/gh-attach-wasm(Go/js-wasm移植)がブラウザ側で行う。
// 実際のバイト送信(GitHubへのアップロード)とIssue作成はこのページの
// /api/gh-attach/upload・/api/gh-attach/create-issue(Worker側)が、
// このユーザーの既存GitHub OAuthセッションのアクセストークンを使って行う。
export function getGhAttachPage(username: string): string {
  const safeUser = escGhAttach(username);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>gh issue create --attach (WASM移植)</title>
<style>
:root {
  color-scheme: light dark;
  --bg:          light-dark(#f6f8fa, #0d1117);
  --panel:       light-dark(#ffffff, #161b22);
  --border:      light-dark(#d0d7de, #30363d);
  --text:        light-dark(#1f2328, #c9d1d9);
  --text-muted:  light-dark(#636c76, #8b949e);
  --text-strong: light-dark(#1f2328, #f0f6fc);
  --accent:      light-dark(#0969da, #58a6ff);
  --accent-fg:   light-dark(#ffffff, #0d1117);
  --input-bg:    light-dark(#ffffff, #0d1117);
  --danger:      light-dark(#cf222e, #f85149);
  --danger-bg:   light-dark(#fff0ee, #2d0e0a);
  --ok:          light-dark(#1a7f37, #3fb950);
  --ok-bg:       light-dark(#dafbe1, #0d2818);
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px;
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px; line-height: 1.5;
  max-width: 760px; margin-left: auto; margin-right: auto;
}
h1 { color: var(--text-strong); font-size: 20px; margin: 0 0 4px; }
.subtitle { color: var(--text-muted); font-size: 12px; margin-bottom: 18px; }
.user-badge { font-size: 11px; color: var(--text-muted); }
.panel {
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 14px 16px; margin-bottom: 14px;
}
label.field-label { display: block; font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 6px; }
input[type=text], textarea {
  width: 100%;
  background: var(--input-bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 8px 10px; font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  outline: none;
}
input[type=text]:focus, textarea:focus { border-color: var(--accent); }
textarea { min-height: 120px; resize: vertical; }
.field { margin-bottom: 12px; }
.attach-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
  border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px;
}
.attach-row .fname { flex: 0 0 auto; font-size: 12px; color: var(--text-muted); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attach-row input[type=text] { flex: 1 1 auto; }
.btn {
  background: var(--panel); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text); font-size: 13px; padding: 7px 14px; cursor: pointer;
}
.btn:hover { background: var(--bg); border-color: var(--accent); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); font-weight: 600; }
.btn.primary:disabled { opacity: .5; cursor: not-allowed; }
.status-msg { margin-top: 10px; padding: 8px 12px; border-radius: 6px; font-size: 12px; display: none; white-space: pre-wrap; }
.status-msg.show { display: block; }
.status-msg.error { background: var(--danger-bg); color: var(--danger); }
.status-msg.ok { background: var(--ok-bg); color: var(--ok); }
.status-msg a { color: inherit; font-weight: 600; }
.hint { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
</style>
</head>
<body>
<h1>📎 gh issue create --attach (WASM移植版)</h1>
<p class="subtitle">画像添付付きのGitHub Issueを作成します <span class="user-badge">${safeUser}</span></p>

<div class="panel">
  <div class="field">
    <label class="field-label" for="ownerRepo">対象リポジトリ (owner/repo)</label>
    <input type="text" id="ownerRepo" placeholder="nekoserver/cloudflare-workers-github-oauth-1">
  </div>
  <div class="field">
    <label class="field-label" for="issueTitle">タイトル</label>
    <input type="text" id="issueTitle" placeholder="Issueのタイトル">
  </div>
  <div class="field">
    <label class="field-label" for="issueBody">本文</label>
    <textarea id="issueBody" placeholder="本文中に ![alt](ファイル名) と書いておくと、その位置がアップロード後のURLに置き換わります。書かなければ末尾に自動で追記されます。"></textarea>
  </div>
  <div class="field">
    <label class="field-label" for="fileInput">添付ファイル (png/jpeg/webp/gif、複数可)</label>
    <input type="file" id="fileInput" accept="image/png,image/jpeg,image/webp,image/gif" multiple>
    <div class="hint">alt textは省略可(空ならファイル名を使用)</div>
    <div id="attachList"></div>
  </div>
  <button class="btn primary" id="btnSubmit">Issueを作成</button>
  <div class="status-msg" id="statusMsg"></div>
</div>

<script type="module">
const ownerRepoEl = document.getElementById('ownerRepo');
const titleEl = document.getElementById('issueTitle');
const bodyEl = document.getElementById('issueBody');
const fileInputEl = document.getElementById('fileInput');
const attachListEl = document.getElementById('attachList');
const btnSubmit = document.getElementById('btnSubmit');
const statusEl = document.getElementById('statusMsg');

let selectedFiles = [];

fileInputEl.addEventListener('change', () => {
  selectedFiles = Array.from(fileInputEl.files || []);
  attachListEl.innerHTML = '';
  selectedFiles.forEach((f, i) => {
    const row = document.createElement('div');
    row.className = 'attach-row';
    const name = document.createElement('span');
    name.className = 'fname';
    name.textContent = f.name;
    const altInput = document.createElement('input');
    altInput.type = 'text';
    altInput.placeholder = 'alt text (省略可)';
    altInput.dataset.idx = String(i);
    row.appendChild(name);
    row.appendChild(altInput);
    attachListEl.appendChild(row);
  });
});

// GitHubのエラー応答やユーザー入力に由来する文字列をそのままinnerHTMLへ
// 差し込むとXSS・意図しないタグ解釈(GitHubがHTMLエラーページを返した場合に
// 内容が消える等)につながるため、常にtextContentで挿入する(常に安全な既定動作)。
function showStatus(kind, text) {
  statusEl.className = 'status-msg show ' + kind;
  statusEl.textContent = text;
}

// Issue作成成功時のみ、こちらで安全にリンクを組み立てて表示する
// (URL自体はGitHub APIが返したものなのでhref/textContent双方に使って問題ない)。
function showStatusWithLink(kind, prefixText, url) {
  statusEl.className = 'status-msg show ' + kind;
  statusEl.textContent = prefixText + ' ';
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = url;
  statusEl.appendChild(a);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('ファイル読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}

let wasmReadyPromise = null;
function ensureWasmReady() {
  if (wasmReadyPromise) return wasmReadyPromise;
  wasmReadyPromise = (async () => {
    await import('/wasm/gh-attach-wasm_exec.js');
    const go = new Go();
    const result = await WebAssembly.instantiateStreaming(fetch('/wasm/gh-attach.wasm'), go.importObject);
    go.run(result.instance);
  })();
  return wasmReadyPromise;
}

btnSubmit.addEventListener('click', async () => {
  const ownerRepo = ownerRepoEl.value.trim();
  const title = titleEl.value.trim();
  const body = bodyEl.value;
  if (!ownerRepo || !ownerRepo.includes('/')) {
    showStatus('error', 'owner/repo形式で入力してください');
    return;
  }
  if (!title) {
    showStatus('error', 'タイトルを入力してください');
    return;
  }

  btnSubmit.disabled = true;
  try {
    showStatus('ok', 'WASMモジュールを読み込み中...');
    await ensureWasmReady();

    const [owner, repo] = ownerRepo.split('/', 2);
    const attachments = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      showStatus('ok', 'アップロード中... (' + (i + 1) + '/' + selectedFiles.length + ') ' + file.name);
      const dataUrl = await fileToDataUrl(file);
      const altInput = attachListEl.querySelector('input[data-idx="' + i + '"]');
      const alt = (altInput && altInput.value.trim()) || file.name;

      const uploadRes = await fetch('/api/gh-attach/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, filename: file.name, dataUrl }),
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || uploadJson.error) {
        throw new Error(file.name + ': ' + (uploadJson.error || 'アップロードに失敗しました'));
      }
      attachments.push({ filename: file.name, alt, url: uploadJson.url, isVideo: false });
    }

    showStatus('ok', '本文を組み立て中...');
    const markdownResult = self.ghAttachBuildMarkdown(JSON.stringify({ body, attachments }));
    if (typeof markdownResult === 'string' && markdownResult.startsWith('ERROR: ')) {
      throw new Error('本文組み立てに失敗しました: ' + markdownResult);
    }

    showStatus('ok', 'Issueを作成中...');
    const issueRes = await fetch('/api/gh-attach/create-issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, repo, title, body: markdownResult }),
    });
    const issueJson = await issueRes.json();
    if (!issueRes.ok || issueJson.error) {
      throw new Error(issueJson.error || 'Issue作成に失敗しました');
    }

    showStatusWithLink('ok', 'Issueを作成しました:', issueJson.url);
  } catch (err) {
    showStatus('error', err && err.message ? err.message : String(err));
  } finally {
    btnSubmit.disabled = false;
  }
});
</script>
</body>
</html>`;
}
