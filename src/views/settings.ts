/**
 * 設定ページのHTML
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getSettingsPage(user: {
  name?: string;
  email?: string;
  username: string;
  issuedAt: string;
  expiresAt: string;
  expiresAtTimestamp: number;
  timezone?: string;
  sessionDuration?: string;
  recentCommitsCount?: number;
  toastDuration?: number;
  idleTimeoutSeconds?: number | null;
  statusCommitCacheSortMode?: string;
  statusChartMode?: string;
  statusChartSortOrder?: string;
  statusTableAutoDetect?: string;
  statusShowAutoDetectedTables?: string;
  statusIgnoreUnknownUnclassifiedWarning?: string;
  searchLabelMode?: string;
  apisSidebarOpen?: string;
  apisSidebarAccordion?: string;
  apisDescMode?: string;
  apisNavFlash?: string;
  aichatAutoVectorizeEnabled?: string;
  aichatAutoVectorizeModel?: string;
  answerGraphHideEmptyRows?: string;
  answerGraphTrailSessionStorage?: string;
  aichatPreferMoondream?: string;
  heritageTourCountryFilter?: string;
  wasmModulesViewMode?: string;
  emailConfirmLoginEnabled?: boolean;
  githubScopes?: string;
  githubGrantedScopes?: string[] | null;
  githubScopeError?: string | null;
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const currentTimezone = user.timezone || 'JST';
  const currentSessionDuration = user.sessionDuration || '1h';
  const currentRecentCommitsCount = user.recentCommitsCount || 20;
  const currentToastDuration = user.toastDuration || 10;
  const currentIdleTimeoutSeconds = user.idleTimeoutSeconds ?? null;
  const currentStatusCommitCacheSortMode = user.statusCommitCacheSortMode === 'toggle' ? 'toggle' : 'off';
  const currentStatusChartMode = user.statusChartMode === 'repo' ? 'repo' : 'gradient';
  const currentStatusChartSortOrder = user.statusChartSortOrder === 'date' ? 'date' : 'count';
  const currentStatusTableAutoDetect = user.statusTableAutoDetect === 'off' ? 'off' : 'on';
  const currentStatusShowAutoDetectedTables = user.statusShowAutoDetectedTables === 'on' ? 'on' : 'off';
  const currentStatusIgnoreUnknownUnclassifiedWarning = user.statusIgnoreUnknownUnclassifiedWarning === 'off' ? 'off' : 'on';
  const currentSearchLabelMode = ['manual-modal', 'auto-classify'].includes(user.searchLabelMode ?? '') ? user.searchLabelMode : 'uncategorized';
  const currentApisSidebarOpen = user.apisSidebarOpen === 'on' ? 'on' : 'off';
  const currentApisSidebarAccordion = user.apisSidebarAccordion === 'on' ? 'on' : 'off';
  const currentApisDescMode = user.apisDescMode === 'off' ? 'off' : 'on';
  const rawNavFlash = user.apisNavFlash ?? '7';
  const currentApisNavFlashOn = rawNavFlash !== 'off';
  const currentApisNavFlashCount = (currentApisNavFlashOn && /^[0-9]+$/.test(rawNavFlash)) ? rawNavFlash : '7';
  const AICHAT_AUTO_VECTORIZE_MODELS = ['@cf/baai/bge-m3', '@cf/pfnet/plamo-embedding-1b', '@cf/google/embeddinggemma-300m'];
  const currentAichatAutoVectorizeEnabled = user.aichatAutoVectorizeEnabled === 'off' ? 'off' : 'on';
  const currentAichatAutoVectorizeModel = AICHAT_AUTO_VECTORIZE_MODELS.includes(user.aichatAutoVectorizeModel ?? '')
    ? (user.aichatAutoVectorizeModel as string)
    : '@cf/pfnet/plamo-embedding-1b';
  const currentAnswerGraphHideEmptyRows = user.answerGraphHideEmptyRows === 'off' ? 'off' : 'on';
  const currentAnswerGraphTrailSessionStorage = user.answerGraphTrailSessionStorage === 'on' ? 'on' : 'off';
  const currentAichatPreferMoondream = user.aichatPreferMoondream === 'off' ? 'off' : 'on';
  const currentHeritageTourCountryFilter = user.heritageTourCountryFilter === 'off' ? 'off' : 'on';
  const currentWasmModulesViewMode = user.wasmModulesViewMode === 'panel' ? 'panel' : 'list';
  const currentEmailConfirmLoginEnabled = user.emailConfirmLoginEnabled === true;
  const requestedScopes = user.githubScopes ? user.githubScopes.split(/\s+/).filter(Boolean) : [];
  const grantedScopes = user.githubGrantedScopes ?? null;
  const scopeError = user.githubScopeError ? escapeHtml(user.githubScopeError) : null;
  const renderScopeBadges = (scopes: string[]): string =>
    scopes.length > 0
      ? scopes.map((scope) => `<span class="scope-badge">${escapeHtml(scope)}</span>`).join('')
      : '<span class="scope-empty">なし</span>';
  const requestedScopeBadges = renderScopeBadges(requestedScopes);
  const grantedScopeBadges = scopeError
    ? `<span class="scope-error">${scopeError}</span>`
    : grantedScopes === null
      ? '<span class="scope-empty">取得なし</span>'
      : renderScopeBadges(grantedScopes);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>設定 - Cloudflare Workers GitHub OAuth</title>
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
    .settings-card {
      background: var(--card-bg); border-radius: 16px;
      box-shadow: 0 20px 60px var(--card-shadow); padding: 48px; margin-bottom: 32px;
    }
    .settings-title { font-size: 36px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .settings-subtitle { font-size: 18px; color: var(--text-muted); margin-bottom: 32px; }
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 20px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px;
      padding-bottom: 8px; border-bottom: 2px solid var(--border-color);
    }
    .info-grid { display: grid; gap: 16px; }
    .info-item {
      background: var(--bg-secondary); border-radius: 8px; padding: 16px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .info-item.disabled { position: relative; }
    .info-item.disabled::after {
      content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(200,200,200,0.5); border-radius: 8px; pointer-events: none;
    }
    [data-theme="dark"] .info-item.disabled::after {
      background: rgba(0,0,0,0.4);
    }
    .info-label { color: var(--text-muted); font-size: 14px; font-weight: 600; }
    .info-value { color: var(--text-secondary); font-size: 14px; font-weight: 500; }
    .status-badge {
      display: inline-block; padding: 4px 12px; border-radius: 12px;
      font-size: 12px; font-weight: 600; background: var(--success-color); color: white;
    }
    .back-btn {
      background: var(--accent-color); color: white; border: none; border-radius: 8px;
      padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
      margin-top: 24px; text-decoration: none; display: inline-block;
    }
    .back-btn:hover { background: var(--accent-hover); }
    .timezone-select {
      width: 100%; padding: 10px 12px; border: 1px solid var(--input-border); border-radius: 6px;
      font-size: 14px; color: var(--text-secondary); background: var(--input-bg); cursor: pointer;
    }
    .timezone-select:disabled { background: var(--border-light); cursor: not-allowed; opacity: 0.6; }
    .setting-control { display: flex; align-items: center; gap: 12px; flex: 1; }
    .setting-select-wrapper { flex: 1; }
    .setting-checkbox { width: 18px; height: 18px; cursor: pointer; flex-shrink: 0; }
    .success-message {
      background: var(--success-color); color: white; padding: 12px 16px; border-radius: 8px;
      margin-top: 16px; display: none; font-size: 14px; font-weight: 500;
    }
    .success-message.show { display: block; }
    .button-container { display: none; margin-top: 16px; gap: 12px; justify-content: flex-start; }
    .button-container.show { display: flex; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-save { background: var(--success-color); color: white; }
    .btn-save:hover { background: #38a169; }
    .btn-cancel { background: #fc8181; color: white; }
    .btn-cancel:hover { background: #f56565; }
    .settings-toast {
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(12px);
      background: #2d3748; color: #fff; padding: 11px 22px; border-radius: 8px;
      font-size: 13px; font-weight: 500; opacity: 0; pointer-events: none;
      transition: opacity 0.22s, transform 0.22s; z-index: 9999; white-space: nowrap;
      box-shadow: 0 4px 16px rgba(0,0,0,0.22);
    }
    .settings-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    .time-remaining-warning { color: var(--danger-color); font-weight: 600; }
    .scope-badge {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      background: var(--badge-bg); color: var(--text-secondary); font-size: 12px; font-weight: 600;
    }
    .scope-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .scope-empty { color: var(--text-muted); font-size: 12px; font-weight: 600; }
    .scope-error { color: var(--danger-color); font-size: 12px; font-weight: 600; }
    .theme-label { font-size: 14px; color: var(--text-secondary); }
    .danger-zone-card { border: 1px solid var(--danger-color); }
    .danger-zone-title { color: var(--danger-color); border-bottom-color: var(--danger-color); }
    .danger-zone-item {
      display: flex; justify-content: space-between; align-items: center; gap: 24px;
      background: var(--bg-secondary); border-radius: 8px; padding: 16px;
    }
    .danger-zone-text { display: flex; flex-direction: column; gap: 4px; }
    .danger-zone-label { font-size: 14px; font-weight: 600; color: var(--text-primary); }
    .danger-zone-desc { font-size: 13px; color: var(--text-muted); }
    .btn-danger {
      background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color);
      border-radius: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600;
      cursor: pointer; white-space: nowrap; transition: background 0.2s, color 0.2s;
    }
    .btn-danger:hover { background: var(--danger-color); color: white; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>🔐</span>
      <span>ログイン中</span>
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
          <a href="/function-changelog" class="dropdown-item">🔖 関数辞典</a>
          <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
          <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
          <a href="/api-keys" class="dropdown-item">🔑 キー管理</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="settings-card">
      <h1 class="settings-title">⚙️ 設定</h1>
      <p class="settings-subtitle">ログイン状況と表示設定</p>

      <div class="section">
        <h2 class="section-title">ログイン状況</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">ログイン状態</span>
            <span class="status-badge">✓ ログイン中</span>
          </div>
          <div class="info-item">
            <span class="info-label">ログイン日時</span>
            <span class="info-value">${user.issuedAt}</span>
          </div>
          <div class="info-item">
            <span class="info-label">セッション有効期限</span>
            <span class="info-value">${user.expiresAt}</span>
          </div>
          <div class="info-item">
            <span class="info-label">残り</span>
            <span class="info-value" id="timeRemaining">計算中...</span>
          </div>
          <div class="info-item disabled" id="sessionDurationItem">
            <span class="info-label">次回ログイン時のセッション有効期限</span>
            <div class="setting-control">
              <div class="setting-select-wrapper">
                <select class="timezone-select" id="sessionDurationSelect" onchange="onSessionDurationChange()" disabled>
                  <option value="1h" ${currentSessionDuration === '1h' ? 'selected' : ''}>1時間 (デフォルト)</option>
                  <option value="3h" ${currentSessionDuration === '3h' ? 'selected' : ''}>3時間</option>
                  <option value="8h" ${currentSessionDuration === '8h' ? 'selected' : ''}>8時間</option>
                  <option value="1d" ${currentSessionDuration === '1d' ? 'selected' : ''}>1日</option>
                  <option value="3d" ${currentSessionDuration === '3d' ? 'selected' : ''}>3日</option>
                  <option value="1w" ${currentSessionDuration === '1w' ? 'selected' : ''}>1週間</option>
                </select>
              </div>
              <input type="checkbox" class="setting-checkbox" id="sessionDurationCheckbox" onchange="toggleSessionDurationEdit()">
            </div>
          </div>
          <div class="info-item disabled" id="idleTimeoutItem">
            <span class="info-label">アイドルタイムアウト <span style="font-size:11px;color:var(--muted)">（一定時間操作がないと自動ログアウト）</span></span>
            <div class="setting-control">
              <div class="setting-select-wrapper">
                <select class="timezone-select" id="idleTimeoutSelect" onchange="onIdleTimeoutChange()" disabled>
                  <option value="0" ${currentIdleTimeoutSeconds === null ? 'selected' : ''}>セッション期限まで（デフォルト）</option>
                  <option value="300"  ${currentIdleTimeoutSeconds === 300  ? 'selected' : ''}>5分</option>
                  <option value="900"  ${currentIdleTimeoutSeconds === 900  ? 'selected' : ''}>15分</option>
                  <option value="1800" ${currentIdleTimeoutSeconds === 1800 ? 'selected' : ''}>30分</option>
                  <option value="3600" ${currentIdleTimeoutSeconds === 3600 ? 'selected' : ''}>1時間</option>
                  <option value="7200" ${currentIdleTimeoutSeconds === 7200 ? 'selected' : ''}>2時間</option>
                  <option value="14400" ${currentIdleTimeoutSeconds === 14400 ? 'selected' : ''}>4時間</option>
                  <option value="28800" ${currentIdleTimeoutSeconds === 28800 ? 'selected' : ''}>8時間</option>
                </select>
              </div>
              <input type="checkbox" class="setting-checkbox" id="idleTimeoutCheckbox" onchange="toggleIdleTimeoutEdit()">
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">ログイン確認メール(EVP)を必須にする <span style="font-size:11px;color:var(--muted)">（デフォルトOFF。ONにするとログインの都度Resend経由の確認メール送信+リンククリックが必須になります。Resend側の障害等でメールが届かない場合ログインできなくなるリスクがあるためデフォルトOFFです）</span></span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="emailConfirmLoginLabel">${currentEmailConfirmLoginEnabled ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="emailConfirmLoginCheckbox" onchange="onEmailConfirmLoginChange()"
                  ${currentEmailConfirmLoginEnabled ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
        <div class="button-container" id="sessionButtonContainer">
          <button class="btn btn-save" onclick="saveSessionDuration()">保存</button>
          <button class="btn btn-cancel" onclick="cancelSessionDuration()">キャンセル</button>
        </div>
        <div class="success-message" id="sessionSuccessMessage">✓ セッション有効期限を変更しました</div>
        <div class="button-container" id="idleTimeoutButtonContainer" style="display:none">
          <button class="btn btn-save" onclick="saveIdleTimeout()">保存</button>
          <button class="btn btn-cancel" onclick="cancelIdleTimeout()">キャンセル</button>
        </div>
        <div class="success-message" id="idleTimeoutSuccessMessage">✓ アイドルタイムアウトを変更しました</div>
      </div>

      <div class="section">
        <h2 class="section-title">このアプリに付与済みの権限</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">要求スコープ</span>
            <span class="info-value">
              <span class="scope-list">${requestedScopeBadges}</span>
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">付与スコープ</span>
            <span class="info-value">
              <span class="scope-list">${grantedScopeBadges}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">表示設定</h2>
        <div class="info-grid">
          <div class="info-item disabled" id="timezoneItem">
            <span class="info-label">タイムゾーン</span>
            <div class="setting-control">
              <div class="setting-select-wrapper">
                <select class="timezone-select" id="timezoneSelect" onchange="onTimezoneChange()" disabled>
                  <option value="JST" ${currentTimezone === 'JST' ? 'selected' : ''}>JST (Default, +9)</option>
                  <option value="UTC" ${currentTimezone === 'UTC' ? 'selected' : ''}>UTC</option>
                </select>
              </div>
              <input type="checkbox" class="setting-checkbox" id="timezoneCheckbox" onchange="toggleTimezoneEdit()">
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">テーマ</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="themeLabel">ダーク</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="themeCheckbox" onchange="onThemeSettingChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item disabled" id="recentCommitsCountItem">
            <span class="info-label">最終コミット一覧の表示件数</span>
            <div class="setting-control">
              <div class="setting-select-wrapper">
                <select class="timezone-select" id="recentCommitsCountSelect" onchange="onRecentCommitsCountChange()" disabled>
                  <option value="5" ${currentRecentCommitsCount === 5 ? 'selected' : ''}>5件</option>
                  <option value="10" ${currentRecentCommitsCount === 10 ? 'selected' : ''}>10件</option>
                  <option value="20" ${currentRecentCommitsCount === 20 ? 'selected' : ''}>20件 (デフォルト)</option>
                  <option value="30" ${currentRecentCommitsCount === 30 ? 'selected' : ''}>30件</option>
                  <option value="50" ${currentRecentCommitsCount === 50 ? 'selected' : ''}>50件</option>
                  <option value="100" ${currentRecentCommitsCount === 100 ? 'selected' : ''}>100件</option>
                </select>
              </div>
              <input type="checkbox" class="setting-checkbox" id="recentCommitsCountCheckbox" onchange="toggleRecentCommitsCountEdit()">
            </div>
          </div>
          <div class="info-item disabled" id="toastDurationItem">
            <span class="info-label">トースト通知の表示時間</span>
            <div class="setting-control">
              <div class="setting-select-wrapper">
                <select class="timezone-select" id="toastDurationSelect" onchange="onToastDurationChange()" disabled>
                  ${Array.from({ length: 60 }, (_, i) => i + 1).map(s => `<option value="${s}" ${currentToastDuration === s ? 'selected' : ''}>${s}秒${s === 10 ? ' (デフォルト)' : ''}</option>`).join('')}
                </select>
              </div>
              <input type="checkbox" class="setting-checkbox" id="toastDurationCheckbox" onchange="toggleToastDurationEdit()">
            </div>
          </div>
          <div class="info-item disabled" id="statusChartModeItem">
            <span class="info-label">月別コミット量チャートの表示モード</span>
            <div class="setting-control">
              <div class="setting-select-wrapper">
                <select class="timezone-select" id="statusChartModeSelect" onchange="onStatusChartModeChange()" disabled>
                  <option value="gradient" ${currentStatusChartMode === 'gradient' ? 'selected' : ''}>グラデーション (デフォルト)</option>
                  <option value="repo" ${currentStatusChartMode === 'repo' ? 'selected' : ''}>リポジトリ別色分け</option>
                </select>
              </div>
              <input type="checkbox" class="setting-checkbox" id="statusChartModeCheckbox" onchange="toggleStatusChartModeEdit()">
            </div>
          </div>
          <div class="info-item disabled" id="statusChartSortOrderItem">
            <span class="info-label">月別コミット量のトグル状態</span>
            <div class="setting-control">
              <div class="setting-select-wrapper">
                <select class="timezone-select" id="statusChartSortOrderSelect" onchange="onStatusChartSortOrderChange()" disabled>
                  <option value="count" ${currentStatusChartSortOrder === 'count' ? 'selected' : ''}>件数順 (デフォルト)</option>
                  <option value="date" ${currentStatusChartSortOrder === 'date' ? 'selected' : ''}>日付順</option>
                </select>
              </div>
              <input type="checkbox" class="setting-checkbox" id="statusChartSortOrderCheckbox" onchange="toggleStatusChartSortOrderEdit()">
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">デバイスの傾きによってER図キー一覧の表示位置を変化させる</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="erTiltLabel">OFF</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="erTiltCheckbox" onchange="onErTiltChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">ER図座標JSONにグループ・カラーコードを含める</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="erJsonIncludeGroupLabel">ON</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="erJsonIncludeGroupCheckbox" onchange="onErJsonIncludeGroupChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">ER図グループ凡例を初期表示する</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="erLegendVisibleLabel">ON</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="erLegendVisibleCheckbox" onchange="onErLegendVisibleChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">ER図テーブルヘッダーをタップしてデータプレビューを表示する</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="erHeaderTapLabel">ON</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="erHeaderTapCheckbox" onchange="onErHeaderTapChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item" id="erHeaderTapNoteItem" style="display:none">
            <span class="info-label" style="color:var(--text-muted);font-size:12px">※ OFFにするとER図のテーブルヘッダーをタップしてもデータモーダルが開きません。ONの場合はログイン済みの場合のみデータを取得できます（未ログイン時はメッセージを表示）。</span>
          </div>
          <div class="info-item disabled" id="statusCommitCacheSortModeItem">
            <span class="info-label">月別コミットキャッシュ詳細の並び替え</span>
            <div class="setting-control">
              <div class="setting-select-wrapper">
                <select class="timezone-select" id="statusCommitCacheSortModeSelect" onchange="onStatusCommitCacheSortModeChange()" disabled>
                  <option value="off" ${currentStatusCommitCacheSortMode === 'off' ? 'selected' : ''}>OFF (デフォルト)</option>
                  <option value="toggle" ${currentStatusCommitCacheSortMode === 'toggle' ? 'selected' : ''}>トグル式</option>
                </select>
              </div>
              <input type="checkbox" class="setting-checkbox" id="statusCommitCacheSortModeCheckbox" onchange="toggleStatusCommitCacheSortModeEdit()">
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">/status のテーブル自動検出機能</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="statusTableAutoDetectLabel">${currentStatusTableAutoDetect === 'on' ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="statusTableAutoDetectCheckbox" onchange="onStatusTableAutoDetectChange()"
                  ${currentStatusTableAutoDetect === 'on' ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">/status で自動検出テーブルを表示する</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="statusShowAutoDetectedTablesLabel">${currentStatusShowAutoDetectedTables === 'on' ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="statusShowAutoDetectedTablesCheckbox" onchange="onStatusShowAutoDetectedTablesChange()"
                  ${currentStatusShowAutoDetectedTables === 'on' ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">未分類のunknownマイグレーションテーブル検出時にも警告しない</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="statusIgnoreUnknownUnclassifiedWarningLabel">${currentStatusIgnoreUnknownUnclassifiedWarning === 'on' ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="statusIgnoreUnknownUnclassifiedWarningCheckbox" onchange="onStatusIgnoreUnknownUnclassifiedWarningChange()"
                  ${currentStatusIgnoreUnknownUnclassifiedWarning === 'on' ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">検索履歴モーダルのインクリメントサーチ既定値</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="historyIncrSearchLabel">OFF</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="historyIncrSearchCheckbox" onchange="onHistoryIncrSearchChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">コミット履歴のフィルタ既定値</span>
            <div class="setting-control">
              <div class="setting-select-wrapper">
                <select class="timezone-select" id="commitHistoryMergeFilterSelect" onchange="onCommitHistoryMergeFilterChange()">
                  <option value="no-merge">マージ履歴以外のコミットログ</option>
                  <option value="merge-only">マージ履歴のみ</option>
                  <option value="all">すべて</option>
                </select>
              </div>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">検索キーワードの総ヒット件数がゼロの場合表示されないようにする</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="kpHideZeroHitsLabel">OFF</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="kpHideZeroHitsCheckbox" onchange="onKpHideZeroHitsChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">検索キーワードのカテゴリバッジ内に件数を表示する</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="keywordBadgeCountLabel">ON</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="keywordBadgeCountCheckbox" onchange="onKeywordBadgeCountChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">カテゴリグループのトグルスイッチがOFFになったらそれに連動してすべてのカテゴリバッジのトグル状態もOFFになる</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="cgGroupOffClearsBadgesLabel">ON</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="cgGroupOffClearsBadgesCheckbox" onchange="onCgGroupOffClearsBadgesChange()" checked>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">詳細集計パネルオープン時パネル領域以外をタップしてもパネルを閉じられるようにする</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="kwPanelTapCloseLabel">ON</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="kwPanelTapCloseCheckbox" onchange="onKwPanelTapCloseChange()" checked>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">キーワード詳細パネルを閉じる際『すべて』にフォーカスが当たらないようにする</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="kwPanelNoAllFocusLabel">OFF</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="kwPanelNoAllFocusCheckbox" onchange="onKwPanelNoAllFocusChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">新検索キーワード分類時のAIへの問い合わせ内容を可視化する</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="classifyDebugLabel">OFF</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="classifyDebugCheckbox" onchange="onClassifyDebugChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">AIチャットのナビバーに言語モード切替（system/prefix/plain）を表示する</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="aichatShowLangModeLabel">OFF</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="aichatShowLangModeCheckbox" onchange="onAichatShowLangModeChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">AIチャットのナビバーに選択中の言語モデル名を表示する（OFFは色丸のみ）</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="aichatShowModelNameLabel">OFF</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="aichatShowModelNameCheckbox" onchange="onAichatShowModelNameChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">スラッシュコマンドからのプルリク応答で作成者を伏せる（/neko gh pr list）</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="nekoPrHideAuthorLabel">ON</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="nekoPrHideAuthorCheckbox" onchange="onNekoPrHideAuthorChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">AIチャット画面の左サイドバーを余白タップでも閉じられるようにする</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="aichatSidebarTapCloseLabel">ON</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="aichatSidebarTapCloseCheckbox" onchange="onAichatSidebarTapCloseChange()">
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item disabled" id="ztKeywordSharesExternalLinkItem">
            <span class="info-label">ZTモーダル「関連する会話」内の「🔗 別タブで開く」リンク（外部公開URL）</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label">OFF（既定・現在は変更不可）</span>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">AIチャットの過去ログのプレビューをどこで行うか</span>
            <div class="setting-control">
              <select class="timezone-select" id="aichatHistoryPreviewModeSelect" onchange="onAichatHistoryPreviewModeChange()">
                <option value="bottom-panel">画面下パネルの右ペイン</option>
                <option value="center-modal">画面中央のモーダル</option>
              </select>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">新規検索キーワードの分類対象</span>
            <div class="setting-control">
              <select class="timezone-select" id="searchLabelModeSelect" onchange="onSearchLabelModeChange()">
                <option value="uncategorized" ${currentSearchLabelMode === 'uncategorized' ? 'selected' : ''}>未分類のまま（分類しない）</option>
                <option value="manual-modal" ${currentSearchLabelMode === 'manual-modal' ? 'selected' : ''}>新規キーワード追加時にラベル選択モーダルを表示</option>
                <option value="auto-classify" ${currentSearchLabelMode === 'auto-classify' ? 'selected' : ''}>AIが自動分類する（Workers AI）</option>
              </select>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">テキストプロンプトに添付画像がある場合優先的に言語モデルmoondreamで画像を分析する</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="aichatPreferMoondreamLabel">${currentAichatPreferMoondream === 'on' ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="aichatPreferMoondreamCheckbox" onchange="onAichatPreferMoondreamChange()"
                  ${currentAichatPreferMoondream === 'on' ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">キーワードの自動ベクタ化（answer-graph色分け・AI分類提案などで使用）</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="aichatAutoVectorizeEnabledLabel">${currentAichatAutoVectorizeEnabled === 'on' ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="aichatAutoVectorizeEnabledCheckbox" onchange="onAichatAutoVectorizeEnabledChange()"
                  ${currentAichatAutoVectorizeEnabled === 'on' ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">キーワードを自動ベクタ化する際に使う埋め込みモデル</span>
            <div class="setting-control">
              <select class="timezone-select" id="aichatAutoVectorizeModelSelect" onchange="onAichatAutoVectorizeModelChange()">
                <option value="@cf/baai/bge-m3" ${currentAichatAutoVectorizeModel === '@cf/baai/bge-m3' ? 'selected' : ''}>bge-m3</option>
                <option value="@cf/pfnet/plamo-embedding-1b" ${currentAichatAutoVectorizeModel === '@cf/pfnet/plamo-embedding-1b' ? 'selected' : ''}>plamo-embedding-1b（デフォルト）</option>
                <option value="@cf/google/embeddinggemma-300m" ${currentAichatAutoVectorizeModel === '@cf/google/embeddinggemma-300m' ? 'selected' : ''}>embeddinggemma-300m</option>
              </select>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">answer-graph: 「この回答文のキーワード:」からキーワードを選んで再検索したとき、キーワード数0・経路「ー」の行を表示しない</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="answerGraphHideEmptyRowsLabel">${currentAnswerGraphHideEmptyRows === 'on' ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="answerGraphHideEmptyRowsCheckbox" onchange="onAnswerGraphHideEmptyRowsChange()"
                  ${currentAnswerGraphHideEmptyRows === 'on' ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">世界遺産の巡回ルート処理時に国別フィルタを適用する(ルート順序の国旗ドロップダウンで絞り込んだ国以外を「🎬巡回ルートを再現する🌏」実行時のデータから除外します。OFFにすると常に全地点を渡します)</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="heritageTourCountryFilterLabel">${currentHeritageTourCountryFilter === 'on' ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="heritageTourCountryFilterCheckbox" onchange="onHeritageTourCountryFilterChange()"
                  ${currentHeritageTourCountryFilter === 'on' ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">answer-graph: パン屑リスト(選択履歴の足跡)をブラウザのsessionStorageに保存し、リロード後も復元する(足跡には検索履歴・回答内容に由来する情報が含まれます。デフォルトOFF、同意の上でONにしてください)</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="answerGraphTrailSessionStorageLabel">${currentAnswerGraphTrailSessionStorage === 'on' ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="answerGraphTrailSessionStorageCheckbox" onchange="onAnswerGraphTrailSessionStorageChange()"
                  ${currentAnswerGraphTrailSessionStorage === 'on' ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">WASMモジュール一覧ページのデフォルト表示モード</span>
            <div class="setting-control">
              <select class="timezone-select" id="wasmModulesViewModeSelect" onchange="onWasmModulesViewModeChange()">
                <option value="list" ${currentWasmModulesViewMode === 'list' ? 'selected' : ''}>リスト表示</option>
                <option value="panel" ${currentWasmModulesViewMode === 'panel' ? 'selected' : ''}>パネル表示</option>
              </select>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">APIページのサイドバーグループを初期状態で展開する</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="apisSidebarOpenLabel">${currentApisSidebarOpen === 'on' ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="apisSidebarOpenCheckbox" onchange="onApisSidebarOpenChange()"
                  ${currentApisSidebarOpen === 'on' ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">APIページ: フォーカスの当たっていないセクションのメニューはすべて閉じた状態にする</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="apisSidebarAccordionLabel">${currentApisSidebarAccordion === 'on' ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="apisSidebarAccordionCheckbox" onchange="onApisSidebarAccordionChange()"
                  ${currentApisSidebarAccordion === 'on' ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">APIページ: サイドバーにパスの代わりに日本語説明を表示する（▶ボタン非表示）</span>
            <div class="setting-control" style="justify-content: flex-end;">
              <span class="theme-label" id="apisDescModeLabel">${currentApisDescMode === 'on' ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="apisDescModeCheckbox" onchange="onApisDescModeChange()"
                  ${currentApisDescMode === 'on' ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">APIページ: 読み込み時にナビバーを点滅させる</span>
            <div class="setting-control" style="justify-content: flex-end; gap: 8px;">
              <select id="apisNavFlashCountSelect" onchange="onApisNavFlashChange()"
                style="font-size:11px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);"
                ${!currentApisNavFlashOn ? 'disabled' : ''}>
                ${['3','5','7','10','15','20'].map(n => `<option value="${n}"${currentApisNavFlashCount === n ? ' selected' : ''}>${n}回</option>`).join('')}
              </select>
              <span class="theme-label" id="apisNavFlashLabel">${currentApisNavFlashOn ? 'ON' : 'OFF'}</span>
              <label class="theme-toggle-switch">
                <input type="checkbox" id="apisNavFlashCheckbox" onchange="onApisNavFlashChange()"
                  ${currentApisNavFlashOn ? 'checked' : ''}>
                <span class="theme-toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
        <div class="button-container" id="buttonContainer">
          <button class="btn btn-save" onclick="saveTimezone()">保存</button>
          <button class="btn btn-cancel" onclick="cancelTimezone()">キャンセル</button>
        </div>
        <div class="success-message" id="successMessage">✓ タイムゾーンを変更しました</div>
        <div class="button-container" id="recentCommitsCountButtonContainer">
          <button class="btn btn-save" onclick="saveRecentCommitsCount()">保存</button>
          <button class="btn btn-cancel" onclick="cancelRecentCommitsCount()">キャンセル</button>
        </div>
        <div class="success-message" id="recentCommitsCountSuccessMessage">✓ 表示件数を変更しました</div>
        <div class="button-container" id="toastDurationButtonContainer">
          <button class="btn btn-save" onclick="saveToastDuration()">保存</button>
          <button class="btn btn-cancel" onclick="cancelToastDuration()">キャンセル</button>
        </div>
        <div class="success-message" id="toastDurationSuccessMessage">✓ トースト表示時間を変更しました</div>
        <div class="button-container" id="statusChartModeButtonContainer">
          <button class="btn btn-save" onclick="saveStatusChartMode()">保存</button>
          <button class="btn btn-cancel" onclick="cancelStatusChartMode()">キャンセル</button>
        </div>
        <div class="success-message" id="statusChartModeSuccessMessage">✓ 月別コミット量チャートの表示モードを変更しました</div>
        <div class="button-container" id="statusChartSortOrderButtonContainer">
          <button class="btn btn-save" onclick="saveStatusChartSortOrder()">保存</button>
          <button class="btn btn-cancel" onclick="cancelStatusChartSortOrder()">キャンセル</button>
        </div>
        <div class="success-message" id="statusChartSortOrderSuccessMessage">✓ 月別コミット量チャートの並び順を変更しました</div>
        <div class="button-container" id="statusCommitCacheSortModeButtonContainer">
          <button class="btn btn-save" onclick="saveStatusCommitCacheSortMode()">保存</button>
          <button class="btn btn-cancel" onclick="cancelStatusCommitCacheSortMode()">キャンセル</button>
        </div>
        <div class="success-message" id="statusCommitCacheSortModeSuccessMessage">✓ 月別コミットキャッシュ詳細の並び替え設定を変更しました</div>
        <div class="button-container" id="aichatHistoryPreviewModeButtonContainer">
          <button class="btn btn-save" onclick="saveAichatHistoryPreviewMode()">保存</button>
          <button class="btn btn-cancel" onclick="cancelAichatHistoryPreviewMode()">キャンセル</button>
        </div>
      </div>

      <a href="/welcome" class="back-btn">← ホームに戻る</a>
    </div>

    <div class="settings-card danger-zone-card">
      <div class="section" style="margin-bottom: 0;">
        <h2 class="section-title danger-zone-title">Danger Zone</h2>
        <div class="danger-zone-item">
          <div class="danger-zone-text">
            <span class="danger-zone-label">このアプリへの承認を取り消す</span>
            <span class="danger-zone-desc">現在のセッションを破棄し、GitHub OAuth の承認画面からやり直します。次回ログイン時に改めてアプリへの権限付与が求められます。</span>
          </div>
          <button class="btn btn-danger" onclick="confirmRevoke()">承認を取り消す</button>
        </div>
      </div>
    </div>
  </div>

  <style>
    .theme-toggle-switch {
      position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; cursor: pointer;
    }
    .theme-toggle-switch input { opacity: 0; width: 0; height: 0; }
    .theme-toggle-slider {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--input-border); border-radius: 24px; transition: background 0.3s;
    }
    .theme-toggle-slider::before {
      content: ''; position: absolute; width: 18px; height: 18px;
      left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: transform 0.3s;
    }
    .theme-toggle-switch input:checked + .theme-toggle-slider { background: var(--accent-color); }
    .theme-toggle-switch input:checked + .theme-toggle-slider::before { transform: translateX(20px); }
  </style>

  <script>
    ${getThemeToggleScript()}

    let originalTimezone = '${currentTimezone}';
    let originalSessionDuration = '${currentSessionDuration}';
    let originalIdleTimeout = '${currentIdleTimeoutSeconds === null ? '0' : String(currentIdleTimeoutSeconds)}';
    let originalRecentCommitsCount = '${currentRecentCommitsCount}';
    let originalToastDuration = '${currentToastDuration}';
    let originalStatusChartMode = '${currentStatusChartMode}';
    let originalStatusChartSortOrder = '${currentStatusChartSortOrder}';
    let originalStatusCommitCacheSortMode = '${currentStatusCommitCacheSortMode}';
    const expiresAtTimestamp = ${user.expiresAtTimestamp};

    // テーマトグルスイッチの初期化
    (function() {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      var cb = document.getElementById('themeCheckbox');
      var label = document.getElementById('themeLabel');
      if (cb) cb.checked = isDark;
      if (label) label.textContent = isDark ? 'ダーク' : 'ライト';
    })();

    // ER図傾きトグルの初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*er_tilt_enabled=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'off';
      var cb = document.getElementById('erTiltCheckbox');
      var label = document.getElementById('erTiltLabel');
      if (cb) cb.checked = (val === 'on');
      if (label) label.textContent = (val === 'on') ? 'ON' : 'OFF';
    })();

    function onErTiltChange() {
      var cb = document.getElementById('erTiltCheckbox');
      var label = document.getElementById('erTiltLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'er_tilt_enabled=' + (enabled ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
    }

    // ER図JSONグループ・カラーコード含めるトグルの初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*er_json_include_group=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'on';
      var cb = document.getElementById('erJsonIncludeGroupCheckbox');
      var label = document.getElementById('erJsonIncludeGroupLabel');
      if (cb) cb.checked = (val !== 'off');
      if (label) label.textContent = (val !== 'off') ? 'ON' : 'OFF';
    })();

    function onErJsonIncludeGroupChange() {
      var cb = document.getElementById('erJsonIncludeGroupCheckbox');
      var label = document.getElementById('erJsonIncludeGroupLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'er_json_include_group=' + (enabled ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
    }

    // ER図グループ凡例トグルの初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*er_legend_visible=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'on';
      var cb = document.getElementById('erLegendVisibleCheckbox');
      var label = document.getElementById('erLegendVisibleLabel');
      if (cb) cb.checked = (val !== 'off');
      if (label) label.textContent = (val !== 'off') ? 'ON' : 'OFF';
    })();

    function onErLegendVisibleChange() {
      var cb = document.getElementById('erLegendVisibleCheckbox');
      var label = document.getElementById('erLegendVisibleLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'er_legend_visible=' + (enabled ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
    }

    // ER図ヘッダータップ設定の初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*er_header_tap_mode=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'on';
      var cb = document.getElementById('erHeaderTapCheckbox');
      var label = document.getElementById('erHeaderTapLabel');
      var note = document.getElementById('erHeaderTapNoteItem');
      if (cb) cb.checked = (val !== 'off');
      if (label) label.textContent = (val !== 'off') ? 'ON' : 'OFF';
      if (note) note.style.display = 'block';
    })();

    function onErHeaderTapChange() {
      var cb = document.getElementById('erHeaderTapCheckbox');
      var label = document.getElementById('erHeaderTapLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'er_header_tap_mode=' + (enabled ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
    }

    // コミット履歴フィルタ既定値の初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*commit_history_merge_filter=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'no-merge';
      var sel = document.getElementById('commitHistoryMergeFilterSelect');
      if (sel) sel.value = val;
    })();

    function onCommitHistoryMergeFilterChange() {
      var sel = document.getElementById('commitHistoryMergeFilterSelect');
      if (!sel) return;
      document.cookie = 'commit_history_merge_filter=' + encodeURIComponent(sel.value) + '; Path=/; SameSite=Lax; Max-Age=31536000';
    }

    // 検索履歴インクリメントサーチ既定値の初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*history_incr_search=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'off';
      var cb = document.getElementById('historyIncrSearchCheckbox');
      var label = document.getElementById('historyIncrSearchLabel');
      if (cb) cb.checked = (val === 'on');
      if (label) label.textContent = (val === 'on') ? 'ON' : 'OFF';
    })();

    function onHistoryIncrSearchChange() {
      var cb = document.getElementById('historyIncrSearchCheckbox');
      var label = document.getElementById('historyIncrSearchLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'history_incr_search=' + (enabled ? 'on' : 'off') + '; Path=/; SameSite=Lax; Max-Age=31536000';
    }

    // 検索キーワードピッカーのゼロヒット非表示設定の初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*kp_hide_zero_hits=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'off';
      var cb = document.getElementById('kpHideZeroHitsCheckbox');
      var label = document.getElementById('kpHideZeroHitsLabel');
      if (cb) cb.checked = (val === 'on');
      if (label) label.textContent = (val === 'on') ? 'ON' : 'OFF';
    })();

    function onKpHideZeroHitsChange() {
      var cb = document.getElementById('kpHideZeroHitsCheckbox');
      var label = document.getElementById('kpHideZeroHitsLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'kp_hide_zero_hits=' + (enabled ? 'on' : 'off') + '; Path=/; SameSite=Lax; Max-Age=31536000';
    }

    // 検索キーワードカテゴリバッジ件数表示の初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*keyword_badge_count=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'on';
      var cb = document.getElementById('keywordBadgeCountCheckbox');
      var label = document.getElementById('keywordBadgeCountLabel');
      if (cb) cb.checked = (val !== 'off');
      if (label) label.textContent = (val !== 'off') ? 'ON' : 'OFF';
    })();

    function onKeywordBadgeCountChange() {
      var cb = document.getElementById('keywordBadgeCountCheckbox');
      var label = document.getElementById('keywordBadgeCountLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'keyword_badge_count=' + (enabled ? 'on' : 'off') + '; Path=/; SameSite=Lax; Max-Age=31536000';
    }

    // カテゴリグループOFF時に全バッジをOFFにする設定の初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*cg_group_off_clears_badges=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'on';
      var cb = document.getElementById('cgGroupOffClearsBadgesCheckbox');
      var label = document.getElementById('cgGroupOffClearsBadgesLabel');
      if (cb) cb.checked = (val !== 'off');
      if (label) label.textContent = (val !== 'off') ? 'ON' : 'OFF';
    })();

    function onCgGroupOffClearsBadgesChange() {
      var cb = document.getElementById('cgGroupOffClearsBadgesCheckbox');
      var label = document.getElementById('cgGroupOffClearsBadgesLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'cg_group_off_clears_badges=' + (enabled ? 'on' : 'off') + '; Path=/; SameSite=Lax; Max-Age=31536000';
    }

    // 詳細集計パネル外タップで閉じる設定の初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*kw_panel_tap_close=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'on';
      var cb = document.getElementById('kwPanelTapCloseCheckbox');
      var label = document.getElementById('kwPanelTapCloseLabel');
      if (cb) cb.checked = (val !== 'off');
      if (label) label.textContent = (val !== 'off') ? 'ON' : 'OFF';
    })();

    function onKwPanelTapCloseChange() {
      var cb = document.getElementById('kwPanelTapCloseCheckbox');
      var label = document.getElementById('kwPanelTapCloseLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'kw_panel_tap_close=' + (enabled ? 'on' : 'off') + '; Path=/; SameSite=Lax; Max-Age=31536000';
    }

    // キーワード詳細パネル閉時のすべてフォーカス抑制の初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*kw_panel_no_all_focus=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'off';
      var cb = document.getElementById('kwPanelNoAllFocusCheckbox');
      var label = document.getElementById('kwPanelNoAllFocusLabel');
      if (cb) cb.checked = (val === 'on');
      if (label) label.textContent = (val === 'on') ? 'ON' : 'OFF';
    })();

    function onKwPanelNoAllFocusChange() {
      var cb = document.getElementById('kwPanelNoAllFocusCheckbox');
      var label = document.getElementById('kwPanelNoAllFocusLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'kw_panel_no_all_focus=' + (enabled ? 'on' : 'off') + '; Path=/; SameSite=Lax; Max-Age=31536000';
    }

    // AI分類デバッグ表示の初期化
    (function() {
      var m = document.cookie.match('(^|;)\\\\s*keyword_classify_debug=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'off';
      var cb = document.getElementById('classifyDebugCheckbox');
      var label = document.getElementById('classifyDebugLabel');
      if (cb) cb.checked = (val === 'on');
      if (label) label.textContent = (val === 'on') ? 'ON' : 'OFF';
    })();

    function onClassifyDebugChange() {
      var cb = document.getElementById('classifyDebugCheckbox');
      var label = document.getElementById('classifyDebugLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'keyword_classify_debug=' + (enabled ? 'on' : 'off') + '; Path=/; SameSite=Lax; Max-Age=31536000';
    }

    (function() {
      var m = document.cookie.match('(^|;)\\s*aichat_sidebar_tap_close=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'on';
      var cb = document.getElementById('aichatSidebarTapCloseCheckbox');
      var label = document.getElementById('aichatSidebarTapCloseLabel');
      if (cb) cb.checked = (val !== 'off');
      if (label) label.textContent = (val !== 'off') ? 'ON' : 'OFF';
    })();

    function onAichatSidebarTapCloseChange() {
      var cb = document.getElementById('aichatSidebarTapCloseCheckbox');
      var label = document.getElementById('aichatSidebarTapCloseLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'aichat_sidebar_tap_close=' + (enabled ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
    }

    (function() {
      var m = document.cookie.match('(^|;)\\s*aichat_show_lang_mode=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'off';
      var cb = document.getElementById('aichatShowLangModeCheckbox');
      var label = document.getElementById('aichatShowLangModeLabel');
      if (cb) cb.checked = (val === 'on');
      if (label) label.textContent = (val === 'on') ? 'ON' : 'OFF';
    })();

    function onAichatShowLangModeChange() {
      var cb = document.getElementById('aichatShowLangModeCheckbox');
      var label = document.getElementById('aichatShowLangModeLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'aichat_show_lang_mode=' + (enabled ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
    }

    // Cookieへ書き込む前に残り容量を見積もる。ブラウザのCookie上限は仕様上
    // 明示されておらず実装依存だが、多くの主要ブラウザで「1オリジンあたり
    // document.cookie全体でおよそ4000バイト前後」が実用上の下限として広く
    // 知られているため、保守的にこれを基準値として使う。書き込み後の想定
    // document.cookie長がこの基準値を超える場合はCookie書き込みをやめ、
    // localStorageへフォールバックする(呼び出し元が本関数の戻り値で分岐する)。
    var COOKIE_CAPACITY_BUDGET_BYTES = 4000;
    function hasCookieCapacityFor(name, value) {
      try {
        var newEntryLength = (name + '=' + encodeURIComponent(value)).length;
        var currentLength = document.cookie ? document.cookie.length : 0;
        return (currentLength + newEntryLength) < COOKIE_CAPACITY_BUDGET_BYTES;
      } catch (e) {
        return false;
      }
    }

    // Cookieへ書き込めない(容量不足、またはプライベートブラウジング等で
    // 例外が出る)場合はlocalStorageへフォールバックする。サーバー側からは
    // localStorageを読めないため、この場合サーバーが生成する応答(/neko gh
    // pr list等)には設定が反映されない制約が残るが、少なくとも設定自体は
    // 失われずクライアント側には保持される。
    function writeSettingCookieWithFallback(name, value, maxAgeSeconds) {
      if (hasCookieCapacityFor(name, value)) {
        try {
          document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Secure; SameSite=Lax; Max-Age=' + maxAgeSeconds;
          return;
        } catch (e) {
          // Cookie書き込みが例外で失敗した場合もlocalStorageへフォールバックする
        }
      }
      try {
        window.localStorage.setItem(name, value);
      } catch (e) {
        // localStorageも使えない場合は静かに諦める(設定変更自体はUI上には反映済み)
      }
    }

    function readSettingCookieOrLocalStorage(name, fallbackValue) {
      var re = new RegExp('(^|;)\\\\s*' + name + '=([^;]*)');
      var m = document.cookie.match(re);
      if (m) return decodeURIComponent(m[2]);
      try {
        var stored = window.localStorage.getItem(name);
        if (stored !== null) return stored;
      } catch (e) {
        // localStorageが使えない場合はfallbackValueを使う
      }
      return fallbackValue;
    }

    (function() {
      var val = readSettingCookieOrLocalStorage('neko_pr_hide_author', 'on');
      var cb = document.getElementById('nekoPrHideAuthorCheckbox');
      var label = document.getElementById('nekoPrHideAuthorLabel');
      if (cb) cb.checked = (val !== 'off');
      if (label) label.textContent = (val !== 'off') ? 'ON' : 'OFF';
    })();

    function onNekoPrHideAuthorChange() {
      var cb = document.getElementById('nekoPrHideAuthorCheckbox');
      var label = document.getElementById('nekoPrHideAuthorLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      writeSettingCookieWithFallback('neko_pr_hide_author', enabled ? 'on' : 'off', 31536000);
    }

    (function() {
      var m = document.cookie.match('(^|;)\\s*aichat_show_model_name=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'off';
      var cb = document.getElementById('aichatShowModelNameCheckbox');
      var label = document.getElementById('aichatShowModelNameLabel');
      if (cb) cb.checked = (val === 'on');
      if (label) label.textContent = (val === 'on') ? 'ON' : 'OFF';
    })();

    function onAichatShowModelNameChange() {
      var cb = document.getElementById('aichatShowModelNameCheckbox');
      var label = document.getElementById('aichatShowModelNameLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      document.cookie = 'aichat_show_model_name=' + (enabled ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
    }


    function onThemeSettingChange() {
      var cb = document.getElementById('themeCheckbox');
      var label = document.getElementById('themeLabel');
      var newTheme = cb.checked ? 'dark' : 'light';
      label.textContent = cb.checked ? 'ダーク' : 'ライト';
      if (newTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      document.cookie = 'user_theme=' + newTheme + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
      fetch('/api/settings/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: newTheme })
      }).catch(function(){});
    }

    async function onStatusTableAutoDetectChange() {
      var cb = document.getElementById('statusTableAutoDetectCheckbox');
      var label = document.getElementById('statusTableAutoDetectLabel');
      var mode = cb.checked ? 'on' : 'off';
      label.textContent = cb.checked ? 'ON' : 'OFF';
      try {
        const res = await fetch('/api/settings/status-table-autodetect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch (e) {
        alert('/status のテーブル自動検出設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    async function onStatusShowAutoDetectedTablesChange() {
      var cb = document.getElementById('statusShowAutoDetectedTablesCheckbox');
      var label = document.getElementById('statusShowAutoDetectedTablesLabel');
      var mode = cb.checked ? 'on' : 'off';
      label.textContent = cb.checked ? 'ON' : 'OFF';
      try {
        const res = await fetch('/api/settings/status-show-autodetected-tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch (e) {
        alert('/status の自動検出テーブル表示設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    async function onStatusIgnoreUnknownUnclassifiedWarningChange() {
      var cb = document.getElementById('statusIgnoreUnknownUnclassifiedWarningCheckbox');
      var label = document.getElementById('statusIgnoreUnknownUnclassifiedWarningLabel');
      var mode = cb.checked ? 'on' : 'off';
      label.textContent = cb.checked ? 'ON' : 'OFF';
      try {
        const res = await fetch('/api/settings/status-ignore-unknown-unclassified-warning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch (e) {
        alert('/status の未分類警告設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    function updateTimeRemaining() {
      const now = Math.floor(Date.now() / 1000);
      const remaining = expiresAtTimestamp - now;
      const el = document.getElementById('timeRemaining');
      if (remaining <= 0) {
        el.textContent = '期限切れ';
        el.classList.add('time-remaining-warning');
        setTimeout(() => { window.location.href = '/'; }, 3000);
        return;
      }
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;
      el.textContent = hours > 0 ? \`\${hours}時間 \${minutes}分 \${seconds}秒\`
        : minutes > 0 ? \`\${minutes}分 \${seconds}秒\` : \`\${seconds}秒\`;
      if (remaining <= 60) el.classList.add('time-remaining-warning');
      else el.classList.remove('time-remaining-warning');
    }
    updateTimeRemaining();
    setInterval(updateTimeRemaining, 1000);

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('show');
    }

    function toggleTimezoneEdit() {
      const cb = document.getElementById('timezoneCheckbox');
      const sel = document.getElementById('timezoneSelect');
      const item = document.getElementById('timezoneItem');
      if (cb.checked) { sel.disabled = false; item.classList.remove('disabled'); }
      else { sel.disabled = true; item.classList.add('disabled'); sel.value = originalTimezone; document.getElementById('buttonContainer').classList.remove('show'); }
    }
    function toggleSessionDurationEdit() {
      const cb = document.getElementById('sessionDurationCheckbox');
      const sel = document.getElementById('sessionDurationSelect');
      const item = document.getElementById('sessionDurationItem');
      if (cb.checked) { sel.disabled = false; item.classList.remove('disabled'); }
      else { sel.disabled = true; item.classList.add('disabled'); sel.value = originalSessionDuration; document.getElementById('sessionButtonContainer').classList.remove('show'); }
    }
    function onTimezoneChange() {
      const cb = document.getElementById('timezoneCheckbox');
      const sel = document.getElementById('timezoneSelect');
      if (cb.checked && sel.value !== originalTimezone) document.getElementById('buttonContainer').classList.add('show');
      else document.getElementById('buttonContainer').classList.remove('show');
    }
    function onSessionDurationChange() {
      const cb = document.getElementById('sessionDurationCheckbox');
      const sel = document.getElementById('sessionDurationSelect');
      if (cb.checked && sel.value !== originalSessionDuration) document.getElementById('sessionButtonContainer').classList.add('show');
      else document.getElementById('sessionButtonContainer').classList.remove('show');
    }
    async function saveTimezone() {
      const timezone = document.getElementById('timezoneSelect').value;
      const res = await fetch('/api/settings/timezone', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ timezone }) });
      if (res.ok) {
        originalTimezone = timezone;
        document.getElementById('buttonContainer').classList.remove('show');
        const msg = document.getElementById('successMessage');
        msg.classList.add('show');
        document.getElementById('timezoneCheckbox').checked = false;
        document.getElementById('timezoneSelect').disabled = true;
        document.getElementById('timezoneItem').classList.add('disabled');
        setTimeout(() => { msg.classList.remove('show'); window.location.reload(); }, 1500);
      } else { alert('タイムゾーンの変更に失敗しました'); }
    }
    function cancelTimezone() {
      document.getElementById('timezoneSelect').value = originalTimezone;
      document.getElementById('buttonContainer').classList.remove('show');
      document.getElementById('timezoneCheckbox').checked = false;
      document.getElementById('timezoneSelect').disabled = true;
      document.getElementById('timezoneItem').classList.add('disabled');
    }
    async function saveSessionDuration() {
      const sessionDuration = document.getElementById('sessionDurationSelect').value;
      const res = await fetch('/api/settings/session-duration', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ sessionDuration }) });
      if (res.ok) {
        originalSessionDuration = sessionDuration;
        document.getElementById('sessionButtonContainer').classList.remove('show');
        const msg = document.getElementById('sessionSuccessMessage');
        msg.classList.add('show');
        document.getElementById('sessionDurationCheckbox').checked = false;
        document.getElementById('sessionDurationSelect').disabled = true;
        document.getElementById('sessionDurationItem').classList.add('disabled');
        setTimeout(() => { msg.classList.remove('show'); }, 1500);
      } else { alert('セッション有効期限の変更に失敗しました'); }
    }
    function cancelSessionDuration() {
      document.getElementById('sessionDurationSelect').value = originalSessionDuration;
      document.getElementById('sessionButtonContainer').classList.remove('show');
      document.getElementById('sessionDurationCheckbox').checked = false;
      document.getElementById('sessionDurationSelect').disabled = true;
      document.getElementById('sessionDurationItem').classList.add('disabled');
    }
    function toggleIdleTimeoutEdit() {
      var cb = document.getElementById('idleTimeoutCheckbox');
      var sel = document.getElementById('idleTimeoutSelect');
      var item = document.getElementById('idleTimeoutItem');
      if (cb.checked) { sel.disabled = false; item.classList.remove('disabled'); }
      else { sel.disabled = true; item.classList.add('disabled'); sel.value = originalIdleTimeout; document.getElementById('idleTimeoutButtonContainer').style.display = 'none'; }
    }
    function onIdleTimeoutChange() {
      var cb = document.getElementById('idleTimeoutCheckbox');
      var sel = document.getElementById('idleTimeoutSelect');
      if (cb.checked && sel.value !== originalIdleTimeout) document.getElementById('idleTimeoutButtonContainer').style.display = '';
      else document.getElementById('idleTimeoutButtonContainer').style.display = 'none';
    }
    async function saveIdleTimeout() {
      var val = document.getElementById('idleTimeoutSelect').value;
      var idleTimeoutSeconds = parseInt(val, 10) || null;
      var res = await fetch('/api/settings/idle-timeout', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ idleTimeoutSeconds }) });
      if (res.ok) {
        originalIdleTimeout = val;
        document.getElementById('idleTimeoutButtonContainer').style.display = 'none';
        var msg = document.getElementById('idleTimeoutSuccessMessage');
        msg.classList.add('show');
        document.getElementById('idleTimeoutCheckbox').checked = false;
        document.getElementById('idleTimeoutSelect').disabled = true;
        document.getElementById('idleTimeoutItem').classList.add('disabled');
        setTimeout(function() { msg.classList.remove('show'); }, 1500);
      } else { alert('アイドルタイムアウトの変更に失敗しました'); }
    }
    function cancelIdleTimeout() {
      document.getElementById('idleTimeoutSelect').value = originalIdleTimeout;
      document.getElementById('idleTimeoutButtonContainer').style.display = 'none';
      document.getElementById('idleTimeoutCheckbox').checked = false;
      document.getElementById('idleTimeoutSelect').disabled = true;
      document.getElementById('idleTimeoutItem').classList.add('disabled');
    }
    function toggleRecentCommitsCountEdit() {
      const cb = document.getElementById('recentCommitsCountCheckbox');
      const sel = document.getElementById('recentCommitsCountSelect');
      const item = document.getElementById('recentCommitsCountItem');
      if (cb.checked) { sel.disabled = false; item.classList.remove('disabled'); }
      else { sel.disabled = true; item.classList.add('disabled'); sel.value = originalRecentCommitsCount; document.getElementById('recentCommitsCountButtonContainer').classList.remove('show'); }
    }
    function onRecentCommitsCountChange() {
      const cb = document.getElementById('recentCommitsCountCheckbox');
      const sel = document.getElementById('recentCommitsCountSelect');
      if (cb.checked && sel.value !== originalRecentCommitsCount) document.getElementById('recentCommitsCountButtonContainer').classList.add('show');
      else document.getElementById('recentCommitsCountButtonContainer').classList.remove('show');
    }
    async function saveRecentCommitsCount() {
      const count = document.getElementById('recentCommitsCountSelect').value;
      const res = await fetch('/api/settings/recent-commits-count', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ count }) });
      if (res.ok) {
        originalRecentCommitsCount = count;
        document.getElementById('recentCommitsCountButtonContainer').classList.remove('show');
        const msg = document.getElementById('recentCommitsCountSuccessMessage');
        msg.classList.add('show');
        document.getElementById('recentCommitsCountCheckbox').checked = false;
        document.getElementById('recentCommitsCountSelect').disabled = true;
        document.getElementById('recentCommitsCountItem').classList.add('disabled');
        setTimeout(() => { msg.classList.remove('show'); }, 1500);
      } else { alert('表示件数の変更に失敗しました'); }
    }
    function cancelRecentCommitsCount() {
      document.getElementById('recentCommitsCountSelect').value = originalRecentCommitsCount;
      document.getElementById('recentCommitsCountButtonContainer').classList.remove('show');
      document.getElementById('recentCommitsCountCheckbox').checked = false;
      document.getElementById('recentCommitsCountSelect').disabled = true;
      document.getElementById('recentCommitsCountItem').classList.add('disabled');
    }
    function toggleToastDurationEdit() {
      const cb = document.getElementById('toastDurationCheckbox');
      const sel = document.getElementById('toastDurationSelect');
      const item = document.getElementById('toastDurationItem');
      if (cb.checked) { sel.disabled = false; item.classList.remove('disabled'); }
      else { sel.disabled = true; item.classList.add('disabled'); sel.value = originalToastDuration; document.getElementById('toastDurationButtonContainer').classList.remove('show'); }
    }
    function onToastDurationChange() {
      const cb = document.getElementById('toastDurationCheckbox');
      const sel = document.getElementById('toastDurationSelect');
      if (cb.checked && sel.value !== originalToastDuration) document.getElementById('toastDurationButtonContainer').classList.add('show');
      else document.getElementById('toastDurationButtonContainer').classList.remove('show');
    }
    async function saveToastDuration() {
      const duration = document.getElementById('toastDurationSelect').value;
      const res = await fetch('/api/settings/toast-duration', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ duration }) });
      if (res.ok) {
        originalToastDuration = duration;
        document.getElementById('toastDurationButtonContainer').classList.remove('show');
        const msg = document.getElementById('toastDurationSuccessMessage');
        msg.classList.add('show');
        document.getElementById('toastDurationCheckbox').checked = false;
        document.getElementById('toastDurationSelect').disabled = true;
        document.getElementById('toastDurationItem').classList.add('disabled');
        setTimeout(() => { msg.classList.remove('show'); }, 1500);
      } else { alert('トースト表示時間の変更に失敗しました'); }
    }
    function cancelToastDuration() {
      document.getElementById('toastDurationSelect').value = originalToastDuration;
      document.getElementById('toastDurationButtonContainer').classList.remove('show');
      document.getElementById('toastDurationCheckbox').checked = false;
      document.getElementById('toastDurationSelect').disabled = true;
      document.getElementById('toastDurationItem').classList.add('disabled');
    }
    function toggleStatusChartModeEdit() {
      const cb = document.getElementById('statusChartModeCheckbox');
      const sel = document.getElementById('statusChartModeSelect');
      const item = document.getElementById('statusChartModeItem');
      if (cb.checked) { sel.disabled = false; item.classList.remove('disabled'); }
      else {
        sel.disabled = true;
        item.classList.add('disabled');
        sel.value = originalStatusChartMode;
        document.getElementById('statusChartModeButtonContainer').classList.remove('show');
      }
    }
    function onStatusChartModeChange() {
      const cb = document.getElementById('statusChartModeCheckbox');
      const sel = document.getElementById('statusChartModeSelect');
      if (cb.checked && sel.value !== originalStatusChartMode) {
        document.getElementById('statusChartModeButtonContainer').classList.add('show');
      } else {
        document.getElementById('statusChartModeButtonContainer').classList.remove('show');
      }
    }
    async function saveStatusChartMode() {
      const mode = document.getElementById('statusChartModeSelect').value;
      const res = await fetch('/api/settings/status-chart-mode', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'include',
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        originalStatusChartMode = mode;
        document.getElementById('statusChartModeButtonContainer').classList.remove('show');
        const msg = document.getElementById('statusChartModeSuccessMessage');
        msg.classList.add('show');
        document.getElementById('statusChartModeCheckbox').checked = false;
        document.getElementById('statusChartModeSelect').disabled = true;
        document.getElementById('statusChartModeItem').classList.add('disabled');
        setTimeout(() => { msg.classList.remove('show'); }, 1500);
      } else {
        alert('月別コミット量チャートの表示モード変更に失敗しました');
      }
    }
    function cancelStatusChartMode() {
      document.getElementById('statusChartModeSelect').value = originalStatusChartMode;
      document.getElementById('statusChartModeButtonContainer').classList.remove('show');
      document.getElementById('statusChartModeCheckbox').checked = false;
      document.getElementById('statusChartModeSelect').disabled = true;
      document.getElementById('statusChartModeItem').classList.add('disabled');
    }
    function toggleStatusChartSortOrderEdit() {
      const cb = document.getElementById('statusChartSortOrderCheckbox');
      const sel = document.getElementById('statusChartSortOrderSelect');
      const item = document.getElementById('statusChartSortOrderItem');
      if (cb.checked) { sel.disabled = false; item.classList.remove('disabled'); }
      else {
        sel.disabled = true;
        item.classList.add('disabled');
        sel.value = originalStatusChartSortOrder;
        document.getElementById('statusChartSortOrderButtonContainer').classList.remove('show');
      }
    }
    function onStatusChartSortOrderChange() {
      const cb = document.getElementById('statusChartSortOrderCheckbox');
      const sel = document.getElementById('statusChartSortOrderSelect');
      if (cb.checked && sel.value !== originalStatusChartSortOrder) {
        document.getElementById('statusChartSortOrderButtonContainer').classList.add('show');
      } else {
        document.getElementById('statusChartSortOrderButtonContainer').classList.remove('show');
      }
    }
    async function saveStatusChartSortOrder() {
      const order = document.getElementById('statusChartSortOrderSelect').value;
      const res = await fetch('/api/settings/status-chart-sort-order', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'include',
        body: JSON.stringify({ order })
      });
      if (res.ok) {
        originalStatusChartSortOrder = order;
        document.getElementById('statusChartSortOrderButtonContainer').classList.remove('show');
        const msg = document.getElementById('statusChartSortOrderSuccessMessage');
        msg.classList.add('show');
        document.getElementById('statusChartSortOrderCheckbox').checked = false;
        document.getElementById('statusChartSortOrderSelect').disabled = true;
        document.getElementById('statusChartSortOrderItem').classList.add('disabled');
        setTimeout(() => { msg.classList.remove('show'); }, 1500);
      } else {
        alert('月別コミット量チャートの並び順変更に失敗しました');
      }
    }
    function cancelStatusChartSortOrder() {
      document.getElementById('statusChartSortOrderSelect').value = originalStatusChartSortOrder;
      document.getElementById('statusChartSortOrderButtonContainer').classList.remove('show');
      document.getElementById('statusChartSortOrderCheckbox').checked = false;
      document.getElementById('statusChartSortOrderSelect').disabled = true;
      document.getElementById('statusChartSortOrderItem').classList.add('disabled');
    }
    function toggleStatusCommitCacheSortModeEdit() {
      const cb = document.getElementById('statusCommitCacheSortModeCheckbox');
      const sel = document.getElementById('statusCommitCacheSortModeSelect');
      const item = document.getElementById('statusCommitCacheSortModeItem');
      if (cb.checked) { sel.disabled = false; item.classList.remove('disabled'); }
      else {
        sel.disabled = true;
        item.classList.add('disabled');
        sel.value = originalStatusCommitCacheSortMode;
        document.getElementById('statusCommitCacheSortModeButtonContainer').classList.remove('show');
      }
    }
    function onStatusCommitCacheSortModeChange() {
      const cb = document.getElementById('statusCommitCacheSortModeCheckbox');
      const sel = document.getElementById('statusCommitCacheSortModeSelect');
      if (cb.checked && sel.value !== originalStatusCommitCacheSortMode) {
        document.getElementById('statusCommitCacheSortModeButtonContainer').classList.add('show');
      } else {
        document.getElementById('statusCommitCacheSortModeButtonContainer').classList.remove('show');
      }
    }
    async function saveStatusCommitCacheSortMode() {
      const mode = document.getElementById('statusCommitCacheSortModeSelect').value;
      const res = await fetch('/api/settings/status-commit-cache-sort-mode', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'include',
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        originalStatusCommitCacheSortMode = mode;
        document.getElementById('statusCommitCacheSortModeButtonContainer').classList.remove('show');
        const msg = document.getElementById('statusCommitCacheSortModeSuccessMessage');
        msg.classList.add('show');
        document.getElementById('statusCommitCacheSortModeCheckbox').checked = false;
        document.getElementById('statusCommitCacheSortModeSelect').disabled = true;
        document.getElementById('statusCommitCacheSortModeItem').classList.add('disabled');
        setTimeout(() => { msg.classList.remove('show'); }, 1500);
      } else {
        alert('月別コミットキャッシュ詳細の並び替え設定変更に失敗しました');
      }
    }
    function cancelStatusCommitCacheSortMode() {
      document.getElementById('statusCommitCacheSortModeSelect').value = originalStatusCommitCacheSortMode;
      document.getElementById('statusCommitCacheSortModeButtonContainer').classList.remove('show');
      document.getElementById('statusCommitCacheSortModeCheckbox').checked = false;
      document.getElementById('statusCommitCacheSortModeSelect').disabled = true;
      document.getElementById('statusCommitCacheSortModeItem').classList.add('disabled');
    }
    function confirmRevoke() {
      if (confirm('このアプリへの承認を取り消しますか？\\n現在のセッションが破棄され、次回ログイン時に再度承認が必要になります。')) {
        window.location.href = '/auth/switch';
      }
    }
    async function onSearchLabelModeChange() {
      var sel = document.getElementById('searchLabelModeSelect');
      if (!sel) return;
      var mode = sel.value;
      try {
        var res = await fetch('/api/settings/search-label-mode', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch(e) {
        alert('分類モード設定の変更に失敗しました');
        sel.value = 'uncategorized';
      }
    }

    async function onAichatAutoVectorizeEnabledChange() {
      var cb = document.getElementById('aichatAutoVectorizeEnabledCheckbox');
      var label = document.getElementById('aichatAutoVectorizeEnabledLabel');
      var enabled = cb.checked;
      var mode = enabled ? 'on' : 'off';
      label.textContent = enabled ? 'ON' : 'OFF';
      try {
        var res = await fetch('/api/settings/aichat-auto-vectorize-enabled', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch(e) {
        alert('キーワードの自動ベクタ化設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    async function onAichatPreferMoondreamChange() {
      var cb = document.getElementById('aichatPreferMoondreamCheckbox');
      var label = document.getElementById('aichatPreferMoondreamLabel');
      var enabled = cb.checked;
      var mode = enabled ? 'on' : 'off';
      label.textContent = enabled ? 'ON' : 'OFF';
      try {
        var res = await fetch('/api/settings/aichat-prefer-moondream', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch(e) {
        alert('画像添付時にmoondreamを優先する設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    async function onAnswerGraphHideEmptyRowsChange() {
      var cb = document.getElementById('answerGraphHideEmptyRowsCheckbox');
      var label = document.getElementById('answerGraphHideEmptyRowsLabel');
      var enabled = cb.checked;
      var mode = enabled ? 'on' : 'off';
      label.textContent = enabled ? 'ON' : 'OFF';
      try {
        var res = await fetch('/api/settings/answer-graph-hide-empty-rows', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch(e) {
        alert('answer-graphの空行非表示設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    async function onHeritageTourCountryFilterChange() {
      var cb = document.getElementById('heritageTourCountryFilterCheckbox');
      var label = document.getElementById('heritageTourCountryFilterLabel');
      var enabled = cb.checked;
      var mode = enabled ? 'on' : 'off';
      label.textContent = enabled ? 'ON' : 'OFF';
      try {
        var res = await fetch('/api/settings/heritage-tour-country-filter', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch(e) {
        alert('世界遺産の巡回ルート国別フィルタ設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    async function onAnswerGraphTrailSessionStorageChange() {
      var cb = document.getElementById('answerGraphTrailSessionStorageCheckbox');
      var label = document.getElementById('answerGraphTrailSessionStorageLabel');
      var enabled = cb.checked;
      var mode = enabled ? 'on' : 'off';
      label.textContent = enabled ? 'ON' : 'OFF';
      try {
        var res = await fetch('/api/settings/answer-graph-trail-session-storage', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch(e) {
        alert('answer-graphのパン屑リストのsessionStorage保存設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    async function onWasmModulesViewModeChange() {
      var sel = document.getElementById('wasmModulesViewModeSelect');
      if (!sel) return;
      var mode = sel.value;
      var prev = sel.getAttribute('data-prev') || 'list';
      try {
        var res = await fetch('/api/settings/wasm-modules-view-mode', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
        sel.setAttribute('data-prev', mode);
      } catch(e) {
        alert('WASMモジュール一覧の表示モードの変更に失敗しました');
        sel.value = prev;
      }
    }

    async function onAichatAutoVectorizeModelChange() {
      var sel = document.getElementById('aichatAutoVectorizeModelSelect');
      if (!sel) return;
      var model = sel.value;
      var prev = sel.getAttribute('data-prev') || '@cf/pfnet/plamo-embedding-1b';
      try {
        var res = await fetch('/api/settings/aichat-auto-vectorize-model', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ model })
        });
        if (!res.ok) throw new Error('failed');
        sel.setAttribute('data-prev', model);
      } catch(e) {
        alert('自動ベクタ化に使う埋め込みモデルの変更に失敗しました');
        sel.value = prev;
      }
    }

    async function onEmailConfirmLoginChange() {
      var cb = document.getElementById('emailConfirmLoginCheckbox');
      var label = document.getElementById('emailConfirmLoginLabel');
      var enabled = cb.checked;
      label.textContent = enabled ? 'ON' : 'OFF';
      try {
        var res = await fetch('/api/settings/email-confirm-login', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ enabled: enabled })
        });
        if (!res.ok) throw new Error('failed');
      } catch(e) {
        alert('ログイン確認メールゲート設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    async function onApisSidebarOpenChange() {
      var cb = document.getElementById('apisSidebarOpenCheckbox');
      var label = document.getElementById('apisSidebarOpenLabel');
      var mode = cb.checked ? 'on' : 'off';
      label.textContent = cb.checked ? 'ON' : 'OFF';
      try {
        var res = await fetch('/api/settings/apis-sidebar-open', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch(e) {
        alert('APIページサイドバー設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    async function onApisSidebarAccordionChange() {
      var cb = document.getElementById('apisSidebarAccordionCheckbox');
      var label = document.getElementById('apisSidebarAccordionLabel');
      var mode = cb.checked ? 'on' : 'off';
      label.textContent = cb.checked ? 'ON' : 'OFF';
      try {
        var res = await fetch('/api/settings/apis-sidebar-accordion', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch(e) {
        alert('APIページアコーディオン設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    async function onApisDescModeChange() {
      var cb = document.getElementById('apisDescModeCheckbox');
      var label = document.getElementById('apisDescModeLabel');
      var mode = cb.checked ? 'on' : 'off';
      label.textContent = cb.checked ? 'ON' : 'OFF';
      try {
        var res = await fetch('/api/settings/apis-desc-mode', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch(e) {
        alert('APIページ表示モード設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
      }
    }

    async function onApisNavFlashChange() {
      var cb = document.getElementById('apisNavFlashCheckbox');
      var label = document.getElementById('apisNavFlashLabel');
      var sel = document.getElementById('apisNavFlashCountSelect');
      var mode = cb.checked ? sel.value : 'off';
      label.textContent = cb.checked ? 'ON' : 'OFF';
      sel.disabled = !cb.checked;
      try {
        var res = await fetch('/api/settings/apis-nav-flash', {
          method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'include',
          body: JSON.stringify({ mode })
        });
        if (!res.ok) throw new Error('failed');
      } catch(e) {
        alert('ナビバー点滅設定の変更に失敗しました');
        cb.checked = !cb.checked;
        label.textContent = cb.checked ? 'ON' : 'OFF';
        sel.disabled = !cb.checked;
      }
    }

    var _aichatHistoryPreviewModeOriginal = null;
    (function() {
      var m = document.cookie.match('(^|;)\\s*aichat_history_preview_mode=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'center-modal';
      var select = document.getElementById('aichatHistoryPreviewModeSelect');
      var v = (val === 'center-modal') ? 'center-modal' : 'bottom-panel';
      if (select) select.value = v;
      _aichatHistoryPreviewModeOriginal = v;
    })();

    function onAichatHistoryPreviewModeChange() {
      var select = document.getElementById('aichatHistoryPreviewModeSelect');
      var container = document.getElementById('aichatHistoryPreviewModeButtonContainer');
      if (!select || !container) return;
      if (select.value !== _aichatHistoryPreviewModeOriginal) {
        container.classList.add('show');
      } else {
        container.classList.remove('show');
      }
    }

    function saveAichatHistoryPreviewMode() {
      var select = document.getElementById('aichatHistoryPreviewModeSelect');
      var container = document.getElementById('aichatHistoryPreviewModeButtonContainer');
      var mode = select && select.value === 'center-modal' ? 'center-modal' : 'bottom-panel';
      document.cookie = 'aichat_history_preview_mode=' + mode + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
      _aichatHistoryPreviewModeOriginal = mode;
      if (container) container.classList.remove('show');
      showSettingsToast('✓ プレビュー表示場所を保存しました');
    }

    function cancelAichatHistoryPreviewMode() {
      var select = document.getElementById('aichatHistoryPreviewModeSelect');
      var container = document.getElementById('aichatHistoryPreviewModeButtonContainer');
      if (select) select.value = _aichatHistoryPreviewModeOriginal;
      if (container) container.classList.remove('show');
    }

    var _settingsToastTimer = null;
    function showSettingsToast(msg) {
      var toast = document.getElementById('settingsToast');
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
      if (_settingsToastTimer) clearTimeout(_settingsToastTimer);
      _settingsToastTimer = setTimeout(function() { toast.classList.remove('show'); }, 2500);
    }

    window.addEventListener('click', function(e) {
      const icon = document.querySelector('.user-icon');
      const dd = document.getElementById('dropdownMenu');
      if (!icon.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('show');
    });
  </script>
  <div class="settings-toast" id="settingsToast"></div>
</body>
</html>`;
}
