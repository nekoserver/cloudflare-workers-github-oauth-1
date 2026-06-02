/**
 * AI チャットページのHTML
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export function getAiChatPage(user: {
  name?: string;
  username: string;
  avatar?: string;
  aiChatModel: string;
  aiChatModelConfigured?: boolean;
  fallbackModel?: string;
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const safeModel = escapeHtml(user.aiChatModel);
  const modelShortName = escapeHtml(user.aiChatModel.split('/').pop() ?? user.aiChatModel);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI チャット</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body { height: 100%; overflow: hidden; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary, #f8fafc);
      color: var(--text-primary);
      display: flex;
      flex-direction: column;
    }

    /* ======= ナビバー（全幅・縦幅縮小） ======= */
    .navbar {
      position: sticky; top: 0; z-index: 200;
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 8px var(--navbar-shadow);
      padding: 0 20px;
      height: 44px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    /* サイドバートグル — ナビバー内左端 */
    .sidebar-toggle {
      width: 32px; height: 32px;
      border-radius: 7px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 15px; flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .sidebar-toggle:hover { background: var(--border-color); color: var(--text-primary); }
    .sidebar-toggle.active { background: var(--accent-color, #667eea); color: #fff; border-color: var(--accent-color, #667eea); }

    .navbar-brand {
      font-size: 17px; font-weight: 700;
      color: var(--text-primary); text-decoration: none;
      display: flex; align-items: baseline; gap: 7px;
      white-space: nowrap;
    }
    .navbar-model { font-size: 11px; font-weight: 400; color: var(--text-muted); }

    .navbar-spacer { flex: 1; }
    .search-log-btn {
      background: none; border: 1px solid var(--border-color); border-radius: 7px;
      color: var(--text-muted); cursor: pointer; font-size: 13px; padding: 4px 9px;
      line-height: 1.4; transition: color 0.15s, border-color 0.15s;
    }
    .search-log-btn:hover { color: var(--text-primary); border-color: var(--accent-color, #667eea); }
    .search-hist-btn {
      background: none; border: 1px solid var(--border-color); border-radius: 7px;
      color: var(--text-muted); cursor: pointer; font-size: 13px; padding: 4px 9px;
      line-height: 1.4; transition: color 0.15s, border-color 0.15s;
    }
    .search-hist-btn:hover { color: var(--text-primary); border-color: var(--accent-color, #667eea); }
    .kw-analysis-badge {
      display: inline-block; background: var(--accent-bg, #ede9fe); color: var(--accent-fg, #5b21b6);
      border-radius: 10px; font-size: 11px; padding: 1px 7px; margin: 2px 2px;
      white-space: nowrap; line-height: 1.6;
    }
    .kw-analysis-badges { max-width: 340px; line-height: 1.8; }
    .kw-q-link { cursor: pointer; text-decoration: underline; text-decoration-color: var(--border-color); text-underline-offset: 2px; }
    .kw-q-link:hover { color: var(--accent-color, #667eea); text-decoration-color: var(--accent-color, #667eea); }
    .search-log-overlay {
      position: fixed; inset: 0; z-index: 700; display: none;
      align-items: flex-start; justify-content: center;
      background: rgba(15,23,42,0.52); backdrop-filter: blur(3px);
      padding-top: 56px;
    }
    .search-log-overlay.open { display: flex; }
    .search-log-modal {
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 14px; width: min(720px, 96vw); max-height: calc(100vh - 80px);
      display: flex; flex-direction: column;
      box-shadow: 0 12px 40px rgba(0,0,0,0.25);
    }
    .search-log-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;
    }
    .search-log-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .search-log-close {
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      font-size: 18px; padding: 0 4px; line-height: 1;
    }
    .search-log-close:hover { color: var(--text-primary); }
    .search-log-body { flex: 1; overflow-y: auto; padding: 12px 16px; }
    .search-log-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .search-log-table th {
      font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.05em; padding: 6px 8px; border-bottom: 2px solid var(--border-color);
      text-align: left; white-space: nowrap; background: var(--bg-secondary);
    }
    .search-log-table td {
      padding: 7px 8px; border-bottom: 1px solid var(--border-color);
      color: var(--text-primary); vertical-align: top;
    }
    .search-log-table tr:last-child td { border-bottom: none; }
    .search-log-table tbody tr:hover td { background: var(--bg-secondary); }
    .search-log-kw { font-weight: 600; color: var(--accent-color, #667eea); max-width: 180px; word-break: break-all; }
    .search-log-q { color: var(--text-muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .search-log-count { text-align: center; font-weight: 700; }
    .search-log-date { color: var(--text-muted); white-space: nowrap; font-size: 11px; }
    .search-log-empty { text-align: center; color: var(--text-muted); padding: 40px 0; font-size: 13px; }
    .search-log-loading { text-align: center; color: var(--text-muted); padding: 40px 0; font-size: 13px; }

    .user-menu { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .user-name { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
    .user-icon {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 13px; cursor: pointer;
      transition: transform 0.2s; flex-shrink: 0;
    }
    .user-icon:hover { transform: scale(1.05); }
    .user-menu-container { position: relative; }
    .dropdown-menu {
      display: none; position: absolute; top: 40px; right: 0;
      background: var(--dropdown-bg); border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 1000; overflow: hidden;
    }
    .dropdown-menu.show { display: block; }
    .dropdown-item {
      padding: 11px 18px; color: var(--text-secondary); text-decoration: none;
      display: block; transition: background 0.15s; cursor: pointer;
      border-bottom: 1px solid var(--border-color); font-size: 13px;
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: var(--dropdown-hover); }
    .dropdown-item.logout { color: var(--danger-color); }

    /* ======= レイアウト本体 ======= */
    .body-area {
      flex: 1; display: flex; overflow: hidden; min-height: 0;
    }

    /* ======= 左サイドバー ======= */
    .sidebar {
      width: 0; flex-shrink: 0;
      background: var(--card-bg);
      border-right: 1px solid var(--border-color);
      display: flex; flex-direction: column;
      overflow: hidden;
      transition: width 0.25s ease;
    }
    .sidebar.open { width: 260px; }

    .sidebar-head {
      padding: 10px 12px 8px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;
    }
    .sidebar-search-wrap { position: relative; }
    .sidebar-search {
      width: 100%; padding: 7px 28px 7px 9px;
      border-radius: 6px; border: 1px solid var(--border-color);
      background: var(--bg-secondary); color: var(--text-primary);
      font-size: 12px; font-family: inherit; outline: none;
      transition: border-color 0.15s;
    }
    .sidebar-search:focus { border-color: var(--accent-color, #667eea); }
    .sidebar-search-clear {
      position: absolute; right: 7px; top: 50%; transform: translateY(-50%);
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      font-size: 13px; display: none; padding: 0 2px; line-height: 1;
    }
    .sidebar-search-clear.visible { display: block; }
    .sidebar-status { font-size: 10px; color: var(--text-muted); padding: 5px 12px 3px; flex-shrink: 0; }

    .sidebar-results {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column;
    }
    .sidebar-result-item {
      position: relative; overflow: hidden;
      border-bottom: 1px solid var(--border-color); flex-shrink: 0;
    }
    .result-swipe-inner {
      display: flex; gap: 7px; align-items: flex-start;
      padding: 9px 12px; cursor: pointer;
      background: var(--bg-primary, #f8fafc);
      position: relative; z-index: 1;
      transition: transform 0.2s ease, background 0.12s;
      will-change: transform;
    }
    .result-swipe-inner:hover { background: var(--bg-secondary); }
    .result-num { font-size: 10px; color: var(--text-muted); font-weight: 600; flex-shrink: 0; padding-top: 1px; min-width: 18px; }
    .result-body { min-width: 0; flex: 1; }
    .result-q { font-size: 12px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
    .result-meta { font-size: 10px; color: var(--text-muted); }
    .result-delete-btn {
      position: absolute; right: 0; top: 0; bottom: 0; width: 72px;
      background: #e53e3e; color: #fff; border: none;
      font-size: 12px; font-weight: 700; cursor: pointer; z-index: 0;
      display: flex; align-items: center; justify-content: center;
      opacity: 0;
    }
    .sidebar-result-item.swipe-open .result-delete-btn { opacity: 1; }
    .result-delete-btn:active { background: #c53030; }
    .delete-confirm-overlay {
      position: fixed; inset: 0; z-index: 800; display: none;
      align-items: center; justify-content: center;
      background: rgba(15,23,42,0.52); backdrop-filter: blur(3px);
    }
    .delete-confirm-overlay.open { display: flex; }
    .delete-confirm-box {
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 14px; padding: 24px 22px 20px; width: min(300px, 90vw);
      box-shadow: 0 12px 40px rgba(0,0,0,0.25);
    }
    .delete-confirm-title { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .delete-confirm-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 22px; line-height: 1.55; }
    .delete-confirm-btns { display: flex; gap: 10px; justify-content: flex-end; }
    .delete-confirm-cancel {
      padding: 8px 16px; background: var(--bg-secondary); color: var(--text-primary);
      border: 1px solid var(--border-color); border-radius: 7px; font-size: 13px; cursor: pointer;
    }
    .delete-confirm-ok {
      padding: 8px 16px; background: #e53e3e; color: #fff;
      border: none; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .delete-confirm-ok:hover { background: #c53030; }
    .kw-highlight { background: #fef08a; color: #1a1a1a; border-radius: 2px; padding: 0 1px; }

    /* ======= カレンダーヒートマップ ======= */
    .sidebar-calendar {
      flex-shrink: 0; border-top: 1px solid var(--border-color);
      padding: 10px 10px 12px;
      background: var(--bg-secondary);
    }
    .cal-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 7px;
    }
    .cal-title { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
    .cal-nav { display: flex; gap: 4px; }
    .cal-nav-btn {
      background: none; border: none; color: var(--text-muted); cursor: pointer;
      font-size: 13px; padding: 0 3px; line-height: 1; border-radius: 3px;
    }
    .cal-nav-btn:hover { background: var(--border-color); color: var(--text-primary); }
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .cal-dow {
      font-size: 9px; color: var(--text-muted); text-align: center;
      padding-bottom: 2px; font-weight: 600;
    }
    .cal-cell {
      aspect-ratio: 1; border-radius: 3px;
      background: var(--border-color);
      cursor: default; position: relative;
      transition: transform 0.1s;
    }
    .cal-cell.empty { background: transparent; cursor: default; }
    .cal-cell.has-data { cursor: pointer; }
    .cal-cell.has-data:hover { transform: scale(1.15); z-index: 1; }
    .cal-cell.selected-day { outline: 2px solid var(--accent-color, #667eea); outline-offset: 1px; }
    /* ヒートマップ強度 */
    .cal-cell[data-lvl="1"] { background: rgba(102,126,234,0.25); }
    .cal-cell[data-lvl="2"] { background: rgba(102,126,234,0.45); }
    .cal-cell[data-lvl="3"] { background: rgba(102,126,234,0.65); }
    .cal-cell[data-lvl="4"] { background: rgba(102,126,234,0.85); }
    [data-theme="dark"] .cal-cell[data-lvl="1"] { background: rgba(127,156,245,0.25); }
    [data-theme="dark"] .cal-cell[data-lvl="2"] { background: rgba(127,156,245,0.45); }
    [data-theme="dark"] .cal-cell[data-lvl="3"] { background: rgba(127,156,245,0.65); }
    [data-theme="dark"] .cal-cell[data-lvl="4"] { background: rgba(127,156,245,0.85); }
    .cal-cell-tip {
      display: none; position: absolute; bottom: calc(100% + 4px); left: 50%;
      transform: translateX(-50%); background: var(--dropdown-bg);
      border: 1px solid var(--border-color); border-radius: 4px;
      font-size: 10px; color: var(--text-primary); padding: 3px 6px;
      white-space: nowrap; z-index: 10; pointer-events: none;
    }
    .cal-cell:hover .cal-cell-tip { display: block; }

    /* ======= 結果詳細パネル（全幅・下） ======= */
    .results-panel {
      position: fixed; bottom: 0; left: 0; right: 0; height: 42%;
      background: var(--card-bg); border-top: 2px solid var(--accent-color, #667eea);
      z-index: 400; display: flex; flex-direction: column;
      transform: translateY(100%); transition: transform 0.3s ease;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
    }
    .results-panel.open { transform: translateY(0); }
    .results-panel-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 16px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;
    }
    .results-panel-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .results-panel-close {
      background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 18px; padding: 0 4px; line-height: 1;
    }
    .results-panel-close:hover { color: var(--text-primary); }
    .results-panel-to-modal {
      background: none; border: 1px solid var(--border-color); border-radius: 6px;
      color: var(--text-muted); cursor: pointer; font-size: 11px; padding: 3px 8px;
      margin-right: 6px; line-height: 1.4;
    }
    .results-panel-to-modal:hover { color: var(--text-primary); border-color: var(--accent-color, #667eea); }
    .results-panel-body {
      flex: 1; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    }
    .results-panel-col { padding: 12px 16px; overflow-y: auto; }
    .results-panel-col + .results-panel-col { border-left: 1px solid var(--border-color); }
    .results-col-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
    .results-col-text { font-size: 13px; color: var(--text-primary); line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
    .results-panel-footer {
      flex-shrink: 0; padding: 6px 16px; border-top: 1px solid var(--border-color);
      display: flex; align-items: center; justify-content: space-between;
      font-size: 11px; color: var(--text-muted);
    }
    .results-panel-link { font-size: 11px; color: var(--accent-color, #667eea); text-decoration: none; }
    .results-panel-link:hover { text-decoration: underline; }

    /* ======= 結果詳細モーダル（中央） ======= */
    .history-modal-backdrop {
      position: fixed; inset: 0; z-index: 750; display: none;
      align-items: center; justify-content: center; padding: 28px 16px;
      background: rgba(15, 23, 42, 0.48); backdrop-filter: blur(4px);
    }
    .history-modal-backdrop.open { display: flex; }
    .history-modal {
      width: min(720px, 100%); max-height: min(86vh, 760px);
      background: var(--bg-primary, #f8fafc); border: 1px solid var(--border-color);
      border-radius: 16px; box-shadow: 0 24px 80px rgba(0,0,0,0.28);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .history-modal-head {
      flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between;
      padding: 12px 16px; background: var(--card-bg); border-bottom: 1px solid var(--border-color);
    }
    .history-modal-head-left { display: flex; flex-direction: column; gap: 3px; }
    .history-modal-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .history-modal-date { font-size: 11px; color: var(--text-muted); }
    .history-modal-date-link {
      font-size: 11px; color: var(--accent-color, #667eea); cursor: pointer;
      background: none; border: none; padding: 0; font-family: inherit;
      text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 2px;
    }
    .history-modal-date-link:hover { opacity: 0.75; }
    .history-modal-close {
      width: 30px; height: 30px; border: none; border-radius: 8px;
      background: transparent; color: var(--text-muted); cursor: pointer; font-size: 18px; line-height: 1;
    }
    .history-modal-close:hover { background: var(--bg-secondary); color: var(--text-primary); }
    .history-modal-chat {
      flex: 1; min-height: 0; overflow-y: auto; padding: 18px 18px 20px;
      display: flex; flex-direction: column; gap: 14px;
    }
    .history-modal .chat-bubble { max-width: 88%; }
    .history-modal .chat-bubble.user {
      align-self: flex-start; margin-left: 0;
      border-bottom-right-radius: 12px; border-bottom-left-radius: 3px;
    }
    .history-modal .chat-bubble.assistant {
      align-self: flex-end;
      border-bottom-left-radius: 12px; border-bottom-right-radius: 3px;
    }
    .history-modal-foot {
      flex-shrink: 0; padding: 9px 16px; border-top: 1px solid var(--border-color);
      background: var(--card-bg); display: flex; align-items: center; justify-content: space-between;
      gap: 12px; font-size: 11px; color: var(--text-muted);
    }
    .history-modal-link { font-size: 11px; color: var(--accent-color, #667eea); text-decoration: none; white-space: nowrap; }
    .history-modal-link:hover { text-decoration: underline; }

    /* ======= Markdownプレビュー ======= */
    .results-col-text.preview-area { white-space: normal; }
    .chat-bubble.assistant.preview-area { white-space: normal; }
    .preview-area h1 { font-size: 1.4em; font-weight: 700; margin: 12px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
    .preview-area h2 { font-size: 1.2em; font-weight: 600; margin: 10px 0 6px; padding-bottom: 3px; border-bottom: 1px solid var(--border-color); }
    .preview-area h3 { font-size: 1.1em; font-weight: 600; margin: 8px 0 4px; }
    .preview-area h4, .preview-area h5, .preview-area h6 { font-size: 1em; font-weight: 600; margin: 6px 0 4px; }
    .preview-area p { margin: 0 0 10px; }
    .preview-area ul, .preview-area ol { margin: 0 0 10px; padding-left: 1.5em; }
    .preview-area li { margin: 2px 0; }
    .preview-area code { background: var(--bg-secondary); padding: 1px 5px; border-radius: 3px; font-size: 0.88em; font-family: ui-monospace, monospace; }
    .preview-area pre { background: var(--bg-secondary); padding: 10px 12px; border-radius: 6px; overflow-x: auto; margin: 0 0 10px; }
    .preview-area pre code { background: none; padding: 0; font-size: 0.85em; }
    .preview-area blockquote { border-left: 3px solid var(--border-color); margin: 0 0 10px; padding: 4px 0 4px 12px; color: var(--text-muted); }
    .preview-area table { border-collapse: collapse; width: 100%; margin: 0 0 10px; font-size: 12px; }
    .preview-area th, .preview-area td { border: 1px solid var(--border-color); padding: 4px 8px; }
    .preview-area th { background: var(--bg-secondary); font-weight: 600; }
    .preview-area hr { border: none; border-top: 1px solid var(--border-color); margin: 12px 0; }
    .preview-area a { color: var(--accent-color, #667eea); }
    .preview-area img { max-width: 100%; }
    .preview-area input[type="checkbox"] { margin-right: 4px; }

    /* ======= チャット本体 ======= */
    .chat-wrapper {
      flex: 1; display: flex; flex-direction: column;
      max-width: 640px; width: 100%; margin: 0 auto;
      padding: 12px 16px 0; overflow: hidden; min-height: 0;
    }
    .chat-log {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-bottom: 14px;
    }
    .chat-bubble {
      max-width: 85%; padding: 10px 14px; border-radius: 12px;
      font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;
    }
    .chat-bubble.user {
      align-self: flex-end; background: var(--accent-color, #667eea); color: #fff; border-bottom-right-radius: 3px;
    }
    .chat-bubble.assistant {
      align-self: flex-start; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-primary); border-bottom-left-radius: 3px;
    }
    .chat-bubble.error {
      align-self: flex-start; background: rgba(207,34,46,0.08); border: 1px solid rgba(207,34,46,0.3); color: #cf222e;
    }
    [data-theme="dark"] .chat-bubble.error {
      background: rgba(252,129,129,0.12); border-color: rgba(252,129,129,0.4); color: #fc8181;
    }
    .chat-bubble.thinking {
      align-self: flex-start; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-muted); font-style: italic;
    }
    .chat-share-row { align-self: flex-start; margin-top: -6px; }
    .chat-share-btn {
      background: none; border: 1px solid var(--border-color); border-radius: 6px;
      padding: 3px 9px; font-size: 11px; color: var(--text-muted); cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px; transition: background 0.15s, color 0.15s;
    }
    .chat-share-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
    .chat-share-btn.copied { color: var(--success-color, #48bb78); border-color: var(--success-color, #48bb78); }
    .chat-form-area {
      flex-shrink: 0; background: var(--bg-primary, #f8fafc); padding: 10px 0 18px; border-top: 1px solid var(--border-color);
    }
    .chat-form { display: flex; gap: 8px; align-items: flex-end; }
    .chat-input {
      flex: 1; padding: 9px 13px; border-radius: 8px; border: 1px solid var(--border-color);
      background: var(--card-bg); color: var(--text-primary); font-size: 14px; resize: none;
      min-height: 40px; max-height: 160px; overflow-y: auto; font-family: inherit; line-height: 1.5;
    }
    .chat-input:focus { outline: none; border-color: var(--accent-color, #667eea); }
    .chat-send-btn {
      padding: 9px 16px; border-radius: 8px; border: none;
      background: var(--accent-color, #667eea); color: #fff; font-size: 14px; font-weight: 600;
      cursor: pointer; white-space: nowrap; transition: opacity 0.15s; height: 40px;
    }
    .chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .chat-send-btn:not(:disabled):hover { opacity: 0.85; }
  </style>
</head>
<body>
  <!-- ナビバー -->
  <nav class="navbar">
    <button class="sidebar-toggle" id="sidebarToggle" title="履歴検索">☰</button>
    <a href="/welcome" class="navbar-brand">🤖 AI チャット<span class="navbar-model">${modelShortName}</span></a>
    <div class="navbar-spacer"></div>
    <div class="user-menu">
      <button class="search-hist-btn" id="searchImpressionsBtn" title="検索露出ログ">📋 露出ログ</button>
      <button class="search-hist-btn" id="searchKwAnalysisBtn" title="質問×キーワード分析">📊 質問分析</button>
      <button class="search-hist-btn" id="searchHistoryBtn" title="検索明細履歴">🗂 検索明細</button>
      <button class="search-log-btn" id="searchLogBtn" title="検索履歴">📋 検索履歴</button>
      ${getThemeToggleHTML()}
      <span class="user-name">${displayName}</span>
      <div class="user-menu-container">
        <div class="user-icon" id="userIcon">${initials}</div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/function-changelog" class="dropdown-item">🔖 関数辞典</a>
          <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
          <a href="/auth/switch" class="dropdown-item">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <!-- ボディエリア（サイドバー + チャット） -->
  <div class="body-area">
    <!-- 左サイドバー -->
    <div class="sidebar" id="sidebar">
      <div class="sidebar-head">
        <div class="sidebar-search-wrap">
          <input class="sidebar-search" id="sidebarSearch" type="search" placeholder="履歴を検索..." autocomplete="off">
          <button class="sidebar-search-clear" id="sidebarClear" tabindex="-1">✕</button>
        </div>
      </div>
      <div class="sidebar-status" id="sidebarStatus"></div>
      <div class="sidebar-results" id="sidebarResults"></div>

      <!-- カレンダーヒートマップ -->
      <div class="sidebar-calendar" id="sidebarCalendar">
        <div class="cal-head">
          <span class="cal-title" id="calTitle"></span>
          <div class="cal-nav">
            <button class="cal-nav-btn" id="calPrev" title="前月">‹</button>
            <button class="cal-nav-btn" id="calNext" title="翌月">›</button>
          </div>
        </div>
        <div class="cal-grid" id="calGrid"></div>
      </div>
    </div>

    <!-- チャット本体 -->
    <div class="chat-wrapper">
      <div class="chat-log" id="chatLog"></div>
      <div class="chat-form-area">
        <form class="chat-form" id="chatForm">
          <textarea class="chat-input" id="chatInput" placeholder="メッセージを入力... (Shift+Enter で改行)" rows="1"></textarea>
          <button type="submit" class="chat-send-btn" id="chatSendBtn">送信</button>
        </form>
      </div>
    </div>
  </div>

  <!-- 詳細パネル（全幅・下） -->
  <div class="results-panel" id="resultsPanel">
    <div class="results-panel-head">
      <span class="results-panel-title" id="resultsPanelTitle">詳細</span>
      <div style="display:flex;align-items:center;gap:4px;">
        <button class="results-panel-to-modal" id="resultsPanelToModal">モーダル表示</button>
        <button class="results-panel-close" id="resultsPanelClose">✕</button>
      </div>
    </div>
    <div class="results-panel-body">
      <div class="results-panel-col">
        <div class="results-col-label">質問</div>
        <div class="results-col-text" id="resultsPanelQ"></div>
      </div>
      <div class="results-panel-col">
        <div class="results-col-label">回答</div>
        <div class="results-col-text preview-area" id="resultsPanelA"></div>
      </div>
    </div>
    <div class="results-panel-footer">
      <span id="resultsPanelMeta"></span>
      <a class="results-panel-link" id="resultsPanelShareLink" href="#" target="_blank">🔗 共有ページを開く</a>
    </div>
  </div>

  <div class="search-log-overlay" id="searchImpressionsOverlay" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true">
      <div class="search-log-head">
        <span class="search-log-title">検索露出ログ（最新30件）</span>
        <button class="search-log-close" id="searchImpressionsClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="searchImpressionsBody">
        <div class="search-log-loading">読み込み中...</div>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="searchKwAnalysisOverlay" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true">
      <div class="search-log-head">
        <span class="search-log-title">質問×キーワード分析（検索明細より）</span>
        <button class="search-log-close" id="searchKwAnalysisClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="searchKwAnalysisBody">
        <div class="search-log-loading">読み込み中...</div>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="searchHistoryOverlay" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true">
      <div class="search-log-head">
        <span class="search-log-title">検索明細履歴（最新30件）</span>
        <button class="search-log-close" id="searchHistoryClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="searchHistoryBody">
        <div class="search-log-loading">読み込み中...</div>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="searchLogOverlay" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true">
      <div class="search-log-head">
        <span class="search-log-title">検索キーワード履歴（最新30件）</span>
        <button class="search-log-close" id="searchLogClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="searchLogBody">
        <div class="search-log-loading">読み込み中...</div>
      </div>
    </div>
  </div>

  <div class="delete-confirm-overlay" id="deleteConfirmOverlay">
    <div class="delete-confirm-box">
      <div class="delete-confirm-title">過去ログを削除しますか？</div>
      <div class="delete-confirm-desc">この操作は取り消せません。</div>
      <div class="delete-confirm-btns">
        <button class="delete-confirm-cancel" id="deleteConfirmCancel">キャンセル</button>
        <button class="delete-confirm-ok" id="deleteConfirmOk">削除する</button>
      </div>
    </div>
  </div>

  <div class="history-modal-backdrop" id="historyModalBackdrop" aria-hidden="true">
    <div class="history-modal" role="dialog" aria-modal="true" aria-labelledby="historyModalTitle">
      <div class="history-modal-head">
        <div class="history-modal-head-left">
          <span class="history-modal-title" id="historyModalTitle">AIチャットの詳細プレビュー</span>
          <span class="history-modal-date"><button class="history-modal-date-link" id="historyModalDateLink"></button><span id="historyModalTime"></span></span>
        </div>
        <button class="history-modal-close" id="historyModalClose" aria-label="閉じる">✕</button>
      </div>
      <div class="history-modal-chat" id="historyModalChat"></div>
      <div class="history-modal-foot">
        <span id="historyModalMeta"></span>
        <a class="history-modal-link" id="historyModalShareLink" href="#" target="_blank">🔗 共有ページを開く</a>
      </div>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}

    // ===== ドロップダウン =====
    var userIcon = document.getElementById('userIcon');
    var dropdownMenu = document.getElementById('dropdownMenu');
    userIcon.addEventListener('click', function(e) { e.stopPropagation(); dropdownMenu.classList.toggle('show'); });
    document.addEventListener('click', function() { dropdownMenu.classList.remove('show'); });

    // ===== 検索露出ログモーダル =====
    var searchImpressionsOverlay = document.getElementById('searchImpressionsOverlay');
    var searchImpressionsBtn = document.getElementById('searchImpressionsBtn');
    var searchImpressionsClose = document.getElementById('searchImpressionsClose');
    var searchImpressionsBody = document.getElementById('searchImpressionsBody');

    function openSearchImpressions() {
      searchImpressionsOverlay.classList.add('open');
      searchImpressionsOverlay.setAttribute('aria-hidden', 'false');
      searchImpressionsBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      fetch('/api/aichat/search-impressions', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var items = data.items || [];
          if (items.length === 0) {
            searchImpressionsBody.innerHTML = '<div class="search-log-empty">記録がありません</div>';
            return;
          }
          var sorted = items.slice().sort(function(a, b) { return b.impression_count - a.impression_count; });
          var html = '<table class="search-log-table"><thead><tr>' +
            '<th>露出</th><th>No.</th><th>質問（概要）</th><th>キーワード（選択回数）</th><th>最終検索</th>' +
            '</tr></thead><tbody>';
          sorted.forEach(function(item, idx) {
            var kwSorted = (item.keywords || []).slice().sort(function(a, b) { return b.max_select_count - a.max_select_count; });
            var q = item.question || '';
            var qShort = q.length > 40 ? q.slice(0, 40) + '…' : q || '(削除済み)';
            var badges = kwSorted.map(function(k) {
              return '<span class="kw-analysis-badge">' + escHtml(k.keyword) + '(' + k.max_select_count + ')</span>';
            }).join('');
            var at = item.last_searched_at ? item.last_searched_at.slice(0, 16).replace('T', ' ') : '-';
            var kwNames = JSON.stringify(kwSorted.map(function(k) { return k.keyword; }));
            html += '<tr>';
            html += '<td class="search-log-count">' + item.impression_count + '</td>';
            html += '<td class="search-log-date">' + (idx + 1) + '</td>';
            html += '<td class="search-log-q kw-q-link" data-share-id="' + escHtml(item.share_id) + '" data-keywords="' + escHtml(kwNames) + '" title="' + escHtml(q) + '">' + escHtml(qShort) + '</td>';
            html += '<td class="kw-analysis-badges">' + (badges || '<span style="color:var(--text-muted);font-size:12px">-</span>') + '</td>';
            html += '<td class="search-log-date">' + escHtml(at) + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
          searchImpressionsBody.innerHTML = html;
        })
        .catch(function() { searchImpressionsBody.innerHTML = '<div class="search-log-empty">読み込みエラー</div>'; });
    }

    function closeSearchImpressions() {
      searchImpressionsOverlay.classList.remove('open');
      searchImpressionsOverlay.setAttribute('aria-hidden', 'true');
    }

    searchImpressionsBody.addEventListener('click', function(e) {
      var td = e.target.closest('td[data-share-id]');
      if (!td) return;
      var shareId = td.getAttribute('data-share-id');
      var keywords = [];
      try { keywords = JSON.parse(td.getAttribute('data-keywords') || '[]'); } catch(err) {}
      fetch('/api/aichat/shares/' + encodeURIComponent(shareId), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data || !data.question) return;
          showHistoryModal(data, keywords);
        })
        .catch(function() {});
    });

    searchImpressionsBtn.addEventListener('click', function(e) { e.stopPropagation(); openSearchImpressions(); });
    searchImpressionsClose.addEventListener('click', function() { closeSearchImpressions(); });
    searchImpressionsOverlay.addEventListener('click', function(e) { if (e.target === searchImpressionsOverlay) closeSearchImpressions(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && searchImpressionsOverlay.classList.contains('open')) {
        if (historyModalBackdrop.classList.contains('open')) return;
        closeSearchImpressions();
      }
    });

    // ===== 質問×キーワード分析モーダル =====
    var searchKwAnalysisOverlay = document.getElementById('searchKwAnalysisOverlay');
    var searchKwAnalysisBtn = document.getElementById('searchKwAnalysisBtn');
    var searchKwAnalysisClose = document.getElementById('searchKwAnalysisClose');
    var searchKwAnalysisBody = document.getElementById('searchKwAnalysisBody');

    function openSearchKwAnalysis() {
      searchKwAnalysisOverlay.classList.add('open');
      searchKwAnalysisOverlay.setAttribute('aria-hidden', 'false');
      searchKwAnalysisBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      fetch('/api/aichat/search-keyword-analysis', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var items = data.items || [];
          if (items.length === 0) {
            searchKwAnalysisBody.innerHTML = '<div class="search-log-empty">データがありません</div>';
            return;
          }
          var sorted = items.slice().sort(function(a, b) {
            return (b.keywords || []).length - (a.keywords || []).length;
          });
          var top30 = sorted.slice(0, 30);
          var html = '<table class="search-log-table"><thead><tr>' +
            '<th>総数</th><th>No.</th><th>質問（概要）</th><th>キーワード（最大検索回数）</th>' +
            '</tr></thead><tbody>';
          top30.forEach(function(item, idx) {
            var kwSorted = (item.keywords || []).slice().sort(function(a, b) { return b.max_seq_num - a.max_seq_num; });
            var count = kwSorted.length;
            var q = item.question || '';
            var qShort = q.length > 40 ? q.slice(0, 40) + '…' : q || '(削除済み)';
            var badges = kwSorted.map(function(k) {
              return '<span class="kw-analysis-badge">' + escHtml(k.keyword) + '(' + k.max_seq_num + ')</span>';
            }).join('');
            html += '<tr>';
            html += '<td class="search-log-count">' + count + '</td>';
            html += '<td class="search-log-date">' + (idx + 1) + '</td>';
            var kwNames = JSON.stringify(kwSorted.map(function(k) { return k.keyword; }));
            html += '<td class="search-log-q kw-q-link" data-share-id="' + escHtml(item.share_id) + '" data-keywords="' + escHtml(kwNames) + '" title="' + escHtml(q) + '">' + escHtml(qShort) + '</td>';
            html += '<td class="kw-analysis-badges">' + (badges || '<span style="color:var(--text-muted);font-size:12px">-</span>') + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
          searchKwAnalysisBody.innerHTML = html;
        })
        .catch(function() {
          searchKwAnalysisBody.innerHTML = '<div class="search-log-empty">読み込みエラー</div>';
        });
    }

    function closeSearchKwAnalysis() {
      searchKwAnalysisOverlay.classList.remove('open');
      searchKwAnalysisOverlay.setAttribute('aria-hidden', 'true');
    }

    searchKwAnalysisBody.addEventListener('click', function(e) {
      var td = e.target.closest('td[data-share-id]');
      if (!td) return;
      var shareId = td.getAttribute('data-share-id');
      var keywords = [];
      try { keywords = JSON.parse(td.getAttribute('data-keywords') || '[]'); } catch(err) {}
      fetch('/api/aichat/shares/' + encodeURIComponent(shareId), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data || !data.question) return;
          showHistoryModal(data, keywords);
        })
        .catch(function() {});
    });

    searchKwAnalysisBtn.addEventListener('click', function(e) { e.stopPropagation(); openSearchKwAnalysis(); });
    searchKwAnalysisClose.addEventListener('click', function() { closeSearchKwAnalysis(); });
    searchKwAnalysisOverlay.addEventListener('click', function(e) {
      if (e.target === searchKwAnalysisOverlay) closeSearchKwAnalysis();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && searchKwAnalysisOverlay.classList.contains('open')) {
        if (historyModalBackdrop.classList.contains('open')) return;
        closeSearchKwAnalysis();
      }
    });

    // ===== 検索明細履歴モーダル =====
    var searchHistoryOverlay = document.getElementById('searchHistoryOverlay');
    var searchHistoryBtn = document.getElementById('searchHistoryBtn');
    var searchHistoryClose = document.getElementById('searchHistoryClose');
    var searchHistoryBody = document.getElementById('searchHistoryBody');

    function openSearchHistory() {
      searchHistoryOverlay.classList.add('open');
      searchHistoryOverlay.setAttribute('aria-hidden', 'false');
      searchHistoryBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      fetch('/api/aichat/search-history', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var rows = data.rows || [];
          if (rows.length === 0) {
            searchHistoryBody.innerHTML = '<div class="search-log-empty">検索明細履歴がありません</div>';
            return;
          }
          var html = '<table class="search-log-table"><thead><tr>' +
            '<th>#</th><th>キーワード</th><th>質問（概要）</th><th>seq_num</th><th>検索日時</th>' +
            '</tr></thead><tbody>';
          rows.forEach(function(row, i) {
            var dateStr = row.searched_at ? row.searched_at.slice(0, 16).replace('T', ' ') : '-';
            var rawQ = row.question || '';
            var q = rawQ.length > 40 ? rawQ.slice(0, 40) + '…' : rawQ || '(削除済み)';
            html += '<tr>';
            html += '<td class="search-log-date">' + (i + 1) + '</td>';
            html += '<td class="search-log-kw">' + escHtml(row.keyword) + '</td>';
            html += '<td class="search-log-q" title="' + escHtml(rawQ) + '">' + escHtml(q) + '</td>';
            html += '<td class="search-log-count">' + (row.seq_num || '-') + '</td>';
            html += '<td class="search-log-date">' + escHtml(dateStr) + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
          searchHistoryBody.innerHTML = html;
        })
        .catch(function() {
          searchHistoryBody.innerHTML = '<div class="search-log-empty">読み込みエラー</div>';
        });
    }

    function closeSearchHistory() {
      searchHistoryOverlay.classList.remove('open');
      searchHistoryOverlay.setAttribute('aria-hidden', 'true');
    }

    searchHistoryBtn.addEventListener('click', function(e) { e.stopPropagation(); openSearchHistory(); });
    searchHistoryClose.addEventListener('click', function() { closeSearchHistory(); });
    searchHistoryOverlay.addEventListener('click', function(e) {
      if (e.target === searchHistoryOverlay) closeSearchHistory();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && searchHistoryOverlay.classList.contains('open')) closeSearchHistory();
    });

    // ===== 検索履歴モーダル =====
    var searchLogOverlay = document.getElementById('searchLogOverlay');
    var searchLogBtn = document.getElementById('searchLogBtn');
    var searchLogClose = document.getElementById('searchLogClose');
    var searchLogBody = document.getElementById('searchLogBody');

    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function openSearchLog() {
      searchLogOverlay.classList.add('open');
      searchLogOverlay.setAttribute('aria-hidden', 'false');
      searchLogBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      fetch('/api/aichat/search-log', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var rows = data.rows || [];
          if (rows.length === 0) {
            searchLogBody.innerHTML = '<div class="search-log-empty">検索履歴がありません</div>';
            return;
          }
          var html = '<table class="search-log-table"><thead><tr>' +
            '<th>#</th><th>キーワード</th><th>質問（概要）</th><th>最終検索</th><th>選択回数</th>' +
            '</tr></thead><tbody>';
          rows.forEach(function(row, i) {
            var dateStr = row.last_searched_at ? row.last_searched_at.slice(0, 16).replace('T', ' ') : '-';
            var rawQ = row.question || '';
            var q = rawQ.length > 45 ? rawQ.slice(0, 45) + '…' : rawQ || '(削除済み)';
            html += '<tr>';
            html += '<td class="search-log-date">' + (i + 1) + '</td>';
            html += '<td class="search-log-kw">' + escHtml(row.keyword) + '</td>';
            html += '<td class="search-log-q" title="' + escHtml(rawQ) + '">' + escHtml(q) + '</td>';
            html += '<td class="search-log-date">' + escHtml(dateStr) + '</td>';
            html += '<td class="search-log-count">' + (row.select_count || 0) + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
          searchLogBody.innerHTML = html;
        })
        .catch(function() {
          searchLogBody.innerHTML = '<div class="search-log-empty">読み込みエラー</div>';
        });
    }

    function closeSearchLog() {
      searchLogOverlay.classList.remove('open');
      searchLogOverlay.setAttribute('aria-hidden', 'true');
    }

    searchLogBtn.addEventListener('click', function(e) { e.stopPropagation(); openSearchLog(); });
    searchLogClose.addEventListener('click', function() { closeSearchLog(); });
    searchLogOverlay.addEventListener('click', function(e) {
      if (e.target === searchLogOverlay) closeSearchLog();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && searchLogOverlay.classList.contains('open')) closeSearchLog();
    });

    // ===== サイドバー =====
    var sidebarToggle = document.getElementById('sidebarToggle');
    var sidebar = document.getElementById('sidebar');
    var sidebarSearch = document.getElementById('sidebarSearch');
    var sidebarClear = document.getElementById('sidebarClear');
    var sidebarStatus = document.getElementById('sidebarStatus');
    var sidebarResults = document.getElementById('sidebarResults');
    var sidebarOpen = false;

    function isTapCloseEnabled() {
      var m = document.cookie.match(/(?:^|;\s*)aichat_sidebar_tap_close=([^;]*)/);
      return !m || m[1] !== 'off';
    }

    function closeSidebar() {
      sidebarOpen = false;
      sidebar.classList.remove('open');
      sidebarToggle.classList.remove('active');
    }

    sidebarToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      sidebarOpen = !sidebarOpen;
      sidebar.classList.toggle('open', sidebarOpen);
      sidebarToggle.classList.toggle('active', sidebarOpen);
      if (sidebarOpen) {
        setTimeout(function() { sidebarSearch.focus(); }, 260);
        loadCalendar(calCurrentMonth);
      }
    });

    document.addEventListener('click', function(e) {
      if (sidebarOpen && isTapCloseEnabled() && !sidebar.contains(e.target) && e.target !== sidebarToggle) {
        closeSidebar();
      }
    });

    // ===== キーワード検索 =====
    var searchTimer = null;
    var currentResults = [];
    var selectedIdx = -1;
    var currentMode = 'search'; // 'search' | 'date'
    var currentDateLabel = '';

    sidebarSearch.addEventListener('input', function() {
      var q = sidebarSearch.value.trim();
      sidebarClear.classList.toggle('visible', q.length > 0);
      clearTimeout(searchTimer);
      currentMode = 'search';
      currentDateLabel = '';
      if (!q) { sidebarStatus.textContent = ''; sidebarResults.innerHTML = ''; currentResults = []; return; }
      sidebarStatus.textContent = '検索中...';
      searchTimer = setTimeout(function() { doSearch(q); }, 350);
    });

    sidebarClear.addEventListener('click', function() {
      sidebarSearch.value = '';
      sidebarClear.classList.remove('visible');
      sidebarStatus.textContent = '';
      sidebarResults.innerHTML = '';
      currentResults = [];
      currentMode = 'search';
      currentDateLabel = '';
      clearSelectedDay();
      sidebarSearch.focus();
    });

    function doSearch(q) {
      fetch('/api/aichat/shares/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          currentResults = data.results || [];
          selectedIdx = -1;
          renderSidebarResults();
          sidebarStatus.textContent = currentResults.length > 0 ? currentResults.length + ' 件ヒット' : '一致なし';
          if (currentResults.length > 0) {
            var shareIds = currentResults.map(function(r) { return String(r.id); });
            var resultCount = currentResults.length;
            fetch('/api/aichat/search-impressions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ shareIds: shareIds, resultCount: resultCount })
            }).catch(function() {});
          }
        })
        .catch(function() { sidebarStatus.textContent = '検索エラー'; });
    }

    function doDateLoad(date) {
      sidebarStatus.textContent = '読み込み中...';
      fetch('/api/aichat/shares/by-date?date=' + encodeURIComponent(date), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          currentResults = data.results || [];
          selectedIdx = -1;
          currentMode = 'date';
          currentDateLabel = date;
          renderSidebarResults();
          sidebarStatus.textContent = date + '：' + currentResults.length + ' 件';
        })
        .catch(function() { sidebarStatus.textContent = '読み込みエラー'; });
    }

    // ===== スワイプ削除 =====
    var swipeOpenItem = null;
    var swipeOpenInner = null;
    var pendingDeleteId = null;
    var pendingDeleteItem = null;
    var deleteConfirmOverlay = document.getElementById('deleteConfirmOverlay');
    var deleteConfirmOk = document.getElementById('deleteConfirmOk');
    var deleteConfirmCancel = document.getElementById('deleteConfirmCancel');

    function closeSwipeOpen() {
      if (swipeOpenInner) {
        swipeOpenInner.style.transition = 'transform 0.2s ease';
        swipeOpenInner.style.transform = 'translateX(0)';
      }
      if (swipeOpenItem) swipeOpenItem.classList.remove('swipe-open');
      swipeOpenItem = null; swipeOpenInner = null;
    }

    function showDeleteConfirm(id, item) {
      pendingDeleteId = id; pendingDeleteItem = item;
      deleteConfirmOverlay.classList.add('open');
    }

    function hideDeleteConfirm() {
      deleteConfirmOverlay.classList.remove('open');
      if (pendingDeleteItem) {
        var inner = pendingDeleteItem.querySelector('.result-swipe-inner');
        if (inner) { inner.style.transition = 'transform 0.2s ease'; inner.style.transform = 'translateX(0)'; }
        pendingDeleteItem.classList.remove('swipe-open');
        if (swipeOpenItem === pendingDeleteItem) { swipeOpenItem = null; swipeOpenInner = null; }
      }
      pendingDeleteId = null; pendingDeleteItem = null;
    }

    function animateDeleteItem(item, id) {
      item.style.overflow = 'hidden';
      var h = item.offsetHeight;
      item.style.height = h + 'px';
      item.style.transition = 'opacity 0.25s ease';
      item.style.opacity = '0';
      setTimeout(function() {
        item.style.transition = 'height 0.3s ease, padding 0.3s ease, border 0.3s ease';
        item.style.height = '0';
        item.style.borderBottomWidth = '0';
        setTimeout(function() {
          item.remove();
          currentResults = currentResults.filter(function(r) { return String(r.id) !== String(id); });
          if (selectedIdx >= currentResults.length) selectedIdx = -1;
          var nums = sidebarResults.querySelectorAll('.result-num');
          nums.forEach(function(el, idx) { el.textContent = (idx + 1) + '.'; });
        }, 320);
      }, 260);
    }

    deleteConfirmCancel.addEventListener('click', function(e) { e.stopPropagation(); hideDeleteConfirm(); });
    deleteConfirmOk.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = pendingDeleteId; var item = pendingDeleteItem;
      if (!id || !item) return;
      hideDeleteConfirm();
      fetch('/api/aichat/shares/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' })
        .then(function(res) { if (!res.ok) throw new Error('failed'); animateDeleteItem(item, id); })
        .catch(function() { sidebarStatus.textContent = '削除に失敗しました'; });
    });
    deleteConfirmOverlay.addEventListener('click', function(e) {
      if (e.target === deleteConfirmOverlay) hideDeleteConfirm();
    });

    function addSwipeBehavior(item, inner) {
      var startX = 0, dragging = false, moved = false;
      var THRESHOLD = 50, BTN_W = 72;
      function isOpen() { return swipeOpenItem === item; }
      function onStart(x) { startX = x; dragging = true; moved = false; }
      function onMove(x) {
        if (!dragging) return;
        var dx = x - startX;
        if (Math.abs(dx) < 4) return;
        moved = true;
        var base = isOpen() ? -BTN_W : 0;
        var tx = Math.max(-BTN_W, Math.min(0, base + dx));
        inner.style.transition = 'none';
        inner.style.transform = 'translateX(' + tx + 'px)';
      }
      function onEnd(x) {
        if (!dragging) return;
        dragging = false;
        var dx = x - startX;
        inner.style.transition = 'transform 0.2s ease';
        if (!moved) return;
        if (isOpen()) {
          if (dx > BTN_W / 2) { closeSwipeOpen(); }
          else { inner.style.transform = 'translateX(-' + BTN_W + 'px)'; }
        } else {
          if (-dx > THRESHOLD) {
            if (swipeOpenItem && swipeOpenItem !== item) closeSwipeOpen();
            inner.style.transform = 'translateX(-' + BTN_W + 'px)';
            item.classList.add('swipe-open');
            swipeOpenItem = item; swipeOpenInner = inner;
          } else {
            inner.style.transform = 'translateX(0)';
          }
        }
      }
      item.addEventListener('touchstart', function(e) { onStart(e.touches[0].clientX); }, { passive: true });
      item.addEventListener('touchmove', function(e) { onMove(e.touches[0].clientX); }, { passive: true });
      item.addEventListener('touchend', function(e) { onEnd(e.changedTouches[0].clientX); });
      var mouseDown = false;
      inner.addEventListener('mousedown', function(e) { if (e.button !== 0) return; mouseDown = true; onStart(e.clientX); });
      document.addEventListener('mousemove', function(e) { if (!mouseDown) return; onMove(e.clientX); });
      document.addEventListener('mouseup', function(e) { if (!mouseDown) return; mouseDown = false; onEnd(e.clientX); });
    }

    function renderSidebarResults() {
      closeSwipeOpen();
      sidebarResults.innerHTML = '';
      currentResults.forEach(function(r, i) {
        var item = document.createElement('div');
        item.className = 'sidebar-result-item';

        var delBtn = document.createElement('button');
        delBtn.className = 'result-delete-btn';
        delBtn.textContent = '削除';
        delBtn.addEventListener('click', function(e) { e.stopPropagation(); showDeleteConfirm(r.id, item); });

        var inner = document.createElement('div');
        inner.className = 'result-swipe-inner';

        var num = document.createElement('div');
        num.className = 'result-num';
        num.textContent = (i + 1) + '.';
        var body = document.createElement('div');
        body.className = 'result-body';
        var qEl = document.createElement('div');
        qEl.className = 'result-q';
        qEl.textContent = r.question;
        var meta = document.createElement('div');
        meta.className = 'result-meta';
        meta.textContent = r.created_at.slice(0, 16).replace('T', ' ') + '　' + r.model.split('/').pop();
        body.appendChild(qEl);
        body.appendChild(meta);
        inner.appendChild(num);
        inner.appendChild(body);

        var clickMoved = false;
        inner.addEventListener('mousedown', function() { clickMoved = false; });
        inner.addEventListener('mousemove', function() { clickMoved = true; });
        inner.addEventListener('click', function() {
          if (clickMoved) return;
          if (swipeOpenItem === item) { closeSwipeOpen(); return; }
          showHistoryPreview(r);
        });

        item.appendChild(delBtn);
        item.appendChild(inner);
        addSwipeBehavior(item, inner);
        sidebarResults.appendChild(item);
      });
    }

    // ===== カレンダーヒートマップ =====
    var calCurrentMonth = new Date().toISOString().slice(0, 7);
    var calDayData = {};
    var calSelectedDay = null;

    document.getElementById('calPrev').addEventListener('click', function() {
      var d = new Date(calCurrentMonth + '-01');
      d.setMonth(d.getMonth() - 1);
      calCurrentMonth = d.toISOString().slice(0, 7);
      loadCalendar(calCurrentMonth);
    });
    document.getElementById('calNext').addEventListener('click', function() {
      var d = new Date(calCurrentMonth + '-01');
      d.setMonth(d.getMonth() + 1);
      calCurrentMonth = d.toISOString().slice(0, 7);
      loadCalendar(calCurrentMonth);
    });

    function loadCalendar(month) {
      fetch('/api/aichat/shares/calendar?month=' + encodeURIComponent(month), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          calDayData = {};
          (data.days || []).forEach(function(d) { calDayData[d.date] = d.count; });
          renderCalendar(month);
        })
        .catch(function() {});
    }

    function renderCalendar(month) {
      var titleEl = document.getElementById('calTitle');
      var grid = document.getElementById('calGrid');
      var parts = month.split('-');
      var year = parseInt(parts[0], 10);
      var mon = parseInt(parts[1], 10) - 1;
      titleEl.textContent = year + '年' + (mon + 1) + '月';
      grid.innerHTML = '';

      var dows = ['日','月','火','水','木','金','土'];
      dows.forEach(function(d) {
        var el = document.createElement('div');
        el.className = 'cal-dow';
        el.textContent = d;
        grid.appendChild(el);
      });

      var firstDay = new Date(year, mon, 1).getDay();
      var daysInMonth = new Date(year, mon + 1, 0).getDate();
      var maxCount = Math.max.apply(null, Object.values(calDayData).concat([1]));

      for (var i = 0; i < firstDay; i++) {
        var empty = document.createElement('div');
        empty.className = 'cal-cell empty';
        grid.appendChild(empty);
      }

      for (var day = 1; day <= daysInMonth; day++) {
        var dateStr = month + '-' + String(day).padStart(2, '0');
        var count = calDayData[dateStr] || 0;
        var cell = document.createElement('div');
        cell.className = 'cal-cell' + (count > 0 ? ' has-data' : '') + (calSelectedDay === dateStr ? ' selected-day' : '');
        if (count > 0) {
          var lvl = count >= maxCount * 0.75 ? 4 : count >= maxCount * 0.5 ? 3 : count >= maxCount * 0.25 ? 2 : 1;
          cell.setAttribute('data-lvl', lvl);
          cell.title = day + '日: ' + count + '件';
          var tip = document.createElement('span');
          tip.className = 'cal-cell-tip';
          tip.textContent = day + '日: ' + count + '件';
          cell.appendChild(tip);
          (function(ds) {
            cell.addEventListener('click', function(e) {
              e.stopPropagation();
              calSelectedDay = ds;
              sidebarSearch.value = '';
              sidebarClear.classList.remove('visible');
              renderCalendar(calCurrentMonth);
              doDateLoad(ds);
            });
          })(dateStr);
        } else {
          cell.title = day + '日';
        }
        var label = document.createElement('span');
        label.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text-muted);';
        label.textContent = day;
        cell.style.position = 'relative';
        cell.appendChild(label);
        grid.appendChild(cell);
      }
    }

    function clearSelectedDay() {
      calSelectedDay = null;
      renderCalendar(calCurrentMonth);
    }

    // ===== Markdownパーサー =====
    function mdEsc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function mdInline(text) {
      text = text.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<img src="$2" alt="$1">');
      text = text.replace(/\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      text = text.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
      text = text.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
      text = text.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
      text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
      text = text.replace(/\\n/g, '<br>');
      return text;
    }
    function mdSplitRow(line) {
      return line.replace(/^\\|\\s*/, '').replace(/\\s*\\|$/, '').split(/\\s*\\|\\s*/);
    }
    function mdParseList(lines, start, tag) {
      var items = [];
      var i = start;
      var pat = tag === 'ul' ? /^\\s*[-*+]\\s(.*)/ : /^\\s*\\d+\\.\\s(.*)/;
      while (i < lines.length) {
        var m = lines[i].match(pat);
        if (!m) break;
        var txt = m[1];
        var task = txt.match(/^\\[([ xX])\\]\\s(.*)/);
        if (task) {
          items.push('<li><input type="checkbox"' + (task[1] !== ' ' ? ' checked' : '') + ' disabled> ' + mdInline(task[2]) + '</li>');
        } else {
          items.push('<li>' + mdInline(txt) + '</li>');
        }
        i++;
      }
      return '<' + tag + '>' + items.join('') + '</' + tag + '>';
    }
    function parseMd(src) {
      src = src.replace(/\\r\\n?/g, '\\n');
      var codeBlocks = [];
      src = src.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
        var idx = codeBlocks.length;
        codeBlocks.push('<pre><code' + (lang ? ' class="language-' + lang + '"' : '') + '>' + mdEsc(code.replace(/\\n$/, '')) + '</code></pre>');
        return '\\x00CB' + idx + '\\x00';
      });
      var inlineCodes = [];
      src = src.replace(/\`([^\`]+)\`/g, function(_, code) {
        var idx = inlineCodes.length;
        inlineCodes.push('<code>' + mdEsc(code) + '</code>');
        return '\\x00IC' + idx + '\\x00';
      });
      var lines = src.split('\\n');
      var html = '';
      var i = 0;
      while (i < lines.length) {
        var line = lines[i];
        if (line.trim() === '') { i++; continue; }
        var cbM = line.match(/^\\x00CB(\\d+)\\x00$/);
        if (cbM) { html += codeBlocks[parseInt(cbM[1])]; i++; continue; }
        var hM = line.match(/^(#{1,6})\\s+(.+)$/);
        if (hM) { var lv = hM[1].length; html += '<h' + lv + '>' + mdInline(hM[2]) + '</h' + lv + '>'; i++; continue; }
        if (/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(line)) { html += '<hr>'; i++; continue; }
        if (i + 1 < lines.length && /^\\|/.test(line) && /^[\\|\\s:-]+$/.test(lines[i + 1])) {
          var tbl = '<table><thead><tr>';
          mdSplitRow(line).forEach(function(h) { tbl += '<th>' + mdInline(h.trim()) + '</th>'; });
          tbl += '</tr></thead><tbody>';
          i += 2;
          while (i < lines.length && /^\\|/.test(lines[i])) {
            tbl += '<tr>';
            mdSplitRow(lines[i]).forEach(function(c) { tbl += '<td>' + mdInline(c.trim()) + '</td>'; });
            tbl += '</tr>'; i++;
          }
          tbl += '</tbody></table>'; html += tbl; continue;
        }
        if (/^>\\s?/.test(line)) {
          var bq = [];
          while (i < lines.length && /^>\\s?/.test(lines[i])) { bq.push(lines[i].replace(/^>\\s?/, '')); i++; }
          html += '<blockquote>' + parseMd(bq.join('\\n')) + '</blockquote>'; continue;
        }
        if (/^\\s*[-*+]\\s/.test(line)) {
          html += mdParseList(lines, i, 'ul');
          while (i < lines.length && /^\\s*[-*+]\\s/.test(lines[i])) i++;
          continue;
        }
        if (/^\\s*\\d+\\.\\s/.test(line)) {
          html += mdParseList(lines, i, 'ol');
          while (i < lines.length && /^\\s*\\d+\\.\\s/.test(lines[i])) i++;
          continue;
        }
        var pLines = [];
        while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\\s/.test(lines[i]) && !/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(lines[i]) && !/^>\\s?/.test(lines[i]) && !/^\\|/.test(lines[i]) && !/^\\x00CB/.test(lines[i])) {
          pLines.push(lines[i]); i++;
        }
        if (pLines.length) html += '<p>' + mdInline(pLines.join('\\n')) + '</p>';
      }
      html = html.replace(/\\x00IC(\\d+)\\x00/g, function(_, idx) { return inlineCodes[parseInt(idx)]; });
      return html;
    }

    // ===== 詳細パネル =====
    var resultsPanel = document.getElementById('resultsPanel');
    var resultsPanelQ = document.getElementById('resultsPanelQ');
    var resultsPanelA = document.getElementById('resultsPanelA');
    var resultsPanelMeta = document.getElementById('resultsPanelMeta');
    var resultsPanelShareLink = document.getElementById('resultsPanelShareLink');
    var resultsPanelClose = document.getElementById('resultsPanelClose');
    var historyModalBackdrop = document.getElementById('historyModalBackdrop');
    var historyModalChat = document.getElementById('historyModalChat');
    var historyModalDateLink = document.getElementById('historyModalDateLink');
    var historyModalTime = document.getElementById('historyModalTime');
    var historyModalMeta = document.getElementById('historyModalMeta');
    var historyModalShareLink = document.getElementById('historyModalShareLink');
    var historyModalClose = document.getElementById('historyModalClose');
    var historyModalCurrentId = null;

    function getHistoryPreviewMode() {
      var m = document.cookie.match('(^|;)\\s*aichat_history_preview_mode=([^;]*)');
      var val = m ? decodeURIComponent(m[2]) : 'center-modal';
      return val === 'center-modal' ? 'center-modal' : 'bottom-panel';
    }

    function closeResultsPanel() {
      resultsPanel.classList.remove('open');
    }

    function closeHistoryModal() {
      historyModalBackdrop.classList.remove('open');
      historyModalBackdrop.setAttribute('aria-hidden', 'true');
    }

    function clearHistorySelection() {
      selectedIdx = -1;
      renderSidebarResults();
    }

    function formatHistoryMeta(r) {
      return r.created_at.slice(0, 16).replace('T', ' ') + '　' + r.model + '　👁 ' + (r.access_count || 0);
    }

    function appendHistoryModalBubble(text, role) {
      var el = document.createElement('div');
      if (role === 'assistant') {
        el.className = 'chat-bubble assistant preview-area';
        el.innerHTML = parseMd(text);
      } else {
        el.className = 'chat-bubble user';
        el.textContent = text;
      }
      historyModalChat.appendChild(el);
    }

    function applyKeywordHighlight(el, keyword) {
      if (!keyword) return;
      var kwList = Array.isArray(keyword) ? keyword.filter(Boolean) : [keyword];
      if (kwList.length === 0) return;
      var escaped = kwList.map(function(k) { return k.replace(/[.*+?^$\{}()|[\]\\]/g, '\\$&'); });
      var re = new RegExp(escaped.join('|'), 'gi');
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      var n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function(tn) {
        if (!re.test(tn.nodeValue)) { re.lastIndex = 0; return; }
        re.lastIndex = 0;
        var frag = document.createDocumentFragment();
        var last = 0, m;
        while ((m = re.exec(tn.nodeValue)) !== null) {
          if (m.index > last) frag.appendChild(document.createTextNode(tn.nodeValue.slice(last, m.index)));
          var mark = document.createElement('mark');
          mark.className = 'kw-highlight';
          mark.textContent = m[0];
          frag.appendChild(mark);
          last = re.lastIndex;
        }
        if (last < tn.nodeValue.length) frag.appendChild(document.createTextNode(tn.nodeValue.slice(last)));
        tn.parentNode.replaceChild(frag, tn);
      });
    }

    function showResultsPanel(r, keyword) {
      closeHistoryModal();
      resultsPanelQ.textContent = r.question;
      resultsPanelA.innerHTML = parseMd(r.answer);
      if (keyword) {
        applyKeywordHighlight(resultsPanelQ, keyword);
        applyKeywordHighlight(resultsPanelA, keyword);
      }
      resultsPanelMeta.textContent = formatHistoryMeta(r);
      resultsPanelShareLink.href = '/s/' + r.user_hash + '/' + r.id;
      resultsPanel.classList.add('open');
    }

    function showHistoryModal(r, keyword) {
      closeResultsPanel();
      historyModalChat.innerHTML = '';
      appendHistoryModalBubble(r.question, 'user');
      appendHistoryModalBubble(r.answer, 'assistant');
      if (keyword) applyKeywordHighlight(historyModalChat, keyword);
      historyModalDateLink.textContent = r.created_at.slice(0, 10);
      historyModalTime.textContent = ' ' + r.created_at.slice(11, 16);
      historyModalMeta.textContent = r.model + '　👁 ' + (r.access_count || 0);
      historyModalShareLink.href = '/s/' + r.user_hash + '/' + r.id;
      historyModalCurrentId = r.id;
      historyModalBackdrop.classList.add('open');
      historyModalBackdrop.setAttribute('aria-hidden', 'false');
    }

    function showHistoryPreview(r) {
      var keyword = (currentMode === 'search') ? sidebarSearch.value.trim() : '';
      if (keyword) {
        fetch('/api/aichat/search-log', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: keyword, shareId: String(r.id), resultCount: currentResults.length })
        }).catch(function() {});
      }
      if (getHistoryPreviewMode() === 'center-modal') {
        showHistoryModal(r, keyword);
      } else {
        showResultsPanel(r, keyword);
      }
    }

    historyModalDateLink.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var dateOnly = historyModalDateLink.textContent;
      if (!dateOnly || dateOnly.length < 10) return;
      var monthStr = dateOnly.slice(0, 7);
      closeHistoryModal();
      if (searchKwAnalysisOverlay.classList.contains('open')) closeSearchKwAnalysis();
      clearHistorySelection();
      if (!sidebarOpen) {
        sidebarOpen = true;
        sidebar.classList.add('open');
        sidebarToggle.classList.add('active');
      }
      calCurrentMonth = monthStr;
      calSelectedDay = dateOnly;
      sidebarSearch.value = '';
      sidebarClear.classList.remove('visible');
      loadCalendar(monthStr);
      doDateLoad(dateOnly);
    });

    resultsPanelClose.addEventListener('click', function() {
      closeResultsPanel();
    });
    document.getElementById('resultsPanelToModal').addEventListener('click', function() {
      document.cookie = 'aichat_history_preview_mode=center-modal; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
      closeResultsPanel();
    });
    historyModalClose.addEventListener('click', function() {
      closeHistoryModal();
      clearHistorySelection();
    });
    historyModalBackdrop.addEventListener('click', function(e) {
      if (e.target === historyModalBackdrop) {
        closeHistoryModal();
        clearHistorySelection();
      }
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && historyModalBackdrop.classList.contains('open')) {
        closeHistoryModal();
        clearHistorySelection();
      }
    });

    // ===== チャット =====
    var chatLog = document.getElementById('chatLog');
    var chatForm = document.getElementById('chatForm');
    var chatInput = document.getElementById('chatInput');
    var chatSendBtn = document.getElementById('chatSendBtn');

    chatInput.addEventListener('input', function() {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
    });
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!chatSendBtn.disabled) chatForm.dispatchEvent(new Event('submit'));
      }
    });

    function appendBubble(text, role) {
      var el = document.createElement('div');
      if (role === 'assistant') {
        el.className = 'chat-bubble ' + role + ' preview-area';
        el.innerHTML = parseMd(text);
      } else {
        el.className = 'chat-bubble ' + role;
        el.textContent = text;
      }
      chatLog.appendChild(el);
      chatLog.scrollTop = chatLog.scrollHeight;
      return el;
    }

    function appendShareBtn(question, answer, model) {
      var row = document.createElement('div');
      row.className = 'chat-share-row';
      var btn = document.createElement('button');
      btn.className = 'chat-share-btn';
      btn.innerHTML = '🔗 リンクをコピー';
      btn.onclick = function() {
        fetch('/api/aichat/share', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: question, answer: answer, model: model })
        })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (d.shareUrl) {
              navigator.clipboard.writeText(d.shareUrl).then(function() {
                btn.innerHTML = '✓ コピーしました';
                btn.classList.add('copied');
                setTimeout(function() { btn.innerHTML = '🔗 リンクをコピー'; btn.classList.remove('copied'); }, 2000);
              });
            }
          })
          .catch(function() {});
      };
      row.appendChild(btn);
      chatLog.appendChild(row);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    var lastModel = ${JSON.stringify(safeModel)};

    chatForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var msg = chatInput.value.trim();
      if (!msg) return;
      appendBubble(msg, 'user');
      chatInput.value = '';
      chatInput.style.height = 'auto';
      chatSendBtn.disabled = true;
      var currentMsg = msg;
      var thinking = appendBubble('考え中...', 'thinking');
      fetch('/api/aichat', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          thinking.remove();
          if (data.error) {
            appendBubble('エラー: ' + data.error, 'error');
          } else {
            var responseText = data.response || '(応答なし)';
            appendBubble(responseText, 'assistant');
            appendShareBtn(currentMsg, responseText, data.usedModel || lastModel);
          }
        })
        .catch(function() { thinking.remove(); appendBubble('通信エラーが発生しました', 'error'); })
        .finally(function() { chatSendBtn.disabled = false; chatInput.focus(); });
    });

    chatInput.focus();
  </script>
</body>
</html>`;
}
