/**
 * AI チャットページのHTML
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

const DEFAULT_AICHAT_MODELS: Array<{value: string; label: string}> = [
  { value: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'llama-3.3-70b-instruct-fp8-fast' },
  { value: '@cf/meta/llama-3.1-8b-instruct-fp8', label: 'llama-3.1-8b' },
  { value: '@cf/meta/llama-3.1-70b-instruct', label: 'llama-3.1-70b' },
  { value: '@cf/google/gemma-4-26b-a4b-it', label: 'gemma-4-26b' },
  { value: '@cf/google/gemma-3-12b-it', label: 'gemma-3-12b' },
  { value: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'llama-4-scout-17b' },
];

export function getAiChatPage(user: {
  name?: string;
  username: string;
  avatar?: string;
  aiChatModel: string;
  aiChatModelConfigured?: boolean;
  fallbackModel?: string;
  availableModels?: Array<{value: string; label: string}>;
  modelColors?: Record<string, string>;
}): string {
  const displayName = escapeHtml(user.name || user.username);
  const initials = escapeHtml((user.name || user.username).substring(0, 2).toUpperCase());
  const safeModel = escapeHtml(user.aiChatModel);
  const models = user.availableModels ?? DEFAULT_AICHAT_MODELS;
  const modelList = models.some(m => m.value === user.aiChatModel)
    ? models
    : [{ value: user.aiChatModel, label: user.aiChatModel.split('/').pop() ?? user.aiChatModel }, ...models];
  const modelOptionsHtml = modelList
    .map(m => `<option value="${escapeHtml(m.value)}"${m.value === user.aiChatModel ? ' selected' : ''}>${escapeHtml(m.label)}</option>`)
    .join('');
  const modelColorsJson = JSON.stringify(user.modelColors ?? {});

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
    .navbar-model-select {
      font-size: 11px; font-weight: 400; color: var(--text-muted);
      background: transparent; border: none; outline: none; cursor: pointer;
      padding: 0 2px; max-width: 180px; flex-shrink: 0;
    }
    .navbar-model-select:hover { color: var(--text-primary); }
    .navbar-model-select option { background: var(--card-bg); color: var(--text-primary); }
    .navbar-lang-select {
      font-size: 11px; font-weight: 400; color: var(--text-muted);
      background: transparent; border: 1px solid var(--border-color); border-radius: 5px;
      outline: none; cursor: pointer; padding: 1px 4px; flex-shrink: 0;
    }
    .navbar-lang-select:hover { color: var(--text-primary); }
    .navbar-lang-select option { background: var(--card-bg); color: var(--text-primary); }

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
    .sq-kw-badge {
      display: inline-block; background: var(--bg-secondary); color: var(--text-muted);
      border-radius: 10px; font-size: 11px; padding: 1px 6px; margin: 1px 2px;
      white-space: nowrap; line-height: 1.6; cursor: pointer;
    }
    .sq-kw-badge:hover { background: var(--border-color); color: var(--text-primary); }
    .sq-kw-badge-active { background: var(--accent-bg, #ede9fe); color: var(--accent-fg, #5b21b6); }
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
    .search-log-toggle-btn {
      font-size: 11px; padding: 3px 8px; border-radius: 5px; cursor: pointer;
      border: 1px solid var(--border-color); background: var(--bg-secondary);
      color: var(--text-muted); white-space: nowrap; transition: background 0.15s, color 0.15s;
    }
    .search-log-toggle-btn.active {
      background: var(--accent-color, #667eea); color: #fff; border-color: var(--accent-color, #667eea);
    }
    .impr-date-link {
      font-size: 11px; color: var(--accent-color, #667eea); cursor: pointer;
      background: none; border: none; padding: 0; font-family: inherit;
      text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 2px;
    }
    .impr-date-link:hover { opacity: 0.75; }
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
    .sidebar-status-row { display: flex; align-items: center; padding: 4px 12px; gap: 6px; min-height: 24px; flex-shrink: 0; }
    .sidebar-mode-toggle { display: flex; gap: 2px; flex-shrink: 0; }
    .sidebar-mode-btn {
      font-size: 10px; padding: 1px 7px; border: 1px solid var(--border-color);
      border-radius: 4px; background: none; color: var(--text-muted); cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .sidebar-mode-btn.active { background: var(--accent-color, #667eea); color: #fff; border-color: var(--accent-color, #667eea); }
    .sidebar-kw-modal {
      display: none; position: fixed; left: 260px; top: 44px; bottom: 0; z-index: 200;
      width: 240px; background: var(--card-bg); overflow-y: hidden;
      flex-direction: column;
      border-left: 1px solid var(--border-color);
      box-shadow: 2px 0 8px rgba(0,0,0,0.12);
    }
    .sidebar-kw-modal.open { display: flex; }
    .sidebar-kw-header {
      display: flex; align-items: center; gap: 4px;
      padding: 8px 10px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;
    }
    .sidebar-kw-sort-toggle { display: flex; gap: 2px; flex-shrink: 0; }
    .sidebar-kw-sort-btn {
      font-size: 10px; padding: 1px 6px; border: 1px solid var(--border-color);
      border-radius: 4px; background: none; color: var(--text-muted); cursor: pointer;
      transition: background 0.12s, color 0.12s; white-space: nowrap;
    }
    .sidebar-kw-sort-btn.active { background: var(--accent-color, #667eea); color: #fff; border-color: var(--accent-color, #667eea); }
    .sidebar-kw-item {
      padding: 6px 12px; font-size: 12px; cursor: pointer; display: flex;
      justify-content: space-between; align-items: center;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-primary);
    }
    .sidebar-kw-item:hover { background: var(--bg-secondary); }
    .sidebar-kw-item.selected { background: rgba(102,126,234,0.12); }
    .sidebar-kw-count { font-size: 10px; color: var(--text-muted); flex-shrink: 0; margin-left: 6px; }

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
      border-left: 3px solid transparent;
    }
    .model-color-dot {
      width: 8px; height: 8px; border-radius: 50%; display: inline-block;
      flex-shrink: 0; background: var(--model-dot-color, var(--border-color));
      margin-right: 3px; vertical-align: middle;
    }
    .sidebar-result-item.has-subquery .result-swipe-inner { background: rgba(56, 189, 248, 0.10); }
    .sidebar-result-item.has-subquery .result-swipe-inner:hover { background: rgba(56, 189, 248, 0.18); }
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
    .cal-cell.cal-today { box-shadow: inset 0 0 0 1px var(--accent-color, #667eea); font-weight: 700; }
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
      flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 10px 16px; background: var(--card-bg); border-bottom: 1px solid var(--border-color);
    }
    .history-modal-head-left { display: flex; flex-direction: column; gap: 3px; flex-shrink: 0; }
    .history-modal-head-search {
      display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0;
    }
    .history-modal-search-input {
      flex: 1; min-width: 0; font-size: 12px; padding: 4px 8px;
      border: 1px solid var(--border-color); border-radius: 6px;
      background: var(--bg-primary); color: var(--text-primary);
      outline: none;
    }
    .history-modal-search-input:focus { border-color: var(--accent-color, #667eea); }
    .history-modal-search-btn {
      font-size: 12px; padding: 4px 8px; white-space: nowrap;
      border: 1px solid var(--border-color); border-radius: 6px;
      background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .history-modal-search-btn:hover { background: var(--accent-color, #667eea); color: #fff; border-color: var(--accent-color, #667eea); }
    td.has-subquery { background: rgba(56, 189, 248, 0.12); cursor: pointer; }
    td.has-subquery:hover { background: rgba(56, 189, 248, 0.22); }
    td.has-subquery .impr-q-text { cursor: pointer; }
    .impr-kw-filter-active { cursor: pointer; margin-left: 6px; background: var(--accent-color,#667eea); color: #fff; }
    .subqueries-add-area { padding: 10px 14px; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; }
    .subqueries-add-form { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
    .subqueries-add-msg { font-size: 12px; color: var(--text-muted); }
    .subquery-select-item:hover { background: var(--bg-secondary) !important; }
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
    .chat-bubble-wrap { align-self: flex-start; display: flex; flex-direction: column; gap: 3px; max-width: 85%; }
    .chat-bubble-wrap .chat-bubble.assistant { align-self: auto; max-width: 100%; }
    .bubble-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .bubble-label-fallback { color: var(--color-error, #cf222e); }
    .bubble-fallback-notice { font-size: 12px; color: var(--color-error, #cf222e); margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border-color); opacity: 0.85; }
    .chat-share-row { align-self: flex-start; margin-top: -6px; display: flex; align-items: center; gap: 4px; }
    .chat-share-btn {
      background: none; border: 1px solid var(--border-color); border-radius: 6px;
      padding: 3px 9px; font-size: 11px; color: var(--text-muted); cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px; transition: background 0.15s, color 0.15s;
    }
    .chat-share-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
    .chat-share-btn.copied { color: var(--success-color, #48bb78); border-color: var(--success-color, #48bb78); }
    .chat-share-open-btn {
      background: none; border: 1px solid var(--border-color); border-radius: 6px;
      padding: 3px 7px; font-size: 11px; color: var(--text-muted); cursor: pointer;
      display: inline-flex; align-items: center; text-decoration: none;
      transition: background 0.15s, color 0.15s; line-height: 1;
    }
    .chat-share-open-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
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
    <a href="/welcome" class="navbar-brand">🤖 AI チャット</a>
    <span id="modelColorDot" class="model-color-dot"></span><select id="modelSelect" class="navbar-model-select">${modelOptionsHtml}</select>
    <select id="langModeSelect" class="navbar-lang-select" title="日本語モード">
      <option value="a" selected>🇯🇵 system</option>
      <option value="b">🇯🇵 prefix</option>
      <option value="c">🌐 plain</option>
    </select>
    <div class="navbar-spacer"></div>
    <div class="user-menu">
      <button class="search-hist-btn" id="linkedQuestionsBtn" title="サブクエリを持つ質問一覧">📎 リンク質問</button>
      <button class="search-hist-btn" id="subqueriesBtn" title="サブクエリ一覧">🔗 サブクエリ</button>
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
      <div class="sidebar-status-row">
        <div class="sidebar-status" id="sidebarStatus" style="flex:1;font-size:10px;color:var(--text-muted);"></div>
        <div class="sidebar-mode-toggle" id="sidebarModeToggle" style="display:none;">
          <button class="sidebar-mode-btn" id="sidebarModeNew">新着</button>
          <button class="sidebar-mode-btn" id="sidebarModeKw">キーワード</button>
        </div>
      </div>
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

    <!-- キーワードモーダル（サイドバー右隣に fixed 表示） -->
    <div class="sidebar-kw-modal" id="sidebarKwModal">
      <div class="sidebar-kw-header">
        <span style="font-size:12px;font-weight:600;color:var(--text-secondary);white-space:nowrap;">当月のキーワード</span>
        <span id="sidebarKwCount" style="font-size:10px;color:var(--text-muted);white-space:nowrap;"></span>
        <div style="flex:1;"></div>
        <div class="sidebar-kw-sort-toggle">
          <button class="sidebar-kw-sort-btn active" id="sidebarKwSortCount">回数順</button>
          <button class="sidebar-kw-sort-btn" id="sidebarKwSortAlpha">あいうえお順</button>
        </div>
        <button id="sidebarKwClose" style="background:none;border:none;font-size:14px;cursor:pointer;color:var(--text-muted);padding:2px 4px;flex-shrink:0;">✕</button>
      </div>
      <div id="sidebarKwList" style="overflow-y:auto;flex:1;"></div>
    </div>

    <!-- チャット本体 -->
    <div class="chat-wrapper">
      <div class="chat-log" id="chatLog"></div>
      <div class="chat-form-area">
        <form class="chat-form" id="chatForm">
          <textarea class="chat-input" id="chatInput" placeholder="メッセージを入力... (Ctrl+Enter または Shift+Enter で送信)" rows="1"></textarea>
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
        <button class="search-log-toggle-btn" id="impressionsDateToggleBtn" title="最終検索日を表示/非表示">📅 最終検索</button>
        <button class="search-log-close" id="searchImpressionsClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="searchImpressionsBody">
        <div class="search-log-loading">読み込み中...</div>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="impressionsSubqueryModal" aria-hidden="true" style="z-index:800;">
    <div class="search-log-modal" style="max-width:480px;" role="dialog" aria-modal="true">
      <div class="search-log-head">
        <span class="search-log-title" id="impressionsSubqueryModalTitle">サブクエリリンク</span>
        <button class="search-log-close" id="impressionsSubqueryModalClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="impressionsSubqueryModalBody"></div>
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

  <div class="search-log-overlay" id="linkedQuestionsOverlay" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true">
      <div class="search-log-head">
        <span class="search-log-title">サブクエリを持つ質問一覧</span>
        <button class="search-log-close" id="linkedQuestionsClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="linkedQuestionsBody">
        <div class="search-log-loading">読み込み中...</div>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="subqueriesOverlay" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true">
      <div class="search-log-head">
        <span class="search-log-title">サブクエリ一覧</span>
        <button class="search-log-close" id="subqueriesClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="subqueriesBody">
        <div class="subqueries-add-area">
          <button class="search-hist-btn" id="subqueriesAddBtn">＋ 新規追加</button>
          <div class="subqueries-add-form" id="subqueriesAddForm" style="display:none;">
            <input class="history-modal-search-input" id="subqueriesAddInput" type="text" placeholder="サブクエリを入力..." autocomplete="off" maxlength="500">
            <button class="search-hist-btn" id="subqueriesAddSubmit" style="display:none;">追加</button>
          </div>
          <div class="subqueries-add-msg" id="subqueriesAddMsg"></div>
        </div>
        <div id="subqueriesListBody">
          <div class="search-log-loading">読み込み中...</div>
        </div>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="sqKwQuestionsOverlay" aria-hidden="true" style="z-index:850;">
    <div class="search-log-modal" role="dialog" aria-modal="true">
      <div class="search-log-head">
        <span class="search-log-title" id="sqKwQuestionsTitle">質問一覧</span>
        <button class="search-log-close" id="sqKwQuestionsClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="sqKwQuestionsBody">
        <div class="search-log-loading">読み込み中...</div>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="addSubqueryModal" aria-hidden="true" style="z-index:900;">
    <div class="search-log-modal" role="dialog" aria-modal="true">
      <div class="search-log-head">
        <span class="search-log-title">追加質問を登録する</span>
        <button class="search-log-close" id="addSubqueryClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body">
        <div id="addSubqueryList" style="max-height:260px;overflow-y:auto;margin-bottom:10px;"></div>
        <div style="margin-bottom:6px;">
          <label style="font-size:12px;color:var(--text-secondary);">選択中のサブクエリ</label>
          <input class="history-modal-search-input" id="addSubquerySelected" type="text" readonly placeholder="上の一覧から選択..." style="background:var(--bg-secondary);cursor:default;">
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px;color:var(--text-secondary);">URL</label>
          <input class="history-modal-search-input" id="addSubqueryUrl" type="url" placeholder="https://..." autocomplete="off">
        </div>
        <button class="search-hist-btn" id="addSubquerySubmit">登録する</button>
        <div class="subqueries-add-msg" id="addSubqueryMsg"></div>
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
        <div class="history-modal-head-search">
          <input class="history-modal-search-input" id="historyModalSearchInput" type="search" placeholder="キーワードで検索..." autocomplete="off">
          <button class="history-modal-search-btn" id="historyModalSearchBtn">🔍 検索</button>
        </div>
        <button class="history-modal-close" id="historyModalClose" aria-label="閉じる">✕</button>
      </div>
      <div class="history-modal-chat" id="historyModalChat"></div>
      <div class="history-modal-foot">
        <span id="historyModalMeta"></span>
        <a class="history-modal-link" id="historyModalShareLink" href="#" target="_blank">🔗 共有ページを開く</a>
        <button class="search-hist-btn" id="historyModalAddSubqueryBtn" style="margin-left:auto;">＋ 追加質問を登録する</button>
      </div>
      <div id="historyModalSubqueryLinks" style="padding:6px 14px 8px;font-size:12px;display:none;"></div>
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
    var impressionsDateToggleBtn = document.getElementById('impressionsDateToggleBtn');

    var IMPR_DATE_COOKIE = 'aichat_impressions_show_date';
    function getImpressionsDateVisible() {
      var m = document.cookie.match(/(?:^|;\s*)aichat_impressions_show_date=([^;]*)/);
      return m ? m[1] === 'on' : false;
    }
    function setImpressionsDateVisible(val) {
      document.cookie = IMPR_DATE_COOKIE + '=' + (val ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
    }

    function renderImpressionsTable(items, subqueryMap, keywordFilter) {
      var sqMap = subqueryMap || {};
      var filtered = keywordFilter
        ? items.filter(function(item) {
            return (item.keywords || []).some(function(k) { return k.keyword === keywordFilter; });
          })
        : items;
      if (filtered.length === 0) {
        searchImpressionsBody.innerHTML = '<div class="search-log-empty">' + (keywordFilter ? 'このキーワードを含む記録がありません' : '記録がありません') + '</div>';
        return;
      }
      var showDate = getImpressionsDateVisible();
      var sorted = filtered.slice().sort(function(a, b) {
        return (b.keywords || []).length - (a.keywords || []).length;
      });
      var kwThExtra = keywordFilter
        ? '<span class="kw-analysis-badge impr-kw-filter-active" title="クリックでフィルタをクリア">✕ ' + escHtml(keywordFilter) + '</span>'
        : '';
      var html = '<table class="search-log-table"><thead><tr>' +
        '<th>総数</th><th>No.</th><th>質問（概要）</th><th>キーワード（選択回数）' + kwThExtra + '</th>' +
        (showDate ? '<th>最終検索</th>' : '') +
        '</tr></thead><tbody>';
      sorted.forEach(function(item, idx) {
        var kwSorted = (item.keywords || []).slice().sort(function(a, b) { return b.max_select_count - a.max_select_count; });
        var q = item.question || '';
        var qShort = q.length > 40 ? q.slice(0, 40) + '…' : q || '(削除済み)';
        var badges = kwSorted.map(function(k) {
          return '<span class="kw-analysis-badge" data-keyword="' + escHtml(k.keyword) + '">' + escHtml(k.keyword) + '(' + k.max_select_count + ')</span>';
        }).join('');
        var kwNames = JSON.stringify(kwSorted.map(function(k) { return k.keyword; }));
        var kwCount = kwSorted.length;
        var hasSq = q && sqMap[q] && sqMap[q].length > 0;
        var qTdClass = hasSq ? 'td.search-log-q has-subquery' : 'td.search-log-q kw-q-link';
        var qTdContent = hasSq
          ? '<span class="impr-q-text kw-q-link">' + escHtml(qShort) + '</span>'
          : escHtml(qShort);
        var sqDataAttr = hasSq ? ' data-question="' + escHtml(q) + '"' : '';
        html += '<tr>';
        html += '<td class="search-log-count">' + kwCount + '</td>';
        html += '<td class="search-log-date">' + (idx + 1) + '</td>';
        if (hasSq) {
          html += '<td class="search-log-q has-subquery" data-share-id="' + escHtml(item.share_id) + '" data-keywords="' + escHtml(kwNames) + '" data-question="' + escHtml(q) + '" title="' + escHtml(q) + '">' + qTdContent + '</td>';
        } else {
          html += '<td class="search-log-q kw-q-link" data-share-id="' + escHtml(item.share_id) + '" data-keywords="' + escHtml(kwNames) + '" title="' + escHtml(q) + '">' + qTdContent + '</td>';
        }
        html += '<td class="kw-analysis-badges">' + (badges || '<span style="color:var(--text-muted);font-size:12px">-</span>') + '</td>';
        if (showDate) {
          var dateStr = item.last_searched_at ? item.last_searched_at.slice(0, 10) : '';
          var monthStr = dateStr.slice(0, 7);
          var dateCell = dateStr
            ? '<button class="impr-date-link" data-month="' + escHtml(monthStr) + '" data-date="' + escHtml(dateStr) + '">' + escHtml(dateStr) + '</button>'
            : '-';
          html += '<td class="search-log-date">' + dateCell + '</td>';
        }
        html += '</tr>';
      });
      html += '</tbody></table>';
      searchImpressionsBody.innerHTML = html;
    }

    var impressionsCachedItems = [];
    var impressionsCachedSubqueryMap = {};
    var impressionsKeywordFilter = null;

    function openSearchImpressions() {
      searchImpressionsOverlay.classList.add('open');
      searchImpressionsOverlay.setAttribute('aria-hidden', 'false');
      impressionsDateToggleBtn.classList.toggle('active', getImpressionsDateVisible());
      impressionsKeywordFilter = null;
      searchImpressionsBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      Promise.all([
        fetch('/api/aichat/search-impressions', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/share-subquery-links/all', { credentials: 'same-origin' }).then(function(r) { return r.json(); }).catch(function() { return { items: [] }; })
      ]).then(function(results) {
        impressionsCachedItems = results[0].items || [];
        var sqItems = results[1].items || [];
        impressionsCachedSubqueryMap = {};
        sqItems.forEach(function(g) { impressionsCachedSubqueryMap[g.question] = g.links || []; });
        renderImpressionsTable(impressionsCachedItems, impressionsCachedSubqueryMap, null);
      }).catch(function() { searchImpressionsBody.innerHTML = '<div class="search-log-empty">読み込みエラー</div>'; });
    }

    function closeSearchImpressions() {
      searchImpressionsOverlay.classList.remove('open');
      searchImpressionsOverlay.setAttribute('aria-hidden', 'true');
    }

    impressionsDateToggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var next = !getImpressionsDateVisible();
      setImpressionsDateVisible(next);
      impressionsDateToggleBtn.classList.toggle('active', next);
      renderImpressionsTable(impressionsCachedItems, impressionsCachedSubqueryMap, impressionsKeywordFilter);
    });

    var impressionsSubqueryModal = document.getElementById('impressionsSubqueryModal');
    var impressionsSubqueryModalClose = document.getElementById('impressionsSubqueryModalClose');
    var impressionsSubqueryModalTitle = document.getElementById('impressionsSubqueryModalTitle');
    var impressionsSubqueryModalBody = document.getElementById('impressionsSubqueryModalBody');

    function openImpressionsSubqueryModal(question, links) {
      var qShort = question.length > 50 ? question.slice(0, 50) + '…' : question;
      impressionsSubqueryModalTitle.textContent = qShort;
      var html = '';
      links.forEach(function(lk) {
        html += '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border-color);">';
        html += '<span style="flex:1;color:var(--text-secondary);font-size:13px;line-height:1.5;">' + escHtml(lk.query) + '</span>';
        html += '<a href="' + escHtml(lk.url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent-color,#667eea);font-size:12px;white-space:nowrap;flex-shrink:0;">🔗 開く</a>';
        html += '</div>';
      });
      impressionsSubqueryModalBody.innerHTML = html || '<div style="color:var(--text-muted);">リンクがありません</div>';
      impressionsSubqueryModal.style.zIndex = String(getNextZ());
      impressionsSubqueryModal.classList.add('open');
      impressionsSubqueryModal.setAttribute('aria-hidden', 'false');
    }

    function closeImpressionsSubqueryModal() {
      impressionsSubqueryModal.classList.remove('open');
      impressionsSubqueryModal.setAttribute('aria-hidden', 'true');
    }

    impressionsSubqueryModalClose.addEventListener('click', function() { closeImpressionsSubqueryModal(); });
    impressionsSubqueryModal.addEventListener('click', function(e) { if (e.target === impressionsSubqueryModal) closeImpressionsSubqueryModal(); });

    function openHistoryModalByShareId(shareId, keywordsJson) {
      var keywords = [];
      try { keywords = JSON.parse(keywordsJson || '[]'); } catch(err) {}
      fetch('/api/aichat/shares/' + encodeURIComponent(shareId), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) { if (data && data.question) showHistoryModal(data, keywords); })
        .catch(function() {});
    }

    searchImpressionsBody.addEventListener('click', function(e) {
      var dateBtn = e.target.closest('button.impr-date-link');
      if (dateBtn) {
        e.stopPropagation();
        var month = dateBtn.getAttribute('data-month');
        var date = dateBtn.getAttribute('data-date');
        closeSearchImpressions();
        closeHistoryModal();
        clearHistorySelection();
        if (!sidebarOpen) {
          sidebarOpen = true;
          sidebar.classList.add('open');
          sidebarToggle.classList.add('active');
        }
        calCurrentMonth = month;
        calSelectedDay = date;
        sidebarSearch.value = '';
        sidebarClear.classList.remove('visible');
        loadCalendar(month);
        doDateLoad(date);
        return;
      }
      var clearBadge = e.target.closest('.impr-kw-filter-active');
      if (clearBadge) {
        impressionsKeywordFilter = null;
        renderImpressionsTable(impressionsCachedItems, impressionsCachedSubqueryMap, null);
        return;
      }
      var kwBadge = e.target.closest('.kw-analysis-badge:not(.impr-kw-filter-active)');
      if (kwBadge) {
        var kw = kwBadge.getAttribute('data-keyword');
        if (kw) {
          impressionsKeywordFilter = kw;
          renderImpressionsTable(impressionsCachedItems, impressionsCachedSubqueryMap, kw);
        }
        return;
      }
      var qSpan = e.target.closest('span.impr-q-text');
      if (qSpan) {
        var td = qSpan.closest('td[data-share-id]');
        if (td) openHistoryModalByShareId(td.getAttribute('data-share-id'), td.getAttribute('data-keywords'));
        return;
      }
      var sqTd = e.target.closest('td.has-subquery');
      if (sqTd) {
        var q = sqTd.getAttribute('data-question');
        var links = impressionsCachedSubqueryMap[q] || [];
        if (links.length > 0) { openImpressionsSubqueryModal(q, links); }
        return;
      }
      var td2 = e.target.closest('td[data-share-id]');
      if (!td2) return;
      openHistoryModalByShareId(td2.getAttribute('data-share-id'), td2.getAttribute('data-keywords'));
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
    var sidebarModeToggle = document.getElementById('sidebarModeToggle');
    var sidebarModeNew = document.getElementById('sidebarModeNew');
    var sidebarModeKw = document.getElementById('sidebarModeKw');
    var sidebarKwModal = document.getElementById('sidebarKwModal');
    var sidebarKwClose = document.getElementById('sidebarKwClose');
    var sidebarKwList = document.getElementById('sidebarKwList');
    var sidebarKwCount = document.getElementById('sidebarKwCount');
    var sidebarKwSortCount = document.getElementById('sidebarKwSortCount');
    var sidebarKwSortAlpha = document.getElementById('sidebarKwSortAlpha');
    var sidebarOpen = false;
    var kwSortOrder = 'count'; // 'count' | 'alpha'
    var kwListCache = [];

    function isTapCloseEnabled() {
      var m = document.cookie.match(/(?:^|;\s*)aichat_sidebar_tap_close=([^;]*)/);
      return !m || m[1] !== 'off';
    }

    function closeSidebar() {
      sidebarOpen = false;
      sidebar.classList.remove('open');
      sidebarToggle.classList.remove('active');
      sidebarKwModal.classList.remove('open');
    }

    sidebarToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      sidebarOpen = !sidebarOpen;
      sidebar.classList.toggle('open', sidebarOpen);
      sidebarToggle.classList.toggle('active', sidebarOpen);
      if (sidebarOpen) {
        setTimeout(function() { sidebarSearch.focus(); }, 260);
        var todayDate = new Date().toISOString().slice(0, 10);
        calCurrentMonth = todayDate.slice(0, 7);
        calSelectedDay = todayDate;
        loadCalendar(calCurrentMonth);
        doDateLoad(todayDate);
      }
    });

    document.addEventListener('click', function(e) {
      if (sidebarKwModal.classList.contains('open') && !sidebarKwModal.contains(e.target) && e.target !== sidebarModeKw) {
        sidebarKwModal.classList.remove('open');
      }
      if (sidebarOpen && isTapCloseEnabled() && !sidebar.contains(e.target) && !sidebarKwModal.contains(e.target) && e.target !== sidebarToggle) {
        closeSidebar();
      }
    });

    // ===== キーワード検索 =====
    var searchTimer = null;
    var currentResults = [];
    var selectedIdx = -1;
    var currentMode = 'search'; // 'search' | 'date' | 'keyword'
    var currentDateLabel = '';
    var currentKeywordLabel = '';

    function updateSidebarModeUI() {
      if (currentMode === 'date' || currentMode === 'keyword') {
        sidebarModeToggle.style.display = '';
        sidebarModeNew.classList.toggle('active', currentMode === 'date');
        sidebarModeKw.classList.toggle('active', currentMode === 'keyword');
      } else {
        sidebarModeToggle.style.display = 'none';
      }
    }

    function renderKwList(kws) {
      kwListCache = kws.slice();
      var sorted = kws.slice();
      if (kwSortOrder === 'alpha') {
        sorted.sort(function(a, b) { return a.keyword.localeCompare(b.keyword, 'ja'); });
      }
      var html = '';
      sorted.forEach(function(kw) {
        var sel = currentKeywordLabel === kw.keyword ? ' selected' : '';
        html += '<div class="sidebar-kw-item' + sel + '" data-keyword="' + escHtml(kw.keyword) + '">'
          + '<span>' + escHtml(kw.keyword) + '</span>'
          + '<span class="sidebar-kw-count">' + kw.total_count + '回</span>'
          + '</div>';
      });
      sidebarKwList.innerHTML = html;
      sidebarKwList.querySelectorAll('.sidebar-kw-item').forEach(function(el) {
        el.addEventListener('click', function() {
          var kw = el.getAttribute('data-keyword');
          if (!kw) return;
          sidebarKwList.querySelectorAll('.sidebar-kw-item').forEach(function(e) { e.classList.remove('selected'); });
          el.classList.add('selected');
          sidebarSearch.value = kw;
          sidebarClear.classList.add('visible');
          doKeywordLoad(kw);
        });
      });
    }

    function openSidebarKeywordModal() {
      var month = new Date().toISOString().slice(0, 7);
      sidebarKwList.innerHTML = '<div style="padding:10px;font-size:11px;color:var(--text-muted);">読み込み中...</div>';
      sidebarKwModal.classList.add('open');
      if (kwListCache.length > 0) {
        sidebarKwCount.textContent = kwListCache.length + '件';
        renderKwList(kwListCache);
        return;
      }
      fetch('/api/aichat/keywords/monthly?month=' + encodeURIComponent(month), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var kws = d.keywords || [];
          sidebarKwCount.textContent = kws.length + '件';
          if (kws.length === 0) {
            kwListCache = [];
            sidebarKwList.innerHTML = '<div style="padding:10px;font-size:11px;color:var(--text-muted);">キーワードがありません</div>';
            return;
          }
          renderKwList(kws);
        })
        .catch(function() {
          sidebarKwList.innerHTML = '<div style="padding:10px;font-size:11px;color:var(--text-muted);">取得に失敗しました</div>';
        });
    }

    function doKeywordLoad(keyword) {
      fetchSidebarSubqueries();
      sidebarStatus.textContent = '読み込み中...';
      fetch('/api/aichat/shares/by-keyword?keyword=' + encodeURIComponent(keyword), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          currentResults = data.results || [];
          if (kwSortOrder === 'alpha') {
            currentResults.sort(function(a, b) { return a.question.localeCompare(b.question, 'ja'); });
          }
          selectedIdx = -1;
          currentMode = 'keyword';
          currentKeywordLabel = keyword;
          renderSidebarResults();
          sidebarStatus.textContent = '🔍 ' + keyword + '　' + currentResults.length + ' 件';
          updateSidebarModeUI();
        })
        .catch(function() { sidebarStatus.textContent = '読み込みエラー'; });
    }

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
      updateSidebarModeUI();
      clearSelectedDay();
      sidebarSearch.focus();
    });

    sidebarModeNew.addEventListener('click', function() {
      sidebarKwModal.classList.remove('open');
      if (currentMode === 'date') return;
      var date = currentDateLabel || new Date().toISOString().slice(0, 10);
      doDateLoad(date);
    });
    sidebarModeKw.addEventListener('click', function() {
      if (sidebarKwModal.classList.contains('open')) {
        sidebarKwModal.classList.remove('open');
      } else {
        openSidebarKeywordModal();
      }
    });
    sidebarKwClose.addEventListener('click', function() { sidebarKwModal.classList.remove('open'); });
    sidebarKwSortCount.addEventListener('click', function() {
      if (kwSortOrder === 'count') return;
      kwSortOrder = 'count';
      sidebarKwSortCount.classList.add('active');
      sidebarKwSortAlpha.classList.remove('active');
      if (kwListCache.length > 0) renderKwList(kwListCache);
      if (currentMode === 'keyword' && currentKeywordLabel) doKeywordLoad(currentKeywordLabel);
    });
    sidebarKwSortAlpha.addEventListener('click', function() {
      if (kwSortOrder === 'alpha') return;
      kwSortOrder = 'alpha';
      sidebarKwSortAlpha.classList.add('active');
      sidebarKwSortCount.classList.remove('active');
      if (kwListCache.length > 0) renderKwList(kwListCache);
      if (currentMode === 'keyword' && currentKeywordLabel) doKeywordLoad(currentKeywordLabel);
    });

    var sidebarSubqueries = null;

    function fetchSidebarSubqueries() {
      if (sidebarSubqueries !== null) return Promise.resolve(sidebarSubqueries);
      return fetch('/api/aichat/share-subquery-links/all', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          sidebarSubqueries = new Set((d.items || []).map(function(it) { return it.question; }));
          if (currentResults.length > 0) renderSidebarResults();
          return sidebarSubqueries;
        })
        .catch(function() { sidebarSubqueries = new Set(); return sidebarSubqueries; });
    }

    function doSearch(q) {
      fetchSidebarSubqueries();
      fetch('/api/aichat/shares/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          currentResults = data.results || [];
          selectedIdx = -1;
          currentMode = 'search';
          renderSidebarResults();
          sidebarStatus.textContent = currentResults.length > 0 ? currentResults.length + ' 件ヒット' : '一致なし';
          updateSidebarModeUI();
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
      Promise.all([
        fetch('/api/aichat/shares/by-date?date=' + encodeURIComponent(date), { credentials: 'same-origin' })
          .then(function(r) { return r.json(); }),
        fetchSidebarSubqueries()
      ]).then(function(results) {
        var data = results[0];
        var sq = results[1];
        currentResults = data.results || [];
        selectedIdx = -1;
        currentMode = 'date';
        currentDateLabel = date;
        renderSidebarResults();
        var sqCount = currentResults.filter(function(r) { return sq && sq.has(r.question); }).length;
        sidebarStatus.textContent = date + ' ' + sqCount + '/' + currentResults.length + ' 件';
        updateSidebarModeUI();
      }).catch(function() { sidebarStatus.textContent = '読み込みエラー'; });
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
        item.className = 'sidebar-result-item' + (sidebarSubqueries && sidebarSubqueries.has(r.question) ? ' has-subquery' : '');
        var modelColor = r.model && MODEL_COLORS[r.model];
        if (modelColor) item.style.borderLeftColor = modelColor;

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
        meta.textContent = r.created_at.slice(0, 16).replace('T', ' ');
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
      var todayStr = new Date().toISOString().slice(0, 10);
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
        cell.className = 'cal-cell' + (count > 0 ? ' has-data' : '') + (dateStr === todayStr ? ' cal-today' : '') + (calSelectedDay === dateStr ? ' selected-day' : '');
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

    historyModalMeta.addEventListener('click', function(e) {
      if (e.target && e.target.closest && e.target.closest('.history-modal-model-filter-btn')) {
        openHistoryModelSelectModal();
      }
    });

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
      historyModalBackdrop.style.zIndex = '';
    }

    function clearHistorySelection() {
      selectedIdx = -1;
      renderSidebarResults();
    }

    function shortModelName(model) {
      return model ? (model.split('/').pop() || model) : '';
    }

    function formatHistoryMeta(r) {
      return r.created_at.slice(0, 16).replace('T', ' ') + '　' + shortModelName(r.model) + '　👁 ' + (r.access_count || 0);
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

    var historyModalSubqueryLinks = document.getElementById('historyModalSubqueryLinks');
    var historyModalAddSubqueryBtn = document.getElementById('historyModalAddSubqueryBtn');
    var currentHistoryQuestion = '';
    var historyModalCurrentModel = '';

    function renderSubqueryLinks(items) {
      if (!items || items.length === 0) {
        historyModalSubqueryLinks.style.display = 'none';
        historyModalSubqueryLinks.innerHTML = '';
        return;
      }
      var html = '<div style="font-weight:600;margin-bottom:4px;color:var(--text-secondary);">追加質問リンク</div>';
      html += '<div style="display:flex;flex-direction:column;gap:4px;">';
      items.forEach(function(item) {
        html += '<div style="display:flex;gap:8px;align-items:center;">';
        html += '<span style="color:var(--text-muted);">' + escHtml(item.query) + '</span>';
        html += '<a href="' + escHtml(item.url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent-color,#667eea);text-decoration:none;font-size:11px;">🔗 開く</a>';
        html += '</div>';
      });
      html += '</div>';
      historyModalSubqueryLinks.innerHTML = html;
      historyModalSubqueryLinks.style.display = 'block';
    }

    function loadSubqueryLinks(question) {
      fetch('/api/aichat/share-subquery-links?question=' + encodeURIComponent(question), {
        credentials: 'same-origin'
      })
        .then(function(r) { return r.json(); })
        .then(function(d) { renderSubqueryLinks(d.items || []); })
        .catch(function() { historyModalSubqueryLinks.style.display = 'none'; });
    }

    function showHistoryModal(r, keyword) {
      closeResultsPanel();
      historyModalChat.innerHTML = '';
      appendHistoryModalBubble(r.question, 'user');
      appendHistoryModalBubble(r.answer, 'assistant');
      if (keyword) applyKeywordHighlight(historyModalChat, keyword);
      historyModalDateLink.textContent = r.created_at.slice(0, 10);
      historyModalTime.textContent = ' ' + r.created_at.slice(11, 16);
      var dotColor = MODEL_COLORS[r.model] || '';
      var dotStyle = dotColor ? 'display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dotColor + ';margin-right:4px;vertical-align:middle;' : '';
      historyModalMeta.innerHTML = '<span class="history-modal-model-filter-btn" style="cursor:pointer;' + (dotColor ? 'color:' + dotColor + ';' : '') + 'text-decoration:underline dotted;" title="モデルで絞り込む">' + (dotStyle ? '<span style="' + dotStyle + '"></span>' : '') + escHtml(shortModelName(r.model)) + '</span>' + '　👁 ' + (r.access_count || 0);
      historyModalShareLink.href = '/s/' + r.user_hash + '/' + r.id;
      historyModalCurrentId = r.id;
      currentHistoryQuestion = r.question || '';
      historyModalCurrentModel = r.model || '';
      historyModalSubqueryLinks.style.display = 'none';
      historyModalSubqueryLinks.innerHTML = '';
      historyModalBackdrop.style.zIndex = String(getNextZ());
      historyModalBackdrop.classList.add('open');
      historyModalBackdrop.setAttribute('aria-hidden', 'false');
      if (currentHistoryQuestion) loadSubqueryLinks(currentHistoryQuestion);
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
      if (searchImpressionsOverlay.classList.contains('open')) closeSearchImpressions();
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
    var historyModalSearchInput = document.getElementById('historyModalSearchInput');
    var historyModalSearchBtn = document.getElementById('historyModalSearchBtn');

    function doHistoryModalSearch() {
      var kw = historyModalSearchInput.value.trim();
      if (!kw) return;
      closeHistoryModal();
      if (searchKwAnalysisOverlay.classList.contains('open')) closeSearchKwAnalysis();
      if (searchImpressionsOverlay.classList.contains('open')) closeSearchImpressions();
      clearHistorySelection();
      if (!sidebarOpen) {
        sidebarOpen = true;
        sidebar.classList.add('open');
        sidebarToggle.classList.add('active');
        setTimeout(function() { sidebarSearch.focus(); }, 260);
      }
      sidebarSearch.value = kw;
      sidebarClear.classList.add('visible');
      doSearch(kw);
    }

    historyModalSearchBtn.addEventListener('click', function(e) { e.stopPropagation(); doHistoryModalSearch(); });
    historyModalSearchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doHistoryModalSearch();
    });

    // ===== サブクエリを持つ質問一覧 =====
    var linkedQuestionsOverlay = document.getElementById('linkedQuestionsOverlay');
    var linkedQuestionsClose = document.getElementById('linkedQuestionsClose');
    var linkedQuestionsBody = document.getElementById('linkedQuestionsBody');
    var linkedQuestionsBtn = document.getElementById('linkedQuestionsBtn');
    var linkedQuestionsAllItems = [];
    var linkedQuestionsFilter = 'all';

    function renderLinkedQuestions(items) {
      var filtered = linkedQuestionsFilter === 'all'
        ? items
        : items.filter(function(it) {
            return (it.links || []).some(function(lk) {
              return (lk.models || []).indexOf(linkedQuestionsFilter) !== -1;
            });
          });
      if (!filtered || filtered.length === 0) {
        linkedQuestionsBody.innerHTML = '<div style="color:var(--text-muted);padding:10px;">サブクエリが紐付いた質問がまだありません</div>';
        return;
      }
      var html = '<table class="search-log-table"><thead><tr>'
        + '<th style="cursor:pointer;user-select:none;" onclick="openLinkedQuestionsFilter()">質問 ▾</th>'
        + '<th>サブクエリ / リンク</th></tr></thead><tbody>';
      filtered.forEach(function(item) {
        var linkRows = (item.links || []).map(function(lk) {
          var dots = (lk.models || []).map(function(m) {
            var c = MODEL_COLORS[m] || '';
            return c ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + c + ';flex-shrink:0;" title="' + escHtml(shortModelName(m)) + '"></span>' : '';
          }).join('');
          var hashBadge = lk.question_hash
            ? '<span class="lk-hash-badge" data-hash="' + escHtml(lk.question_hash) + '" style="cursor:pointer;font-family:monospace;font-size:10px;padding:1px 5px;border-radius:4px;background:var(--bg-primary);border:1px solid var(--border-color);color:var(--text-muted);white-space:nowrap;flex-shrink:0;" title="質問ハッシュ — タップで異モデル比較">' + escHtml(lk.question_hash.slice(0, 7)) + '</span>'
            : '';
          return '<div style="display:flex;gap:5px;align-items:center;margin-bottom:4px;flex-wrap:wrap;">'
            + (dots ? '<span style="display:flex;gap:2px;align-items:center;flex-shrink:0;">' + dots + '</span>' : '')
            + hashBadge
            + '<span style="color:var(--text-secondary);font-size:12px;">' + escHtml(lk.query) + '</span>'
            + '<a href="' + escHtml(lk.url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent-color,#667eea);font-size:11px;white-space:nowrap;flex-shrink:0;">🔗 開く</a>'
            + '</div>';
        }).join('');
        html += '<tr>'
          + '<td class="kw-q-link" data-question="' + escHtml(item.question) + '" data-share-id="' + escHtml(item.share_id || '') + '" style="vertical-align:top;max-width:220px;cursor:pointer;padding-left:8px;">' + escHtml(item.question) + '</td>'
          + '<td style="vertical-align:top;">' + linkRows + '</td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      linkedQuestionsBody.innerHTML = html;
      linkedQuestionsBody.querySelectorAll('td.kw-q-link').forEach(function(td) {
        td.addEventListener('click', function() {
          var shareId = td.getAttribute('data-share-id');
          if (shareId) {
            closeLinkedQuestions();
            openHistoryModalByShareId(shareId, '[]');
          }
        });
      });
      linkedQuestionsBody.querySelectorAll('.lk-hash-badge').forEach(function(badge) {
        badge.addEventListener('click', function(e) {
          e.stopPropagation();
          openQuestionHashModal(badge.getAttribute('data-hash'));
        });
      });
    }

    function getNextZ() {
      var max = 700;
      document.querySelectorAll('div[style*="position:fixed"]').forEach(function(el) {
        var z = parseInt(el.style.zIndex) || 0;
        if (z > max && z < 9000) max = z;
      });
      var staticZDefaults = {
        linkedQuestionsOverlay: 700, impressionsSubqueryModal: 800,
        sqKwQuestionsOverlay: 850, addSubqueryModal: 900, historyModalBackdrop: 750,
      };
      Object.keys(staticZDefaults).forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.classList.contains('open')) {
          var z = parseInt(el.style.zIndex) || staticZDefaults[id];
          if (z > max) max = z;
        }
      });
      return max + 100;
    }

    function openQuestionHashModal(hash) {
      if (!hash) return;
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:' + getNextZ() + ';display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary);border-radius:10px;padding:20px;min-width:300px;max-width:480px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.22);';
      var title = document.createElement('div');
      title.style.cssText = 'font-weight:700;font-size:14px;margin-bottom:4px;';
      title.textContent = '異モデル回答の比較';
      var sub = document.createElement('div');
      sub.style.cssText = 'font-family:monospace;font-size:10px;color:var(--text-muted);margin-bottom:12px;word-break:break-all;';
      sub.textContent = hash;
      box.appendChild(title);
      box.appendChild(sub);
      var content = document.createElement('div');
      content.textContent = '読み込み中...';
      box.appendChild(content);
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '閉じる';
      closeBtn.style.cssText = 'display:block;width:100%;text-align:center;padding:8px;margin-top:12px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);cursor:pointer;font-size:12px;';
      closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      box.appendChild(closeBtn);
      overlay.appendChild(box);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
      document.body.appendChild(overlay);
      fetch('/api/aichat/shares-by-question-hash?hash=' + encodeURIComponent(hash), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var rows = d.items || [];
          if (rows.length === 0) {
            content.textContent = '関連するチャット履歴が見つかりません';
            return;
          }
          var t = '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
            + '<thead><tr style="border-bottom:1px solid var(--border-color);">'
            + '<th style="text-align:left;padding:4px 6px;">モデル</th>'
            + '<th style="text-align:left;padding:4px 6px;">日時</th>'
            + '<th style="text-align:left;padding:4px 6px;">👁</th>'
            + '<th style="padding:4px 6px;"></th>'
            + '</tr></thead><tbody>';
          rows.forEach(function(r) {
            var dot = MODEL_COLORS[r.model] ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + MODEL_COLORS[r.model] + ';margin-right:4px;vertical-align:middle;"></span>' : '';
            t += '<tr style="border-bottom:1px solid var(--border-color);">'
              + '<td style="padding:5px 6px;">' + dot + escHtml(shortModelName(r.model)) + '</td>'
              + '<td style="padding:5px 6px;white-space:nowrap;">' + escHtml(r.created_at.slice(0, 16).replace('T', ' ')) + '</td>'
              + '<td style="padding:5px 6px;">' + (r.access_count || 0) + '</td>'
              + '<td style="padding:5px 6px;"><a href="/s/' + escHtml(r.user_hash) + '/' + escHtml(r.id) + '" target="_blank" style="color:var(--accent-color,#667eea);text-decoration:none;">🔗</a></td>'
              + '</tr>';
          });
          t += '</tbody></table>';
          content.innerHTML = t;
        })
        .catch(function() { content.textContent = '取得に失敗しました'; });
    }

    function openHistoryModelSelectModal() {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:' + getNextZ() + ';display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary);border-radius:10px;padding:20px;min-width:240px;max-width:340px;box-shadow:0 8px 32px rgba(0,0,0,0.18);';
      var title = document.createElement('div');
      title.textContent = '別のモデルに質問する';
      title.style.cssText = 'font-weight:700;margin-bottom:12px;font-size:14px;';
      box.appendChild(title);
      Object.keys(MODEL_COLORS).forEach(function(m) {
        var btn = document.createElement('button');
        var dotColor = MODEL_COLORS[m] || '';
        var isCurrent = m === historyModalCurrentModel;
        var dotHtml = dotColor ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dotColor + ';margin-right:6px;vertical-align:middle;flex-shrink:0;"></span>' : '';
        btn.innerHTML = dotHtml + escHtml(shortModelName(m)) + (isCurrent ? ' <span style="font-size:11px;opacity:0.6;">（現在）</span>' : '');
        btn.style.cssText = 'display:flex;align-items:center;width:100%;text-align:left;padding:8px 12px;margin-bottom:6px;border-radius:6px;border:1px solid ' + (isCurrent ? 'var(--accent-color,#667eea)' : 'var(--border-color)') + ';background:' + (isCurrent ? 'rgba(102,126,234,0.08)' : 'var(--bg-primary)') + ';color:var(--text-primary);cursor:' + (isCurrent ? 'default' : 'pointer') + ';font-size:13px;';
        if (!isCurrent) {
          btn.addEventListener('click', function() {
            openReAskConfirmModal(m, currentHistoryQuestion, overlay);
          });
        }
        box.appendChild(btn);
      });
      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'キャンセル';
      cancelBtn.style.cssText = 'display:block;width:100%;text-align:center;padding:7px;margin-top:4px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);cursor:pointer;font-size:12px;';
      cancelBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      box.appendChild(cancelBtn);
      overlay.appendChild(box);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
      document.body.appendChild(overlay);
    }

    function openReAskConfirmModal(selectedModel, question, selectOverlay) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:' + getNextZ() + ';display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary);border-radius:12px;padding:24px;min-width:280px;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,0.22);';
      var qDiv = document.createElement('div');
      qDiv.style.cssText = 'background:var(--bg-primary);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--text-primary);max-height:72px;overflow:hidden;line-height:1.5;';
      qDiv.textContent = question.length > 120 ? question.slice(0, 120) + '…' : question;
      box.appendChild(qDiv);
      var dotColor = MODEL_COLORS[selectedModel] || '';
      var modelDiv = document.createElement('div');
      modelDiv.innerHTML = (dotColor ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dotColor + ';margin-right:6px;vertical-align:middle;"></span>' : '') + '<strong>' + escHtml(shortModelName(selectedModel)) + '</strong>';
      modelDiv.style.cssText = 'margin-bottom:10px;font-size:14px;';
      box.appendChild(modelDiv);
      var msgDiv = document.createElement('div');
      msgDiv.textContent = 'この言語モデルに改めて問い合わせますか？';
      msgDiv.style.cssText = 'font-size:14px;margin-bottom:20px;color:var(--text-primary);';
      box.appendChild(msgDiv);
      var btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:10px;';
      var yesBtn = document.createElement('button');
      yesBtn.textContent = 'はい';
      yesBtn.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:none;background:var(--accent-color,#667eea);color:#fff;cursor:pointer;font-size:14px;font-weight:600;';
      yesBtn.addEventListener('click', function() {
        document.body.removeChild(overlay);
        if (selectOverlay.parentNode) document.body.removeChild(selectOverlay);
        historyModalBackdrop.classList.remove('open');
        historyModalBackdrop.setAttribute('aria-hidden', 'true');
        openReAskResponseModal(selectedModel, question);
      });
      var noBtn = document.createElement('button');
      noBtn.textContent = 'いいえ';
      noBtn.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:1px solid var(--border-color);background:transparent;color:var(--text-primary);cursor:pointer;font-size:14px;';
      noBtn.addEventListener('click', function() {
        document.body.removeChild(overlay);
        if (selectOverlay.parentNode) document.body.removeChild(selectOverlay);
      });
      btnRow.appendChild(yesBtn);
      btnRow.appendChild(noBtn);
      box.appendChild(btnRow);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    }

    function renderAiResultInModal(box, question, selectedModel, data) {
      var responseText = data.response || '（応答なし）';
      var usedModel = data.usedModel || selectedModel;
      var ansBubble = document.createElement('div');
      ansBubble.className = 'chat-bubble assistant preview-area';
      ansBubble.innerHTML = parseMd(responseText);
      box.appendChild(ansBubble);
      if (data.usedModel && data.usedModel !== selectedModel) {
        var fallbackNote = document.createElement('div');
        fallbackNote.textContent = '※ ' + escHtml(shortModelName(data.usedModel)) + ' にフォールバックしました';
        fallbackNote.style.cssText = 'font-size:11px;color:var(--text-muted);';
        box.appendChild(fallbackNote);
      }
      appendAiResponseRow(box, question, responseText, usedModel, data.shareId, data.userHash);
    }

    function openReAskResponseModal(selectedModel, question) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:' + getNextZ() + ';display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary);border-radius:12px;padding:24px;width:min(600px,92vw);max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.22);display:flex;flex-direction:column;gap:12px;';
      var header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
      var dotColor = MODEL_COLORS[selectedModel] || '';
      var modelLabel = document.createElement('div');
      modelLabel.innerHTML = (dotColor ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dotColor + ';margin-right:6px;vertical-align:middle;"></span>' : '') + '<strong>' + escHtml(shortModelName(selectedModel)) + '</strong>';
      modelLabel.style.cssText = 'font-size:14px;';
      header.appendChild(modelLabel);
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:18px;color:var(--text-muted);line-height:1;padding:0 4px;';
      closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      header.appendChild(closeBtn);
      box.appendChild(header);
      var qBubble = document.createElement('div');
      qBubble.className = 'chat-bubble user';
      qBubble.textContent = question;
      box.appendChild(qBubble);
      var loading = document.createElement('div');
      loading.textContent = '応答を取得中…';
      loading.style.cssText = 'color:var(--text-muted);font-size:13px;padding:8px 0;';
      box.appendChild(loading);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      fetch('/api/aichat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, model: selectedModel })
      }).then(function(r) { return r.json(); }).then(function(d) {
        box.removeChild(loading);
        renderAiResultInModal(box, question, selectedModel, d);
      }).catch(function(err) {
        loading.textContent = '取得に失敗しました: ' + (err.message || err);
      });
    }

    function openLinkedQuestionsFilterMaybeLoad() {
      if (linkedQuestionsAllItems.length > 0) {
        openLinkedQuestionsFilter();
      } else {
        fetch('/api/aichat/share-subquery-links/all', { credentials: 'same-origin' })
          .then(function(r) { return r.json(); })
          .then(function(d) { linkedQuestionsAllItems = d.items || []; openLinkedQuestionsFilter(); })
          .catch(function() { openLinkedQuestionsFilter(); });
      }
    }

    function openLinkedQuestionsFilter() {
      var models = [];
      linkedQuestionsAllItems.forEach(function(it) {
        (it.links || []).forEach(function(lk) {
          (lk.models || []).forEach(function(m) {
            if (m && models.indexOf(m) === -1) models.push(m);
          });
        });
      });
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:' + getNextZ() + ';display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary);border-radius:10px;padding:20px;min-width:240px;max-width:340px;box-shadow:0 8px 32px rgba(0,0,0,0.18);';
      var title = document.createElement('div');
      title.textContent = 'モデルで絞り込む';
      title.style.cssText = 'font-weight:700;margin-bottom:12px;font-size:14px;';
      box.appendChild(title);
      var allModels = ['all'].concat(models);
      allModels.forEach(function(m) {
        var btn = document.createElement('button');
        var label = m === 'all' ? 'すべて' : shortModelName(m);
        btn.textContent = label;
        var dotColor = m !== 'all' ? (MODEL_COLORS[m] || '') : '';
        var isActive = linkedQuestionsFilter === m;
        btn.style.cssText = 'display:block;width:100%;text-align:left;padding:8px 12px;margin-bottom:6px;border-radius:6px;border:1px solid ' + (isActive ? 'var(--accent-color,#667eea)' : 'var(--border-color)') + ';background:' + (isActive ? 'var(--accent-color,#667eea)' : 'var(--bg-primary)') + ';color:' + (isActive ? '#fff' : 'var(--text-primary)') + ';cursor:pointer;font-size:13px;border-left:' + (dotColor ? '4px solid ' + dotColor : '4px solid transparent') + ';';
        btn.addEventListener('click', function() {
          linkedQuestionsFilter = m;
          document.body.removeChild(overlay);
          renderLinkedQuestions(linkedQuestionsAllItems);
        });
        box.appendChild(btn);
      });
      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'キャンセル';
      cancelBtn.style.cssText = 'display:block;width:100%;text-align:center;padding:7px;margin-top:4px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);cursor:pointer;font-size:12px;';
      cancelBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      box.appendChild(cancelBtn);
      overlay.appendChild(box);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
      document.body.appendChild(overlay);
    }

    function openLinkedQuestions() {
      linkedQuestionsFilter = 'all';
      linkedQuestionsOverlay.style.zIndex = String(getNextZ());
      linkedQuestionsOverlay.classList.add('open');
      linkedQuestionsOverlay.setAttribute('aria-hidden', 'false');
      linkedQuestionsBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      fetch('/api/aichat/share-subquery-links/all', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          linkedQuestionsAllItems = d.items || [];
          renderLinkedQuestions(linkedQuestionsAllItems);
        })
        .catch(function() { linkedQuestionsBody.innerHTML = '<div style="color:var(--text-muted);">取得に失敗しました</div>'; });
    }

    function closeLinkedQuestions() {
      linkedQuestionsOverlay.classList.remove('open');
      linkedQuestionsOverlay.setAttribute('aria-hidden', 'true');
    }

    linkedQuestionsBtn.addEventListener('click', function(e) { e.stopPropagation(); openLinkedQuestions(); });
    linkedQuestionsClose.addEventListener('click', function() { closeLinkedQuestions(); });
    linkedQuestionsOverlay.addEventListener('click', function(e) { if (e.target === linkedQuestionsOverlay) closeLinkedQuestions(); });

    // ===== サブクエリ一覧 =====
    var subqueriesOverlay = document.getElementById('subqueriesOverlay');
    var subqueriesClose = document.getElementById('subqueriesClose');
    var subqueriesAddBtn = document.getElementById('subqueriesAddBtn');
    var subqueriesAddForm = document.getElementById('subqueriesAddForm');
    var subqueriesAddInput = document.getElementById('subqueriesAddInput');
    var subqueriesAddSubmit = document.getElementById('subqueriesAddSubmit');
    var subqueriesAddMsg = document.getElementById('subqueriesAddMsg');
    var subqueriesListBody = document.getElementById('subqueriesListBody');
    var subqueriesBtn = document.getElementById('subqueriesBtn');

    function renderSubqueriesList(items) {
      if (!items || items.length === 0) {
        subqueriesListBody.innerHTML = '<div style="color:var(--text-muted);padding:10px;">サブクエリがまだ登録されていません</div>';
        return;
      }
      var html = '<table class="search-log-table"><thead><tr>' +
        '<th style="text-align:right;width:56px;">追加質問数</th>' +
        '<th>サブクエリ</th>' +
        '<th>キーワード</th>' +
        '</tr></thead><tbody>';
      items.forEach(function(item) {
        var kwHtml = '';
        if (item.keywords && item.keywords.length > 0) {
          item.keywords.forEach(function(kw) {
            kwHtml += '<span class="sq-kw-badge" data-subquery-id="' + escHtml(String(item.id)) + '" data-subquery="' + escHtml(item.query) + '" data-keyword="' + escHtml(kw.keyword) + '">' + escHtml(kw.keyword) + ' (' + kw.cnt + ')</span>';
          });
        }
        html += '<tr>';
        html += '<td style="text-align:right;color:var(--text-muted);">' + (item.link_count || 0) + '</td>';
        html += '<td>' + escHtml(item.query) + '</td>';
        html += '<td>' + kwHtml + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      subqueriesListBody.innerHTML = html;
    }

    var sqKwQuestionsOverlay = document.getElementById('sqKwQuestionsOverlay');
    var sqKwQuestionsTitle = document.getElementById('sqKwQuestionsTitle');
    var sqKwQuestionsClose = document.getElementById('sqKwQuestionsClose');
    var sqKwQuestionsBody = document.getElementById('sqKwQuestionsBody');

    function renderSqKwQuestionsResult(items, selectedKeyword) {
      if (!items || items.length === 0) {
        sqKwQuestionsBody.innerHTML = '<div style="color:var(--text-muted);padding:10px;">該当する質問がありません</div>';
        return;
      }
      var html = '<table class="search-log-table"><thead><tr><th>質問</th><th>キーワード</th></tr></thead><tbody>';
      items.forEach(function(item) {
        var kwHtml2 = (item.keywords || []).map(function(kw) {
          var cls = kw.keyword === selectedKeyword ? 'sq-kw-badge sq-kw-badge-active' : 'sq-kw-badge';
          return '<span class="' + cls + '">' + escHtml(kw.keyword) + ' (' + kw.cnt + ')</span>';
        }).join('');
        var kwJson = JSON.stringify((item.keywords || []).map(function(kw) { return kw.keyword; }));
        html += '<tr data-share-id="' + escHtml(String(item.share_id)) + '" data-keywords="' + escHtml(kwJson) + '" style="cursor:pointer;">';
        html += '<td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml(item.question) + '">' + escHtml(item.question) + '</td>';
        html += '<td>' + kwHtml2 + '</td></tr>';
      });
      html += '</tbody></table>';
      sqKwQuestionsBody.innerHTML = html;
    }

    function openSqKwQuestions(subqueryId, subqueryQuery, keyword) {
      sqKwQuestionsTitle.textContent = '「' + subqueryQuery + '」×「' + keyword + '」の質問一覧';
      sqKwQuestionsBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      sqKwQuestionsOverlay.style.zIndex = String(getNextZ());
      sqKwQuestionsOverlay.classList.add('open');
      sqKwQuestionsOverlay.setAttribute('aria-hidden', 'false');
      fetch('/api/aichat/subquery-keyword-questions?subquery_id=' + encodeURIComponent(subqueryId) + '&keyword=' + encodeURIComponent(keyword), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) { renderSqKwQuestionsResult(d.items || [], keyword); })
        .catch(function() { sqKwQuestionsBody.innerHTML = '<div style="color:var(--text-muted);">取得に失敗しました</div>'; });
    }

    sqKwQuestionsClose.addEventListener('click', function() {
      sqKwQuestionsOverlay.classList.remove('open');
      sqKwQuestionsOverlay.setAttribute('aria-hidden', 'true');
    });
    sqKwQuestionsOverlay.addEventListener('click', function(e) {
      if (e.target === sqKwQuestionsOverlay) {
        sqKwQuestionsOverlay.classList.remove('open');
        sqKwQuestionsOverlay.setAttribute('aria-hidden', 'true');
      }
    });

    sqKwQuestionsBody.addEventListener('click', function(e) {
      var tr = e.target.closest('tr[data-share-id]');
      if (!tr) return;
      var shareId = tr.dataset.shareId;
      var keywordsJson = tr.dataset.keywords || '[]';
      if (!shareId) return;
      openHistoryModalByShareId(shareId, keywordsJson);
    });

    subqueriesListBody.addEventListener('click', function(e) {
      var badge = e.target.closest('.sq-kw-badge');
      if (!badge) return;
      var subqueryId = badge.dataset.subqueryId;
      var subqueryQuery = badge.dataset.subquery;
      var keyword = badge.dataset.keyword;
      if (!subqueryId || !keyword) return;
      openSqKwQuestions(subqueryId, subqueryQuery, keyword);
    });

    function openSubqueries() {
      subqueriesOverlay.classList.add('open');
      subqueriesOverlay.setAttribute('aria-hidden', 'false');
      subqueriesAddForm.style.display = 'none';
      subqueriesAddInput.value = '';
      subqueriesAddSubmit.style.display = 'none';
      subqueriesAddMsg.textContent = '';
      subqueriesListBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      fetch('/api/aichat/subqueries', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) { renderSubqueriesList(d.items || []); })
        .catch(function() { subqueriesListBody.innerHTML = '<div style="color:var(--text-muted);">取得に失敗しました</div>'; });
    }

    function closeSubqueries() {
      subqueriesOverlay.classList.remove('open');
      subqueriesOverlay.setAttribute('aria-hidden', 'true');
    }

    subqueriesBtn.addEventListener('click', function(e) { e.stopPropagation(); openSubqueries(); });
    subqueriesClose.addEventListener('click', function() { closeSubqueries(); });
    subqueriesOverlay.addEventListener('click', function(e) { if (e.target === subqueriesOverlay) closeSubqueries(); });

    subqueriesAddBtn.addEventListener('click', function() {
      var isVisible = subqueriesAddForm.style.display !== 'none';
      subqueriesAddForm.style.display = isVisible ? 'none' : 'flex';
      subqueriesAddInput.value = '';
      subqueriesAddSubmit.style.display = 'none';
      subqueriesAddMsg.textContent = '';
      if (!isVisible) subqueriesAddInput.focus();
    });

    subqueriesAddInput.addEventListener('input', function() {
      var val = subqueriesAddInput.value.trim();
      subqueriesAddSubmit.style.display = '';
      subqueriesAddMsg.textContent = '';
      if (!val) { subqueriesAddSubmit.style.display = 'none'; return; }
      fetch('/api/aichat/subqueries', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var exists = (d.items || []).some(function(x) { return x.query === val; });
          if (exists) {
            subqueriesAddSubmit.style.display = 'none';
            subqueriesAddMsg.textContent = '同じ内容が既に登録されています';
          } else {
            subqueriesAddSubmit.style.display = '';
          }
        })
        .catch(function() { subqueriesAddSubmit.style.display = ''; });
    });

    subqueriesAddSubmit.addEventListener('click', function() {
      var val = subqueriesAddInput.value.trim();
      if (!val) return;
      fetch('/api/aichat/subqueries', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: val })
      })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.ok) {
            subqueriesAddMsg.textContent = '追加しました';
            subqueriesAddInput.value = '';
            subqueriesAddSubmit.style.display = 'none';
            fetch('/api/aichat/subqueries', { credentials: 'same-origin' })
              .then(function(r2) { return r2.json(); })
              .then(function(d2) { renderSubqueriesList(d2.items || []); })
              .catch(function() {});
          } else {
            subqueriesAddMsg.textContent = d.error || '追加に失敗しました';
          }
        })
        .catch(function() { subqueriesAddMsg.textContent = '通信エラーが発生しました'; });
    });

    // ===== 追加質問モーダル =====
    var addSubqueryModal = document.getElementById('addSubqueryModal');
    var addSubqueryClose = document.getElementById('addSubqueryClose');
    var addSubqueryList = document.getElementById('addSubqueryList');
    var addSubquerySelected = document.getElementById('addSubquerySelected');
    var addSubqueryUrl = document.getElementById('addSubqueryUrl');
    var addSubquerySubmit = document.getElementById('addSubquerySubmit');
    var addSubqueryMsg = document.getElementById('addSubqueryMsg');
    var selectedSubqueryId = null;

    function openAddSubqueryModal() {
      addSubqueryModal.style.zIndex = String(getNextZ());
      addSubqueryModal.classList.add('open');
      addSubqueryModal.setAttribute('aria-hidden', 'false');
      addSubquerySelected.value = '';
      addSubqueryUrl.value = '';
      addSubqueryMsg.textContent = '';
      selectedSubqueryId = null;
      addSubqueryList.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      fetch('/api/aichat/subqueries', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var items = (d.items || []).slice(0, 20);
          if (items.length === 0) {
            addSubqueryList.innerHTML = '<div style="color:var(--text-muted);padding:10px;">サブクエリがまだ登録されていません</div>';
            return;
          }
          var html = '';
          items.forEach(function(item) {
            html += '<div class="subquery-select-item" data-id="' + escHtml(String(item.id)) + '" data-query="' + escHtml(item.query) + '" style="padding:6px 8px;cursor:pointer;border-radius:4px;border:1px solid var(--border-color);">';
            html += '<span style="color:var(--text-muted);margin-right:6px;">' + escHtml(String(item.id)) + '</span>' + escHtml(item.query);
            html += '</div>';
          });
          addSubqueryList.innerHTML = html;
          addSubqueryList.querySelectorAll('.subquery-select-item').forEach(function(el) {
            el.addEventListener('click', function() {
              addSubqueryList.querySelectorAll('.subquery-select-item').forEach(function(e2) {
                e2.style.background = '';
              });
              el.style.background = 'var(--accent-color-light, rgba(102,126,234,0.12))';
              selectedSubqueryId = Number(el.getAttribute('data-id'));
              addSubquerySelected.value = el.getAttribute('data-query');
            });
          });
        })
        .catch(function() { addSubqueryList.innerHTML = '<div style="color:var(--text-muted);">取得に失敗しました</div>'; });
    }

    function closeAddSubqueryModal() {
      addSubqueryModal.classList.remove('open');
      addSubqueryModal.setAttribute('aria-hidden', 'true');
    }

    historyModalAddSubqueryBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      openAddSubqueryModal();
    });
    addSubqueryClose.addEventListener('click', function() { closeAddSubqueryModal(); });
    addSubqueryModal.addEventListener('click', function(e) { if (e.target === addSubqueryModal) closeAddSubqueryModal(); });

    addSubquerySubmit.addEventListener('click', function() {
      if (!selectedSubqueryId || !currentHistoryQuestion) {
        addSubqueryMsg.textContent = 'サブクエリと質問を選択してください';
        return;
      }
      var url = addSubqueryUrl.value.trim();
      if (!url) { addSubqueryMsg.textContent = 'URLを入力してください'; return; }
      fetch('/api/aichat/share-subquery-links', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentHistoryQuestion, subquery_id: selectedSubqueryId, url: url })
      })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.ok) {
            addSubqueryMsg.textContent = '登録しました';
            sidebarSubqueries = null;
            closeAddSubqueryModal();
            loadSubqueryLinks(currentHistoryQuestion);
          } else {
            addSubqueryMsg.textContent = d.error || '登録に失敗しました';
          }
        })
        .catch(function() { addSubqueryMsg.textContent = '通信エラーが発生しました'; });
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
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.shiftKey)) {
        e.preventDefault();
        if (!chatSendBtn.disabled) chatForm.dispatchEvent(new Event('submit'));
      }
    });

    function appendBubble(text, role, model, isFallback) {
      var el = document.createElement('div');
      if (role === 'assistant') {
        el.className = 'chat-bubble assistant preview-area';
        el.innerHTML = parseMd(text);
        if (isFallback) {
          var notice = document.createElement('div');
          notice.className = 'bubble-fallback-notice';
          notice.textContent = 'この言語モデル（' + shortModelName(model) + '）は応答に問題があったためデフォルトの言語モデルにフォールバックされました';
          el.appendChild(notice);
        }
        if (model) {
          var wrap = document.createElement('div');
          wrap.className = 'chat-bubble-wrap';
          var lbl = document.createElement('div');
          lbl.className = 'bubble-label' + (isFallback ? ' bubble-label-fallback' : '');
          lbl.textContent = shortModelName(model) + (isFallback ? ' (フォールバック)' : '');
          wrap.appendChild(lbl);
          wrap.appendChild(el);
          chatLog.appendChild(wrap);
          chatLog.scrollTop = chatLog.scrollHeight;
          return el;
        }
      } else {
        el.className = 'chat-bubble ' + role;
        el.textContent = text;
      }
      chatLog.appendChild(el);
      chatLog.scrollTop = chatLog.scrollHeight;
      return el;
    }

    function appendAiResponseRow(container, question, answer, model, shareId, userHash) {
      var row = document.createElement('div');
      row.className = 'chat-share-row';
      var cachedUrl = null;
      function getShareUrl() {
        if (cachedUrl) return Promise.resolve(cachedUrl);
        if (shareId && userHash) {
          cachedUrl = '/s/' + userHash + '/' + shareId;
          return Promise.resolve(cachedUrl);
        }
        return fetch('/api/aichat/share', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: question, answer: answer, model: model })
        }).then(function(r) { return r.json(); }).then(function(d) {
          if (d.shareUrl) { cachedUrl = d.shareUrl; }
          return d.shareUrl;
        });
      }
      var addBtn = document.createElement('button');
      addBtn.className = 'chat-share-btn';
      addBtn.innerHTML = '＋ 追加質問を登録する';
      addBtn.onclick = function() {
        currentHistoryQuestion = question;
        openAddSubqueryModal();
      };
      var btn = document.createElement('button');
      btn.className = 'chat-share-btn';
      btn.innerHTML = '🔗 リンクをコピー';
      btn.onclick = function() {
        getShareUrl().then(function(url) {
          if (!url) return;
          navigator.clipboard.writeText(url).then(function() {
            btn.innerHTML = '✓ コピーしました';
            btn.classList.add('copied');
            setTimeout(function() { btn.innerHTML = '🔗 リンクをコピー'; btn.classList.remove('copied'); }, 2000);
          });
        }).catch(function() {});
      };
      var openBtn = document.createElement('a');
      openBtn.className = 'chat-share-open-btn';
      openBtn.title = '別タブで開く';
      openBtn.innerHTML = '↗';
      openBtn.href = '#';
      openBtn.onclick = function(e) {
        e.preventDefault();
        getShareUrl().then(function(url) {
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
        }).catch(function() {});
      };
      row.appendChild(addBtn);
      row.appendChild(btn);
      row.appendChild(openBtn);
      container.appendChild(row);
      container.scrollTop = container.scrollHeight;
    }

    function appendShareBtn(question, answer, model, shareId, userHash) {
      appendAiResponseRow(chatLog, question, answer, model, shareId, userHash);
    }

    var MODEL_COLORS = ${modelColorsJson};
    var modelColorDot = document.getElementById('modelColorDot');

    function applyModelColor(model) {
      var color = MODEL_COLORS[model] || '';
      modelColorDot.style.background = color || 'var(--border-color)';
    }

    var modelSelect = document.getElementById('modelSelect');
    var lastModel = modelSelect.value;
    applyModelColor(lastModel);
    modelSelect.addEventListener('change', function() {
      lastModel = modelSelect.value;
      applyModelColor(lastModel);
    });

    var langModeSelect = document.getElementById('langModeSelect');

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
        body: JSON.stringify({ message: msg, model: lastModel, systemPromptMode: langModeSelect.value })
      })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          thinking.remove();
          if (data.error) {
            appendBubble('エラー: ' + data.error, 'error');
          } else {
            var responseText = data.response || '(応答なし)';
            var usedModel = data.usedModel || lastModel;
            appendBubble(responseText, 'assistant', lastModel, data.fallbackUsed);
            appendShareBtn(currentMsg, responseText, usedModel, data.shareId, data.userHash);
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
