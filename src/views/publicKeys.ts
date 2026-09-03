/**
 * 🔐公開鍵登録ページのHTML
 * ブラウザ側でECDSA(P-256)の鍵ペアを生成し、公開鍵のみをサーバーに登録する。
 * 秘密鍵はIndexedDBに(非exportableではないが)ローカル保存し、サーバーへは送らない。
 * 登録済みの鍵ごとに「照合テスト」ボタンでチャレンジ署名によるログイン確認ができる。
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getPublicKeysPage(user: { name?: string; username: string }): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const usernameJson = JSON.stringify(user.username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔐 公開鍵登録 - Cloudflare Workers GitHub OAuth</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
      min-height: 100vh;
    }
    .navbar {
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar-brand { font-size: 20px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
    .user-menu { display: flex; align-items: center; gap: 12px; }
    .user-name { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
    .user-icon {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 16px; cursor: pointer;
    }
    .user-menu-container { position: relative; }
    .dropdown-menu {
      display: none; position: absolute; top: 50px; right: 0;
      background: var(--dropdown-bg); border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 1000; overflow: hidden;
    }
    .dropdown-menu.show { display: block; }
    .dropdown-item {
      padding: 12px 20px; color: var(--text-secondary); text-decoration: none;
      display: block; cursor: pointer; border-bottom: 1px solid var(--border-color);
      transition: background 0.2s ease;
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: var(--dropdown-hover); }
    .dropdown-item.switch-account { color: var(--accent-color); }
    .dropdown-item.logout { color: var(--danger-color); }
    .container { max-width: 900px; margin: 0 auto; padding: 48px 32px; }
    .card {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 48px; margin-bottom: 32px;
    }
    .title { font-size: 36px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .subtitle { font-size: 16px; color: var(--text-muted); margin-bottom: 32px; }
    .create-form { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 24px; padding: 20px; background: var(--bg-secondary); border-radius: 8px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
    .form-group input[type="text"] {
      padding: 8px 10px; border: 1px solid var(--input-border); border-radius: 6px;
      font-size: 14px; color: var(--text-secondary); background: var(--input-bg);
    }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary { background: var(--accent-color); color: white; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-danger {
      background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color);
      border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: background 0.2s, color 0.2s;
    }
    .btn-danger:hover { background: var(--danger-color); color: white; }
    .btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }
    .icon-btn {
      background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px;
      padding: 6px 10px; font-size: 12px; cursor: pointer; color: var(--text-secondary); flex-shrink: 0;
    }
    .icon-btn:hover { background: var(--dropdown-hover); }
    .icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-secondary); }
    th { color: var(--text-muted); font-weight: 600; font-size: 12px; text-transform: uppercase; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .status-active { background: var(--success-color); color: white; }
    .status-revoked { background: var(--danger-color); color: white; }
    .status-no-key { background: #a0a0a0; color: white; }
    .empty-row td { text-align: center; color: var(--text-muted); padding: 24px; }
    .actions-cell { display: flex; gap: 6px; align-items: center; }
    .verify-result { font-size: 12px; margin-top: 6px; }
    .verify-result.ok { color: var(--success-color); }
    .verify-result.ng { color: var(--danger-color); }
    .notice {
      font-size: 13px; color: var(--text-muted); background: var(--bg-secondary);
      border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; line-height: 1.6;
    }
    .back-btn {
      background: var(--accent-color); color: white; border: none; border-radius: 8px;
      padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
      margin-top: 24px; text-decoration: none; display: inline-block;
    }
    .back-btn:hover { background: var(--accent-hover); }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🔐</span>
      <span>公開鍵登録</span>
    </div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
      <span class="user-name">${displayName}</span>
      <div class="user-menu-container">
        <div class="user-icon" title="${displayName}" onclick="toggleDropdown()">
          ${initials}
        </div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
          <a href="/api-keys" class="dropdown-item">🔑 キー管理</a>
          <a href="/public-keys" class="dropdown-item">🔐 公開鍵登録</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="card">
      <h1 class="title">🔐 公開鍵登録</h1>
      <p class="subtitle">チャレンジ署名によるログイン確認用の鍵ペアを、このブラウザ上で生成・照合できます。</p>

      <div class="notice">
        ・「鍵ペアを生成して登録」を押すと、このブラウザ内でECDSA(P-256)の鍵ペアを生成します。<br>
        ・秘密鍵はこの端末のIndexedDBにのみ保存され、サーバーには一切送信されません。公開鍵だけを登録します。<br>
        ・別のブラウザ・端末では対応する秘密鍵がないため「照合テスト」は失敗します(その端末で新しく鍵を生成・登録してください)。<br>
        ・ブラウザのデータを消去すると秘密鍵も失われます。以後その公開鍵での照合はできなくなるため、失効させてください。
      </div>

      <div class="create-form">
        <div class="form-group">
          <label for="newKeyLabel">ラベル</label>
          <input type="text" id="newKeyLabel" placeholder="例: 自宅PC" maxlength="100">
        </div>
        <button class="btn btn-primary" id="generateBtn" onclick="generateAndRegisterKey()">鍵ペアを生成して登録</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>ラベル</th>
            <th>状態</th>
            <th>登録日</th>
            <th>最終照合</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="keyTableBody">
          <tr class="empty-row"><td colspan="5">読み込み中...</td></tr>
        </tbody>
      </table>

      <a href="/welcome" class="back-btn">← ホームに戻る</a>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('show');
    }
    window.addEventListener('click', function(e) {
      var icon = document.querySelector('.user-icon');
      var dd = document.getElementById('dropdownMenu');
      if (!icon.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('show');
    });

    function escapeHtmlClient(s) {
      return String(s).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    // 秘密鍵(CryptoKeyPair)はIndexedDBに保存し、サーバーには送らない。
    // 鍵はサーバー側のuser_public_keys.idに紐づけて保存する。
    // 値は{keyPair, userId, label}の形で保存し、ログインページ(/login)が
    // userId/labelだけを読んでパスキーログインの選択肢一覧を作れるようにする
    // (秘密鍵そのものはCryptoKeyオブジェクトのままIndexedDB外に出ない)。
    var DB_NAME = 'public-key-auth';
    var STORE_NAME = 'keypairs';
    var CURRENT_USER_ID = ${usernameJson};

    function openKeyDb() {
      return new Promise(function(resolve, reject) {
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function() {
          req.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      });
    }

    function saveKeyPair(keyId, keyPair, label) {
      return openKeyDb().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put({ keyPair: keyPair, userId: CURRENT_USER_ID, label: label }, keyId);
          tx.oncomplete = function() { resolve(); };
          tx.onerror = function() { reject(tx.error); };
        });
      });
    }

    // 旧形式(バージョン変更前)はIndexedDBの値がCryptoKeyPairそのものだった。
    // 新形式は{keyPair, userId, label}でラップしている。req.result.keyPairが
    // 無ければ旧形式とみなしreq.result自体をCryptoKeyPairとして扱う
    // (取り違えると「この端末に秘密鍵が見つかりません」と誤表示されるため)。
    function loadKeyPair(keyId) {
      return openKeyDb().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).get(keyId);
          req.onsuccess = function() {
            if (!req.result) { resolve(null); return; }
            resolve(req.result.keyPair || req.result);
          };
          req.onerror = function() { reject(req.error); };
        });
      });
    }

    // 旧形式で保存された鍵を新形式({keyPair, userId, label})へ書き換える。
    // サーバー側の登録済み一覧(このユーザーの鍵)と突き合わせ、旧形式の
    // エントリだけを対象にする。/loginページのパスキーログイン一覧は
    // userIdが無いと機能しないため、このページを開いたタイミングで直しておく。
    function migrateLegacyKeyPairs(serverKeys) {
      return openKeyDb().then(function(db) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        serverKeys.forEach(function(key) {
          var getReq = store.get(key.id);
          getReq.onsuccess = function() {
            var value = getReq.result;
            if (value && !value.userId) {
              store.put({ keyPair: value.keyPair || value, userId: CURRENT_USER_ID, label: key.label }, key.id);
            }
          };
        });
        return new Promise(function(resolve) {
          tx.oncomplete = function() { resolve(); };
          tx.onerror = function() { resolve(); };
        });
      }).catch(function() { /* 移行に失敗してもページ表示は継続する */ });
    }

    function base64UrlEncode(buf) {
      var bytes = new Uint8Array(buf);
      var binary = '';
      for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
    }

    function generateAndRegisterKey() {
      var labelEl = document.getElementById('newKeyLabel');
      var btn = document.getElementById('generateBtn');
      var label = labelEl.value.trim();
      if (!label) {
        alert('ラベルを入力してください');
        return;
      }
      btn.disabled = true;

      crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      ).then(function(keyPair) {
        return crypto.subtle.exportKey('jwk', keyPair.publicKey).then(function(publicKeyJwk) {
          return fetch('/api/public-keys', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: label, publicKeyJwk: publicKeyJwk }),
          })
            .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
            .then(function(res) {
              if (!res.ok) {
                alert(res.data.error || '公開鍵の登録に失敗しました');
                return;
              }
              return saveKeyPair(res.data.key.id, keyPair, label).then(function() {
                labelEl.value = '';
                loadKeys();
              });
            });
        });
      }).catch(function(e) {
        alert('鍵ペアの生成に失敗しました: ' + (e && e.message ? e.message : e));
      }).finally(function() {
        btn.disabled = false;
      });
    }

    function formatStatus(item) {
      if (item.revoked_at) return '<span class="status-badge status-revoked">失効済み</span>';
      return '<span class="status-badge status-active">有効</span>';
    }

    function renderKeyTable(keys) {
      var body = document.getElementById('keyTableBody');
      if (!keys || keys.length === 0) {
        body.innerHTML = '<tr class="empty-row"><td colspan="5">まだ登録された公開鍵がありません</td></tr>';
        return;
      }
      body.innerHTML = keys.map(function(item) {
        var revoked = !!item.revoked_at;
        return '<tr>' +
          '<td>' + escapeHtmlClient(item.label) + '</td>' +
          '<td>' + formatStatus(item) + '</td>' +
          '<td>' + escapeHtmlClient(item.created_at) + '</td>' +
          '<td>' + (item.last_used_at ? escapeHtmlClient(item.last_used_at) : '未使用') + '</td>' +
          '<td>' +
            '<div class="actions-cell">' +
              '<button class="icon-btn" ' + (revoked ? 'disabled' : '') + ' onclick="runVerifyTest(&#39;' + item.id + '&#39;, this)">🔏 照合テスト</button>' +
              '<button class="icon-btn" ' + (revoked ? 'disabled' : '') + ' onclick="requestRevoke(&#39;' + item.id + '&#39;)">🗑️ 失効</button>' +
            '</div>' +
            '<div class="verify-result" id="verifyResult-' + item.id + '"></div>' +
          '</td>' +
          '</tr>';
      }).join('');
    }

    function loadKeys() {
      fetch('/api/public-keys', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var keys = data.keys || [];
          renderKeyTable(keys);
          return migrateLegacyKeyPairs(keys);
        })
        .catch(function() {
          document.getElementById('keyTableBody').innerHTML =
            '<tr class="empty-row"><td colspan="5">読み込みに失敗しました</td></tr>';
        });
    }

    function showVerifyResult(keyId, ok, message) {
      var el = document.getElementById('verifyResult-' + keyId);
      if (!el) return;
      el.textContent = message;
      el.className = 'verify-result ' + (ok ? 'ok' : 'ng');
    }

    function runVerifyTest(keyId, btn) {
      btn.disabled = true;
      showVerifyResult(keyId, true, '照合中...');

      loadKeyPair(keyId).then(function(keyPair) {
        if (!keyPair) {
          showVerifyResult(keyId, false, 'この端末に秘密鍵が見つかりません(別の端末で登録した鍵の可能性があります)');
          return;
        }
        return fetch('/api/public-keys/challenge', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyId: keyId }),
        })
          .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
          .then(function(res) {
            if (!res.ok) {
              showVerifyResult(keyId, false, res.data.error || 'チャレンジの取得に失敗しました');
              return;
            }
            var challenge = res.data.challenge;
            var challengeId = res.data.challengeId;
            var data = new TextEncoder().encode(challenge);
            return crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, data)
              .then(function(signature) {
                return fetch('/api/public-keys/verify', {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    challengeId: challengeId,
                    keyId: keyId,
                    signature: base64UrlEncode(signature),
                  }),
                });
              })
              .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
              .then(function(res) {
                if (!res.ok) {
                  showVerifyResult(keyId, false, res.data.error || '照合に失敗しました');
                  return;
                }
                showVerifyResult(keyId, true, '✅ 秘密鍵との照合に成功しました');
                loadKeys();
              });
          });
      }).catch(function(e) {
        showVerifyResult(keyId, false, '照合に失敗しました: ' + (e && e.message ? e.message : e));
      }).finally(function() {
        btn.disabled = false;
      });
    }

    var pendingRevokeId = null;

    function requestRevoke(id) {
      if (!confirm('この公開鍵を失効させますか?')) return;
      fetch('/api/public-keys/' + encodeURIComponent(id) + '/revoke', {
        method: 'POST',
        credentials: 'same-origin',
      })
        .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
        .then(function(res) {
          if (!res.ok) {
            alert(res.data.error || '失効に失敗しました');
            return;
          }
          loadKeys();
        })
        .catch(function() { alert('失効に失敗しました'); });
    }

    loadKeys();
  </script>
</body>
</html>`;
}
