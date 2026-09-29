/**
 * AI チャットページのHTML
 */
import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';
import { getCountdownWidgetCSS, getCountdownWidgetHTML, getCountdownWidgetScript } from '../utils/countdownWidget';
import { getCountdownQuickAddModalCSS, getCountdownQuickAddModalHTML, getCountdownQuickAddModalScript } from '../utils/countdownQuickAdd';
import { getMarkdownParserScript } from '../utils/markdownRenderer';
import { getKeywordHighlightScript } from '../utils/keywordHighlight';
import { getVectorizeAndBulkRegisterScript } from '../utils/vectorizeAndBulkRegister';
import { getRubyWasmLoaderScript, rubyWasmBinaryCacheName } from '../utils/rubyWasmLoader';
import { getRubyWasmVersionInfo, RUBY_WASM_BINARY_URL, RUBY_WASM_JS_URL } from './rubyWasm';

export const DEFAULT_AICHAT_MODELS: Array<{value: string; label: string}> = [
  { value: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'llama-3.3-70b-instruct-fp8-fast' },
  { value: '@cf/meta/llama-3.1-8b-instruct-fp8', label: 'llama-3.1-8b' },
  { value: '@cf/meta/llama-3.1-70b-instruct', label: 'llama-3.1-70b' },
  { value: '@cf/google/gemma-4-26b-a4b-it', label: 'gemma-4-26b' },
  { value: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'llama-4-scout-17b' },
  { value: '@cf/ibm-granite/granite-4.0-h-micro', label: 'granite-4.0-h-micro' },
  { value: '@cf/qwen/qwen3.8-27b', label: 'qwen3.8-27b' },
];

export function getAiChatPage(user: {
  name?: string;
  username: string;
  aiChatModel: string;
  aiChatModelConfigured?: boolean;
  fallbackModel?: string;
  availableModels?: Array<{value: string; label: string}>;
  modelColors?: Record<string, string>;
  aichatPreferMoondream?: boolean;
}): string {
  const rubyVersion = getRubyWasmVersionInfo();
  const rubyCacheName = rubyWasmBinaryCacheName(rubyVersion.rubyBuildLine, rubyVersion.wasmWasiPackageVersion);
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
  const aichatPreferMoondreamInit = user.aichatPreferMoondream === false ? 'false' : 'true';
  const modelListJson = JSON.stringify(modelList.map(m => ({ value: m.value, label: m.label })));

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
    ${getCountdownWidgetCSS()}
    ${getCountdownQuickAddModalCSS()}

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
    .zt-bge-model-select {
      font-size: 13px; font-weight: 700; color: var(--text-primary);
      background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px;
      padding: 2px 6px; cursor: pointer; vertical-align: middle;
    }
    .zt-bge-model-select option { background: var(--card-bg); color: var(--text-primary); }
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
    .sq-kw-badge-active { background: var(--kwcat-bg, #ede9fe); color: var(--kwcat-color, #5b21b6); border: 1px solid var(--kwcat-color, #5b21b6); }
    .kw-classify-kw-badge { margin:1px; }
    .kw-kw-classified { border:1.5px solid var(--kw-pal-cls,#7c3aed); color:var(--kw-pal-cls,#7c3aed); background:transparent; }
    .kw-cat-badge-active { border-color:var(--kw-pal-cat,#3b82f6) !important; background:var(--kw-pal-cat-bg,#dbeafe) !important; color:var(--kw-pal-cat,#1d4ed8) !important; }
    [data-theme="dark"] .kw-cat-badge-active { border-color:var(--kw-pal-cat,#60a5fa) !important; background:var(--kw-pal-cat-bg,rgba(59,130,246,0.25)) !important; color:var(--kw-pal-cat,#93c5fd) !important; }
    .kw-cat-badge-dimmed { opacity:.55; }
    .kw-cat-badge-solo-disabled { opacity:.35; pointer-events:none; cursor:default; }
    .kw-group-badge-active { border-color:#3b82f6 !important; background:#3b82f6 !important; color:#fff !important; }
    #kwMidSoloReleaseBtn { padding:6px 16px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-secondary);font-size:12px;cursor:pointer; }
    #kwMidSoloReleaseBtn:hover { background:var(--border-color); color:var(--text-primary); }
    .kw-color-swatch { display:inline-block;width:18px;height:18px;border-radius:3px;margin:1px;cursor:pointer;border:2px solid transparent;box-sizing:border-box;vertical-align:middle; }
    .kw-color-swatch:hover { opacity:0.8; }
    .kw-color-swatch-selected { border-color:var(--text-primary) !important; }
    .kw-q-link { cursor: pointer; text-decoration: underline; text-decoration-color: var(--border-color); text-underline-offset: 2px; }
    .kw-q-link:hover { color: var(--accent-color, #667eea); text-decoration-color: var(--accent-color, #667eea); }
    .hist-kw-chip { display:inline-block; padding:3px 9px; border-radius:12px; font-size:11px; white-space:nowrap; cursor:pointer; box-sizing:border-box; }
    .hist-kw-chip-cls { border:1.5px solid var(--kw-pal-cls,#7c3aed); color:var(--kw-pal-cls,#7c3aed); background:transparent; }
    .hist-kw-chip-unc { background:var(--kw-pal-unc-bg,rgba(0,0,0,0.07)); color:var(--kw-pal-unc-fg,var(--text-secondary,#6b7280)); border:1.5px solid transparent; }
    [data-theme="dark"] .hist-kw-chip-unc { background:var(--kw-pal-unc-bg,rgba(255,255,255,0.1)); color:var(--kw-pal-unc-fg,var(--text-secondary,#9ca3af)); }
    .hist-kw-chip-active { background:var(--kw-pal-act,#6366f1) !important; color:#fff !important; border-color:var(--kw-pal-act,#6366f1) !important; }
    /* 「探索の境界線」パネル(未理解キーワード一覧)。回答をベクタ化する
       たびに更新され、チップを押すと「〇〇について説明してください」を
       入力欄へ差し込む(次の探索を境界線上のキーワードへ誘導する)。 */
    .kb-panel { display:none; flex-wrap:wrap; align-items:center; gap:6px; padding:6px 14px; border-top:1px solid var(--border-color); background:var(--bg-secondary); }
    .kb-panel.kb-panel-visible { display:flex; }
    .kb-panel-label { font-size:11px; color:var(--text-muted); white-space:nowrap; }
    .kb-chip-wrap { display:inline-flex; align-items:center; gap:3px; padding:3px 10px 3px 6px; border-radius:12px; font-size:11px; white-space:nowrap; box-sizing:border-box; border:1.5px solid var(--accent-color,#667eea); background:transparent; }
    .kb-chip-check { width:12px; height:12px; margin:0; cursor:pointer; accent-color:var(--accent-color,#667eea); flex-shrink:0; }
    .kb-chip { border:none; background:transparent; color:var(--accent-color,#667eea); font-size:11px; cursor:pointer; padding:0; }
    .kb-chip:hover { text-decoration:underline; }
    .kb-auto-explore-input { margin-left:auto; width:140px; padding:3px 8px; border-radius:12px; font-size:11px; border:1.5px solid var(--border-color); background:var(--bg-primary,transparent); color:var(--text-primary); }
    .kb-auto-explore-btn { padding:3px 10px; border-radius:12px; font-size:11px; white-space:nowrap; cursor:pointer; border:1.5px solid var(--text-muted); color:var(--text-muted); background:transparent; }
    .kb-auto-explore-btn:hover:not(:disabled) { border-color:var(--accent-color,#667eea); color:var(--accent-color,#667eea); }
    .kb-auto-explore-btn:disabled { opacity:0.6; cursor:default; }
    .kb-auto-explore-btn.kb-running { border-color:#dc2626; color:#dc2626; }
    .kb-progress-log { display:none; max-height:120px; overflow-y:auto; padding:6px 14px; font-family:monospace; font-size:10.5px; line-height:1.5; color:var(--text-muted); background:var(--bg-secondary); border-top:1px solid var(--border-color); white-space:pre; }
    .kb-progress-log.kb-progress-log-visible { display:block; }
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
    .zt-tree-search-wrap { padding: 10px 16px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
    .zt-tree-search-input {
      width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border-radius: 6px;
      border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);
    }
    .zt-tree-search-input:focus { outline: none; border-color: var(--accent-color, #667eea); }
    .zt-tree-body { flex: 1; overflow-y: auto; padding: 10px 16px; font-family: monospace; font-size: 12px; line-height: 1.9; }
    .zt-line { white-space: nowrap; }
    .zt-group-line { font-weight: 700; color: var(--text-primary); margin-top: 6px; }
    .zt-node { cursor: pointer; }
    .zt-node:hover { background: var(--bg-secondary); }
    .zt-kw-line { color: var(--text-secondary); }
    .zt-toggle { display: inline-block; width: 14px; color: var(--text-muted); }
    .zt-object { color: #63b3ed; }
    .zt-relation { color: #f6ad55; }
    .zt-subject { color: #68d391; }
    .zt-count { color: var(--text-muted); margin-left: 4px; }
    .zt-hl { background: rgba(246, 173, 85, 0.45); color: inherit; border-radius: 2px; }
    .zt-bge-btn { background: none; border: none; cursor: pointer; font-size: 16px; padding: 2px 4px; flex-shrink: 0; }
    .zt-bge-btn:hover { opacity: 0.7; }
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
    .csearch-answer-link { color: var(--accent-color); cursor: pointer; text-decoration: none; }
    .qsearch-id-link { color: var(--accent-color); cursor: pointer; text-decoration: none; }
    .csearch-result-table .csearch-created-at { white-space: nowrap; color: var(--text-muted, var(--text-secondary)); font-size: 12px; }
    .csearch-result-table td { word-break: break-word; white-space: normal; }
    .qsearch-result-table td { word-break: break-word; white-space: normal; }
    .qsearch-result-table .qsearch-id-link { white-space: nowrap; }
    #cursorAgentAnswerModal .search-log-modal { width: min(840px, 96vw); }
    #cursorAgentAnswerModalBody {
      word-break: break-word; font-size: 13px;
      color: var(--text-primary); background: var(--bg-secondary);
      padding: 12px; border-radius: 8px; margin: 0; font-family: inherit;
      white-space: normal;
    }
    #qsearchAnswerModal .search-log-modal { width: min(840px, 96vw); }
    #qsearchAnswerModalBody {
      word-break: break-word; font-size: 13px;
      color: var(--text-primary); background: var(--bg-secondary);
      padding: 12px; border-radius: 8px; margin: 0; font-family: inherit;
      white-space: normal;
    }

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
    .token-usage-gran-btn {
      font-size: 10px; padding: 1px 7px; border: 1px solid var(--border-color);
      border-radius: 4px; background: none; color: var(--text-muted); cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .token-usage-gran-btn.active { background: var(--accent-color, #667eea); color: #fff; border-color: var(--accent-color, #667eea); }
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
      justify-content: space-between; align-items: flex-start;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-primary);
    }
    .sidebar-kw-item:hover { background: var(--bg-secondary); }
    .sidebar-kw-item.selected { background: rgba(102,126,234,0.12); }
    .sidebar-kw-count { font-size: 10px; color: var(--text-muted); flex-shrink: 0; margin-left: 6px; }
    .kw-model-tag { display:inline-block; font-size:9px; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:3px; padding:0 3px; margin:1px 2px 1px 0; vertical-align:middle; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

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
    .sidebar-log-btn { background:none; border:none; cursor:pointer; font-size:14px; padding:0 4px; line-height:1; opacity:0.5; flex-shrink:0; }
    .sidebar-log-btn:hover { opacity:1; }
    .canvas-search-btn { background:none; border:none; cursor:pointer; font-size:14px; padding:0 4px; line-height:1; opacity:0.6; flex-shrink:0; }
    .sidebar-search-target-btn { background:none; border:none; cursor:pointer; font-size:14px; padding:0 4px; line-height:1; opacity:0.3; flex-shrink:0; }
    .sidebar-search-target-btn:hover { opacity:0.6; }
    .sidebar-search-target-btn.active { opacity:1; }
    .canvas-search-btn:hover { opacity:1; }
    .canvas-search-input-wrap { position:relative; padding:10px 16px; border-bottom:1px solid var(--border-color); flex-shrink:0; }
    .canvas-search-input {
      width:100%; box-sizing:border-box; padding:7px 10px; font-size:12px; border-radius:6px;
      border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-primary);
    }
    .canvas-search-input:focus { outline:none; border-color:var(--accent-color,#667eea); }
    .canvas-search-status { font-size:10px; color:var(--text-muted); padding:0 16px 8px; flex-shrink:0; }
    .canvas-search-canvas-wrap { flex:1; overflow-y:auto; padding:0 16px 16px; }
    #canvasSearchCanvas { display:block; width:100%; }
    .result-model-label { font-size:9px; color:var(--text-muted); background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:3px; padding:0 3px; margin-right:4px; vertical-align:middle; }
    .slm-entry { border:1px solid var(--border-color); border-radius:6px; padding:10px 12px; margin-bottom:8px; background:var(--card-bg); }
    .slm-entry-new { border:2px solid #e53e3e; background:transparent; }
    .slm-entry-registered { background:#f0fdf4; border:1px solid #bbf7d0; }
    .slm-entry-new-badge { display:inline-block; font-size:9px; color:#e53e3e; border:1px solid #e53e3e; border-radius:3px; padding:0 4px; margin-left:6px; vertical-align:middle; }
    .slm-entry-reg-badge { display:inline-block; font-size:9px; color:#16a34a; border:1px solid #86efac; border-radius:3px; padding:0 4px; margin-left:6px; vertical-align:middle; }
    .slm-kw { font-size:11px; font-weight:600; color:var(--text-primary); }
    .slm-model { font-size:10px; color:var(--text-secondary); margin-top:2px; }
    .slm-id { font-size:9px; color:var(--text-muted); margin-top:2px; font-family:monospace; }
    .slm-q { font-size:10px; color:var(--text-muted); margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .sidebar-results {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column; min-height: 0;
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
      cursor: pointer;
    }
    .model-color-dot:hover { opacity: 0.75; }
    .model-dot-dropdown {
      position: fixed;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      min-width: 220px;
      overflow: hidden;
      display: none;
    }
    .model-dot-dropdown.open { display: block; }
    .model-dot-dropdown-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px; cursor: pointer;
      font-size: 12px; color: var(--text-primary);
      transition: background 0.1s;
      white-space: nowrap;
    }
    .model-dot-dropdown-item:hover { background: var(--bg-secondary); }
    .model-dot-dropdown-item.selected { font-weight: 600; background: var(--bg-secondary); }
    .model-dot-dropdown-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
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
    .history-modal-chat.highlights-hidden .kw-highlight { background: transparent; color: inherit; outline: none; }

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
      cursor: pointer; position: relative;
      transition: transform 0.1s;
    }
    .cal-cell:hover { transform: scale(1.12); z-index: 1; }
    .cal-cell.empty { background: transparent; cursor: default; pointer-events: none; }
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
    .history-modal-backdrop.fullscreen { padding: 0; }
    .history-modal {
      width: min(720px, 100%); max-height: min(86vh, 760px);
      background: var(--bg-primary, #f8fafc); border: 1px solid var(--border-color);
      border-radius: 16px; box-shadow: 0 24px 80px rgba(0,0,0,0.28);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .history-modal.fullscreen {
      width: 100%; height: 100%; max-height: 100%;
      border-radius: 0; border: none;
    }
    .history-modal.fullscreen.frames-hidden > .history-modal-foot {
      display: none;
    }
    .history-modal.fullscreen.frames-hidden > .history-modal-head {
      position: absolute; top: 8px; right: 8px; z-index: 1;
      padding: 0; background: transparent; border: none;
    }
    .history-modal.fullscreen.frames-hidden > .history-modal-head > :not(.history-modal-fullscreen-btn) {
      display: none;
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
    .history-modal-fullscreen-btn {
      width: 30px; height: 30px; border: none; border-radius: 8px;
      background: transparent; color: var(--text-muted); cursor: pointer; font-size: 14px; line-height: 1;
    }
    .history-modal-fullscreen-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
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
    /* kimi-gemma専用: 回答バブル(生成コード)に対する外部レビューの注釈カード。
       「回答そのもの」と混同されないよう、通常の吹き出しとは別要素・別配色で
       表示する(質問→回答→回答へのレビュー、という2段構造を視覚的に示す)。 */
    .review-note-card {
      align-self: flex-end; max-width: 88%; margin-top: -6px;
      background: var(--bg-secondary); border: 1px dashed var(--border-color); border-radius: 8px;
      padding: 8px 12px; font-size: 12px;
    }
    .review-note-card .review-note-label {
      font-weight: 700; font-size: 11px; color: var(--accent-color, #667eea); margin-bottom: 4px;
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

    /* ======= 送信結果トースト ======= */
    /* フォールバックせず指定中のモデルで処理されたか、フォールバックして
       別モデルに切り替わったかを、送信直後に画面上部のトーストで明示する
       (回答バブルの表示だけでは、フォールバックの結果なのか単なる表示上の
       色/ラベルの取り違えなのか利用者が判断できないため)。 */
    .aichat-send-toast-container {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 10000; display: flex; flex-direction: column; gap: 8px;
      pointer-events: none; align-items: center;
    }
    .aichat-send-toast {
      padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 700;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2); pointer-events: auto;
      animation: aichatSendToastIn 0.2s ease-out; transition: opacity 0.3s ease-out;
      white-space: nowrap;
    }
    .aichat-send-toast.aichat-send-toast-ok { background: #c6f6d5; color: #22543d; }
    .aichat-send-toast.aichat-send-toast-fade { opacity: 0; }
    @keyframes aichatSendToastIn {
      from { transform: translateY(-12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* ======= ✂️切り出し(ベクタ化+キーワード一括登録)の進行トースト ======= */
    /* ✂️ボタンは押しても見た目の変化が背景色の一瞬の切り替えだけで、
       「本当に何か起きたのか」が利用者に伝わりにくかった(実際には動作は
       していたが無反応に見える不具合の原因)。処理の各段階が終わるたびに
       トーストで明示する。 */
    .aichat-send-toast.aichat-scissors-toast-cyan { background: #bee3f8; color: #1a365d; }
    .aichat-send-toast.aichat-scissors-toast-neutral { background: #e2e8f0; color: #2d3748; }
    @keyframes scissorsBtnSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .scissors-btn-spinning { display: inline-block; animation: scissorsBtnSpin 0.8s linear infinite; }

    /* ======= チャット本体 ======= */
    .chat-wrapper {
      flex: 1; display: flex; flex-direction: column;
      max-width: 80%; width: 100%; margin: 0 auto;
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
    /* ユーザー入力もMarkdownとして描画する(parseMd経由)ため、アクセントカラーの
       背景でも読めるよう .preview-area の既定色(var(--text-primary)等)を上書きする */
    .chat-bubble.user.preview-area h1, .chat-bubble.user.preview-area h2, .chat-bubble.user.preview-area h3,
    .chat-bubble.user.preview-area h4, .chat-bubble.user.preview-area h5, .chat-bubble.user.preview-area h6 {
      color: #fff; border-bottom-color: rgba(255,255,255,0.35);
    }
    .chat-bubble.user.preview-area blockquote {
      background: rgba(255,255,255,0.12); border-left-color: rgba(255,255,255,0.6); color: #fff;
    }
    .chat-bubble.user.preview-area code, .chat-bubble.user.preview-area pre {
      background: rgba(255,255,255,0.16); color: #fff;
    }
    .chat-bubble.user.preview-area th, .chat-bubble.user.preview-area td {
      border-color: rgba(255,255,255,0.35);
    }
    .chat-bubble.user.preview-area th { background: rgba(255,255,255,0.14); color: #fff; }
    .chat-bubble.user.preview-area a { color: #fff; text-decoration: underline; }
    .chat-bubble.user.preview-area hr { border-top-color: rgba(255,255,255,0.35); }
    .chat-bubble.assistant {
      align-self: flex-start; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-primary); border-bottom-left-radius: 3px;
      position: relative; padding-bottom: 28px;
    }
    .bubble-copy-btn {
      position: absolute; bottom: 5px; left: 8px;
      background: none; border: 1px solid var(--border-color); border-radius: 5px;
      padding: 1px 7px; font-size: 11px; color: var(--text-muted); cursor: pointer;
      line-height: 1.6;
    }
    .bubble-copy-btn:hover { background: var(--bg-secondary); }
    .bubble-copy-btn.copied { color: var(--success-color, #48bb78); border-color: var(--success-color, #48bb78); }
    .neko-results-link-row { margin-top: 8px; }
    .neko-svg-chart { margin-top: 10px; }
    .neko-svg-chart svg { max-width: 100%; height: auto; display: block; }
    .neko-results-link { font-size: 12px; color: var(--accent-color, #667eea); text-decoration: none; }
    .neko-results-link:hover { text-decoration: underline; }
    .tlist-register-btn {
      margin-left: 10px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 3px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      vertical-align: middle;
    }
    .tlist-register-btn:hover { background: #5568d3; }
    .chat-bubble.error {
      align-self: flex-start; background: rgba(207,34,46,0.08); border: 1px solid rgba(207,34,46,0.3); color: #cf222e;
    }
    [data-theme="dark"] .chat-bubble.error {
      background: rgba(252,129,129,0.12); border-color: rgba(252,129,129,0.4); color: #fc8181;
    }
    .chat-bubble.thinking {
      align-self: flex-start; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-muted); font-style: italic;
    }
    /* ======= /neko gh pr list の応答バブル ======= */
    /* 右端の余白をゼロにし、表(No./タイトル/作成者/状態)を目一杯まで広げる */
    .chat-bubble.assistant.gh-pr-list-bubble { padding-right: 0; }
    .gh-pr-list-bubble table { width: 100%; }
    .gh-pr-list-bubble td a { text-decoration: none; }
    .gh-pr-state-badge {
      display: inline-block; padding: 2px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 600; line-height: 1.6; white-space: nowrap;
    }
    .gh-pr-state-badge.gh-pr-state-open { background: #dafbe1; color: #1a7f37; }
    .gh-pr-state-badge.gh-pr-state-draft { background: #f6f8fa; color: #656d76; border: 1px solid #d0d7de; }
    .gh-pr-state-badge.gh-pr-state-closed { background: #ffebe9; color: #cf222e; }
    [data-theme="dark"] .gh-pr-state-badge.gh-pr-state-open { background: rgba(63,185,80,0.18); color: #3fb950; }
    [data-theme="dark"] .gh-pr-state-badge.gh-pr-state-draft { background: rgba(139,148,158,0.18); color: #8b949e; border-color: #30363d; }
    [data-theme="dark"] .gh-pr-state-badge.gh-pr-state-closed { background: rgba(248,81,73,0.18); color: #f85149; }
    /* コンフリクト列: 状態列とは別配色(あり=ピンク/なし=薄緑/確認中=グレー) */
    .gh-pr-state-badge.gh-pr-conflict-yes { background: #ffd7e6; color: #9e1f5c; }
    .gh-pr-state-badge.gh-pr-conflict-no { background: #d4f5d4; color: #1a7f37; }
    .gh-pr-state-badge.gh-pr-conflict-unknown { background: #f6f8fa; color: #656d76; border: 1px solid #d0d7de; }
    [data-theme="dark"] .gh-pr-state-badge.gh-pr-conflict-yes { background: rgba(255,143,193,0.18); color: #ff8fc1; }
    [data-theme="dark"] .gh-pr-state-badge.gh-pr-conflict-no { background: rgba(63,185,80,0.18); color: #3fb950; }
    [data-theme="dark"] .gh-pr-state-badge.gh-pr-conflict-unknown { background: rgba(139,148,158,0.18); color: #8b949e; border-color: #30363d; }
    /* 見出し(h2)を「タイトル中央寄せ + Draft/Openバッジを右端」の1行に配置する */
    .gh-pr-list-heading { display: flex; align-items: center; }
    .gh-pr-list-heading-title { flex: 1; text-align: center; }
    .gh-pr-list-heading-badges { display: flex; align-items: center; gap: 6px; }
    .chat-bubble-wrap { align-self: flex-start; display: flex; flex-direction: column; gap: 3px; max-width: 85%; }
    .chat-bubble-wrap .chat-bubble.assistant { align-self: auto; max-width: 100%; }
    /* /neko系ローカルコマンド(clog等の表・テーブル表示)はchat-bubble-wrapで
       包まれず基本の.chat-bubble(max-width:85%)のまま描画されるため、
       AIモデル応答(100%)と揃うようassistant.preview-are全体を100%にする */
    .chat-bubble.assistant.preview-area { max-width: 100%; }
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
    .chat-attach-btn {
      width: 40px; height: 40px; flex-shrink: 0; border-radius: 8px; border: 1px solid var(--border-color);
      background: var(--card-bg); color: var(--text-secondary); font-size: 20px; font-weight: 600; line-height: 1;
      cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s, color 0.15s;
    }
    .chat-attach-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
    .chat-attach-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .chat-image-preview-row { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
    .chat-image-preview-thumb { position: relative; display: inline-flex; }
    .chat-image-preview-thumb img {
      width: 56px; height: 56px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color); display: block;
    }
    .chat-image-preview-remove {
      position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%;
      background: var(--color-error, #cf222e); color: #fff; border: none; font-size: 11px; line-height: 1;
      cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;
    }
    .chat-bubble-image {
      max-width: 220px; max-height: 220px; border-radius: 8px; display: block; margin-bottom: 6px; object-fit: cover;
    }
    .moondream-analysis {
      margin-top: 10px; background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 6px; padding: 8px 10px; width: 100%; max-width: 100%; min-width: 0;
    }
    .moondream-analysis-label { font-size: 11px; font-weight: 600; color: var(--accent-color); margin-bottom: 4px; }
    .moondream-analysis-body {
      min-width: 0; max-width: 100%; font-size: 12px; color: var(--text-secondary);
      white-space: normal; line-height: 1.6; overflow-wrap: anywhere; word-break: break-word;
    }
    /* Moondreamは列数の多い表や長いコード/URLを返すことがある。文章は折り返し、
       折り返すと読みにくい表とコードだけをパネル内で横スクロール可能にする。 */
    .moondream-analysis-body table {
      display: block; width: max-content; min-width: 100%; max-width: 100%; overflow-x: auto;
    }
    .moondream-analysis-body th, .moondream-analysis-body td { overflow-wrap: normal; word-break: normal; }
    .moondream-analysis-body pre { max-width: 100%; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="aichat-send-toast-container" id="aichatSendToastContainer"></div>
  <!-- ナビバー -->
  <nav class="navbar">
    <button class="sidebar-toggle" id="sidebarToggle" title="履歴検索">☰</button>
    <a href="/welcome" class="navbar-brand">🤖 AI チャット</a>
    <span id="modelColorDot" class="model-color-dot" title="モデル切り替え"></span><div id="modelDotDropdown" class="model-dot-dropdown"></div><select id="modelSelect" class="navbar-model-select">${modelOptionsHtml}</select>
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
      <button class="search-hist-btn" id="kwClassifyBtn" title="キーワード分類">🔑分類</button>
      <button class="search-hist-btn" id="ztTreeBtn" title="Zanzibar形式分類ツリー">ZT</button>
      ${getThemeToggleHTML()}
      <span class="user-name">${displayName}</span>
      ${getCountdownWidgetHTML()}
      ${getCountdownQuickAddModalHTML()}
      <div class="user-menu-container">
        <div class="user-icon" id="userIcon">${initials}</div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/thread-tracker" class="dropdown-item">🧵 スレッド追跡</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/function-changelog" class="dropdown-item">🔖 関数辞典</a>
          <a href="/userinfo" class="dropdown-item">👤 ユーザー情報</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/status" class="dropdown-item">📊 キャッシュ状況</a>
          <a href="/api-keys" class="dropdown-item">🔑 キー管理</a>
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
          <input class="sidebar-search" id="sidebarSearch" type="search" placeholder="履歴を検索...(llama-4)" autocomplete="off">
          <button class="sidebar-search-clear" id="sidebarClear" tabindex="-1">✕</button>
        </div>
      </div>
      <div class="sidebar-status-row">
        <div class="sidebar-status" id="sidebarStatus" style="flex:1;font-size:10px;color:var(--text-muted);"></div>
        <button class="canvas-search-btn" id="canvasSearchBtn" title="質問・回答・キーワードをキャンバス表示" style="display:none;">⁂</button>
        <button class="sidebar-log-btn" id="searchLogRecordBtn" title="検索ログをモーダルに書き出す" style="display:none;">📋</button>
        <button class="sidebar-search-target-btn" id="sidebarSearchTargetBtn" title="検索対象: llama-4(質問・回答)。クリックで切替(moondream3.1→kimi-gemma→llama-4)">🖼️</button>
        <div class="sidebar-mode-toggle" id="sidebarModeToggle" style="display:none;">
          <button class="sidebar-mode-btn" id="sidebarModeNew">新着</button>
          <button class="sidebar-mode-btn" id="sidebarModeKw">キーワード</button>
        </div>
      </div>
      <div class="sidebar-results" id="sidebarResults"></div>

      <!-- カレンダーヒートマップ -->
      <div class="sidebar-calendar" id="sidebarCalendar">
        <div class="cal-head">
          <div style="display:flex;align-items:center;gap:3px;flex:1;min-width:0;overflow:hidden;">
            <button class="cal-nav-btn" id="dailyStatsBtn" title="日ごとキーワード数・質問数グラフ" style="font-size:13px;padding:0 4px;flex-shrink:0;">📈</button>
            <span class="cal-title" id="calTitle" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
          </div>
          <div class="cal-nav">
            <button class="cal-nav-btn" id="calPrev" title="前月">‹</button>
            <button class="cal-nav-btn" id="calNext" title="翌月">›</button>
            <button class="cal-nav-btn" id="tokenUsageBtn" title="モデル別トークン使用量" style="font-size:13px;padding:0 5px;">📊</button>
          </div>
        </div>
        <div class="cal-grid" id="calGrid"></div>
      </div>
    </div>

    <!-- トークン使用量モーダル -->
    <div class="search-log-overlay" id="tokenUsageModal" aria-hidden="true" style="z-index:820;">
      <div class="search-log-modal" style="max-width:620px;">
        <div class="search-log-head">
          <span class="search-log-title">📊 モデル別トークン使用量</span>
          <div class="token-usage-granularity" style="display:flex;gap:4px;margin-left:auto;margin-right:8px;">
            <button type="button" id="tokenUsageGranMonth" class="token-usage-gran-btn active" data-granularity="month">月毎</button>
            <button type="button" id="tokenUsageGranDay" class="token-usage-gran-btn" data-granularity="day">日毎</button>
          </div>
          <button id="tokenUsageClose">✕</button>
        </div>
        <div class="search-log-body" id="tokenUsageBody" style="padding:16px;overflow-y:auto;max-height:70vh;">
          <div class="search-log-loading">読み込み中...</div>
        </div>
      </div>
    </div>

    <!-- Jev評価値(jev_label_id 1〜20)モーダル -->
    <div class="search-log-overlay" id="jevValuesModal" aria-hidden="true" style="z-index:820;">
      <div class="search-log-modal" style="max-width:720px;">
        <div class="search-log-head">
          <span class="search-log-title">📔 Jev評価値</span>
          <button class="search-log-close" id="jevValuesClose" aria-label="閉じる">✕</button>
        </div>
        <div class="search-log-body" id="jevValuesBody" style="padding:16px;overflow-y:auto;max-height:70vh;">
          <div class="search-log-loading">読み込み中...</div>
        </div>
      </div>
    </div>

    <!-- 日ごとキーワード数・質問数グラフモーダル -->
    <div class="search-log-overlay" id="dailyStatsModal" aria-hidden="true" style="z-index:820;">
      <div class="search-log-modal" style="max-width:720px;">
        <div class="search-log-head">
          <span class="search-log-title">📈 日ごとキーワード数・質問数</span>
          <div style="display:flex;align-items:center;gap:4px;">
            <button class="cal-nav-btn" id="dailyStatsPrev" title="前月">‹</button>
            <span id="dailyStatsTitle" style="font-size:11px;color:var(--text-muted);min-width:64px;text-align:center;white-space:nowrap;"></span>
            <button class="cal-nav-btn" id="dailyStatsNext" title="翌月">›</button>
            <button class="search-log-close" id="dailyStatsClose" aria-label="閉じる">✕</button>
          </div>
        </div>
        <div class="search-log-body" id="dailyStatsBody" style="padding:16px;overflow-y:auto;max-height:70vh;">
          <div class="search-log-loading">読み込み中...</div>
        </div>
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
      <!-- 「探索の境界線」パネル: ベクタ化済みキーワードのうちまだどの
           カテゴリにも分類されていないもの(aichat_keyword_category_map
           未登録)を並べる。チップを押すと「〇〇について説明してください」が
           入力欄に入り、次の質問がすぐ送れる。回答のベクタ化(✂️)のたびに
           更新される。「自動探索」ボタンは、入力待ちを挟まず未分類
           キーワードへ次々に問い合わせる(最大3階層)。 -->
      <div class="kb-panel" id="keywordBoundaryPanel">
        <span class="kb-panel-label">🧭 まだ分類されていないキーワード:</span>
        <div id="keywordBoundaryChips" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
        <input type="text" class="kb-auto-explore-input" id="autoExploreManualInput" placeholder="キーワードを入力して探索" title="チェックボックスの一覧に無いキーワードも、ここに入力して自動探索ボタンを押せば起点に追加される">
        <button type="button" class="kb-auto-explore-btn" id="autoExploreBtn" title="チェックした(または入力した)キーワードを起点に、入力待ちを挟まず最大3階層まで自動で問い合わせる">🧭 自動探索</button>
      </div>
      <!-- 自動探索の途中経過ログ。AI問い合わせ→Jev処理→キー切り出しの
           各段階の開始・完了時刻と所要時間を、実行中だけ表示する。 -->
      <div class="kb-progress-log" id="autoExploreProgressLog"></div>
      <div class="chat-form-area">
        <div class="chat-image-preview-row" id="chatImagePreviewRow" style="display:none;">
          <div class="chat-image-preview-thumb">
            <img id="chatImagePreviewImg" src="" alt="添付画像プレビュー">
            <button type="button" class="chat-image-preview-remove" id="chatImagePreviewRemove" title="添付を取り消す">✕</button>
          </div>
        </div>
        <form class="chat-form" id="chatForm">
          <button type="button" class="chat-attach-btn" id="chatAttachBtn" title="写真を送る">＋</button>
          <input type="file" id="chatImageInput" accept="image/*" style="display:none;">
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
      <div class="results-panel-col" id="resultsPanelReviewCol" style="display:none;">
        <div class="results-col-label" id="resultsPanelReviewLabel"></div>
        <div class="results-col-text preview-area" id="resultsPanelReview"></div>
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

  <div class="search-log-overlay" id="nekoResultsModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true">
      <div class="search-log-head">
        <span class="search-log-title" id="nekoResultsModalTitle">/neko 結果一覧（最大30件）</span>
        <button class="search-log-close" id="nekoResultsModalClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="nekoResultsModalBody"></div>
    </div>
  </div>

  <div class="search-log-overlay" id="cursorAgentAnswerModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true" aria-labelledby="cursorAgentAnswerModalTitle">
      <div class="search-log-head">
        <span class="search-log-title" id="cursorAgentAnswerModalTitle">回答全文</span>
        <button class="search-log-close" id="cursorAgentAnswerModalClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body">
        <div id="cursorAgentAnswerModalBody" class="preview-area"></div>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="qsearchAnswerModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true" aria-labelledby="qsearchAnswerModalTitle">
      <div class="search-log-head">
        <span class="search-log-title" id="qsearchAnswerModalTitle">最新の回答</span>
        <button class="search-log-close" id="qsearchAnswerModalClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body">
        <div id="qsearchAnswerModalBody" class="preview-area"></div>
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
        <button id="linkedQuestionsSortToggle" style="font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-secondary);cursor:pointer;white-space:nowrap;flex-shrink:0;" title="並び順を切り替える">現状順</button>
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
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="search-log-title">サブクエリ一覧</span>
          <button class="search-hist-btn" id="subqueriesAddBtn">＋ 新規追加</button>
        </div>
        <button class="search-log-close" id="subqueriesClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="subqueriesBody">
        <div class="subqueries-add-area" id="subqueriesAddArea">
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

  <div class="search-log-overlay" id="kwClassifyListModal" aria-hidden="true" style="z-index:820;">
    <div class="search-log-modal" role="dialog" aria-modal="true" style="max-width:560px;">
      <div class="search-log-head">
        <span class="search-log-title">🔑 キーワード分類</span>
        <div style="display:flex;align-items:center;gap:6px;flex:1;margin-left:10px;">
          <input id="kwClassifySearchInput" type="search" placeholder="キーワードを検索…" autocomplete="off" style="flex:1;min-width:0;padding:4px 10px;border:1px solid var(--border-color);border-radius:6px;font-size:12px;background:var(--bg-primary);color:var(--text-primary);outline:none;" />
        </div>
        <div style="display:flex;align-items:center;gap:4px;margin-left:6px;">
          <button id="kwColorPaletteBtn" title="配色カスタマイズ" style="background:none;border:none;cursor:pointer;font-size:16px;padding:2px 4px;line-height:1;">🎨</button>
          <button class="search-log-close" id="kwClassifyListClose" aria-label="閉じる">✕</button>
        </div>
      </div>
      <div class="search-log-body" id="kwClassifyListBody" style="padding:12px 16px;">
        <div class="search-log-loading">読み込み中...</div>
      </div>
    </div>
  </div>

  ${((): string => {
    const PALETTE_ROWS = [
      ['#fecaca','#f87171','#ef4444','#dc2626','#991b1b'],
      ['#fed7aa','#fb923c','#f97316','#ea580c','#9a3412'],
      ['#fef08a','#a3e635','#84cc16','#65a30d','#365314'],
      ['#a5f3fc','#22d3ee','#06b6d4','#0891b2','#155e75'],
      ['#bfdbfe','#60a5fa','#3b82f6','#2563eb','#1e3a8a'],
      ['#e9d5ff','#c084fc','#a855f7','#7c3aed','#4c1d95'],
      ['#fbcfe8','#f472b6','#ec4899','#db2777','#831843'],
      ['#f1f5f9','#94a3b8','#64748b','#334155','#0f172a'],
    ];
    const swatchRows = PALETTE_ROWS.map(row =>
      '<div>' + row.map(c => `<span class="kw-color-swatch" data-color="${c}" style="background:${c}" title="${c}"></span>`).join('') + '</div>'
    ).join('');
    const sections = [
      { key: 'cat', label: '分類カテゴリの配色' },
      { key: 'cls', label: '分類済みキーワードの色' },
      { key: 'unc', label: '未分類キーワードの色' },
      { key: 'act', label: '選択中の分類カテゴリ内のキーワードの色' },
    ].map(s =>
      `<div style="margin-bottom:14px;" data-palette-key="${s.key}">` +
      `<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">${s.label}</div>` +
      swatchRows +
      `</div>`
    ).join('');
    return `<div class="search-log-overlay" id="kwColorPaletteModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true" style="max-width:400px;">
      <div class="search-log-head">
        <span class="search-log-title">🎨 配色カスタマイズ</span>
        <button class="search-log-close" id="kwColorPaletteClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="kwColorPaletteBody" style="padding:16px;overflow-y:auto;max-height:70vh;">
        ${sections}
        <div style="text-align:right;margin-top:12px;">
          <button id="kwColorPaletteConfirm" style="font-size:12px;padding:5px 16px;border-radius:4px;border:1px solid var(--border-color);background:var(--accent-color,#667eea);color:#fff;cursor:pointer;">決定</button>
        </div>
      </div>
    </div>
  </div>`;
  })()}

  <div class="search-log-overlay" id="searchLogRecordModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true" style="max-width:520px;">
      <div class="search-log-head">
        <span class="search-log-title" id="searchLogRecordTitle">📋 検索ログ</span>
        <button class="search-log-close" id="searchLogRecordClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="searchLogRecordModalBody" style="padding:12px 16px;overflow-y:auto;max-height:calc(70vh - 56px);">
        <div class="search-log-loading">読み込み中...</div>
      </div>
      <div style="padding:10px 16px;border-top:1px solid var(--border-color);display:flex;justify-content:flex-end;gap:8px;">
        <button id="searchLogApproveBtn" style="display:none;padding:7px 18px;font-size:12px;border-radius:5px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-weight:600;">承認して登録</button>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="canvasSearchModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true" style="max-width:760px;">
      <div class="search-log-head">
        <span class="search-log-title" id="canvasSearchTitle">⁂ 質問・回答キャンバス</span>
        <button class="search-log-close" id="canvasSearchClose" aria-label="閉じる">✕</button>
      </div>
      <div class="canvas-search-input-wrap">
        <input class="canvas-search-input" id="canvasSearchInput" type="search" placeholder="キーワードで絞り込み..." autocomplete="off">
      </div>
      <div class="canvas-search-status" id="canvasSearchStatus"></div>
      <div class="canvas-search-canvas-wrap">
        <canvas id="canvasSearchCanvas" width="720" height="200"></canvas>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="ztTreeModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true" style="max-width:640px;">
      <div class="search-log-head">
        <span class="search-log-title">🔗 Zanzibar分類ツリー</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="sync-repo-colors-btn" id="ztOverviewBtn" type="button" style="font-size:11px;padding:4px 10px;" title="ベクタ化済みデータ一覧を表示">📖</button>
          <button class="search-log-close" id="ztTreeClose" aria-label="閉じる">✕</button>
        </div>
      </div>
      <div class="zt-tree-search-wrap" style="display:flex;gap:6px;align-items:center;">
        <input class="zt-tree-search-input" id="ztTreeSearchInput" type="search" placeholder="キーワード・カテゴリで検索..." autocomplete="off" style="flex:1;">
        <button class="zt-bge-btn" id="ztCacheBtn" title="埋め込みキャッシュを表示" style="display:none;">📖</button>
        <button class="zt-bge-btn" id="ztBgeBtn" title="問い合わせデータを表示" style="display:none;">🗒️</button>
      </div>
      <div class="zt-tree-body" id="ztTreeBody"><div class="search-log-loading">読み込み中...</div></div>
    </div>
  </div>

  <div class="search-log-overlay" id="ztOverviewModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true" style="max-width:640px;">
      <div class="search-log-head">
        <span class="search-log-title">📖 ベクタ化済みデータ一覧</span>
        <div style="display:flex;align-items:center;gap:4px;">
          <input type="search" id="ztOverviewKeywordSearchInput" placeholder="キーワードで検索..." autocomplete="off" style="font-size:11px;padding:3px 6px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-secondary);color:var(--text-primary);width:120px;">
          <button class="search-log-close" id="ztOverviewChartToggle" aria-label="円グラフ表示切替" title="埋め込みモデル別 登録済みキーワード率の円グラフ表示切替">📊</button>
          <button class="search-log-close" id="ztOverviewClose" aria-label="閉じる">✕</button>
        </div>
      </div>
      <div id="ztOverviewChartSection" style="padding:10px 14px 0;"></div>
      <div class="search-log-body" id="ztOverviewBody" style="font-size:12px;max-height:60vh;overflow-y:auto;"><div class="search-log-loading">読み込み中...</div></div>
    </div>
  </div>

  <div class="search-log-overlay" id="ztKeywordSharesModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true" style="max-width:600px;">
      <div class="search-log-head">
        <span class="search-log-title" id="ztKeywordSharesTitle">🔎 関連する会話</span>
        <button class="search-log-close" id="ztKeywordSharesClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="ztKeywordSharesBody" style="font-size:12px;max-height:60vh;overflow-y:auto;"><div class="search-log-loading">読み込み中...</div></div>
    </div>
  </div>

  <div class="search-log-overlay" id="ztBgeModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true" style="max-width:600px;">
      <div class="search-log-head">
        <span class="search-log-title">🗒️ <select id="ztBgeModelSelect" class="zt-bge-model-select"><option value="@cf/baai/bge-m3">bge-m3</option><option value="@cf/pfnet/plamo-embedding-1b">plamo-embedding-1b</option><option value="@cf/google/embeddinggemma-300m">embeddinggemma-300m</option></select> 問い合わせデータ</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="sync-repo-colors-btn" id="ztBgeCopyBtn" type="button" style="font-size:11px;padding:4px 10px;">📋 コピー</button>
          <button class="search-log-close" id="ztBgeClose" aria-label="閉じる">✕</button>
        </div>
      </div>
      <div class="search-log-body" id="ztBgeBody" style="font-family:monospace;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-all;max-height:60vh;"></div>
      <div style="padding:10px 16px;border-top:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <span id="ztBgeRegisterStatus" style="font-size:11px;color:var(--text-muted);"></span>
        <button id="ztBgeRegisterBtn" type="button" style="padding:7px 18px;font-size:12px;border-radius:5px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-weight:600;white-space:nowrap;">登録する</button>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="ztCacheModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true" style="max-width:640px;">
      <div class="search-log-head">
        <span class="search-log-title">📖 埋め込みキャッシュ</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="sync-repo-colors-btn" id="ztCacheAnalyzeBtn" type="button" style="font-size:11px;padding:4px 10px;">🔍 分析</button>
          <button class="search-log-close" id="ztCacheClose" aria-label="閉じる">✕</button>
        </div>
      </div>
      <div class="search-log-body" id="ztCacheBody" style="font-family:monospace;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-all;max-height:30vh;"></div>
      <div id="ztCacheSimilarWrap" style="display:none;border-top:1px solid var(--border-color);padding:10px 16px;max-height:40vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <label for="ztCacheThresholdSlider" style="font-size:11px;color:var(--text-muted);white-space:nowrap;">類似度閾値</label>
          <input type="range" id="ztCacheThresholdSlider" min="0.5" max="1" step="0.01" value="0.75" style="flex:1;">
          <span id="ztCacheThresholdValue" style="font-size:11px;color:var(--text-secondary);width:38px;text-align:right;">75%</span>
        </div>
        <div id="ztCacheSimilarBody" style="font-size:12px;"></div>
      </div>
    </div>
  </div>

  <div class="search-log-overlay" id="kwCatGroupModal" aria-hidden="true">
    <div class="search-log-modal" role="dialog" aria-modal="true" style="max-width:480px;">
      <div class="search-log-head">
        <span class="search-log-title">🗂 大分類カテゴリに束ねる</span>
        <button class="search-log-close" id="kwCatGroupClose" aria-label="閉じる">✕</button>
      </div>
      <div class="search-log-body" id="kwCatGroupBody" style="padding:16px;overflow-y:auto;max-height:70vh;">
        <div class="search-log-loading">読み込み中...</div>
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
          <span>
            <button class="search-hist-btn" id="historyModalKwEditToggleBtn" style="padding:3px 6px;font-size:13px;vertical-align:middle;margin-right:4px;" title="キーワード分類モード: 未分類のキーワードをタップするとキーワード分類モーダルが開きます">📝</button>
            <span class="history-modal-title" id="historyModalTitle">AIチャットの詳細プレビュー</span>
          </span>
          <span class="history-modal-date"><button class="history-modal-date-link" id="historyModalDateLink"></button><span id="historyModalTime"></span></span>
        </div>
        <div class="history-modal-head-search">
          <input class="history-modal-search-input" id="historyModalSearchInput" type="search" placeholder="キーワードで検索..." autocomplete="off">
          <button class="history-modal-search-btn" id="historyModalSearchBtn">🔍 検索</button>
        </div>
        <button class="history-modal-fullscreen-btn" id="historyModalFullscreenBtn" aria-label="全画面表示切り替え" title="全画面表示切り替え">⬜︎</button>
        <button class="history-modal-close" id="historyModalClose" aria-label="閉じる">✕</button>
      </div>
      <div class="history-modal-chat" id="historyModalChat"></div>
      <div id="historyModalKeywordChips" style="display:none;padding:6px 14px 4px;flex-wrap:wrap;gap:1px;border-top:1px solid var(--border-color);"></div>
      <div class="history-modal-foot">
        <button class="search-hist-btn" id="historyModalHighlightToggleBtn" style="padding:3px 7px;font-size:14px;opacity:0.2;" title="キーワードハイライトON/OFF">🔑</button>
        <span id="historyModalMeta"></span>
        <span id="historyModalTokens" style="font-size:11px;color:var(--text-muted);"></span>
        <a class="history-modal-link" id="historyModalShareLink" href="#" target="_blank">🔗 共有ページを開く</a>
        <button type="button" class="search-hist-btn" id="historyModalJevValuesBtn" style="padding:3px 6px;font-size:13px;" title="Jev評価値(jev_label_id 1〜20)を表示">📔</button>
        <button type="button" class="search-hist-btn" id="historyModalScissorsBtn" style="padding:3px 6px;font-size:13px;" title="この回答をベクタ化してキーワードを一括登録する">✂️</button>
        <button class="search-hist-btn" id="historyModalAddSubqueryBtn" style="margin-left:auto;">＋ 追加質問を登録する</button>
      </div>
      <div id="historyModalSubqueryLinks" style="padding:6px 14px 8px;font-size:12px;display:none;"></div>
    </div>
  </div>

  <script>
    ${getThemeToggleScript()}
    ${getCountdownWidgetScript()}
    ${getCountdownQuickAddModalScript()}

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

    // ===== /neko search・/neko vcount のヒット結果一覧モーダル =====
    // チャット画面を応答で埋め尽くさないための暫定措置として、一覧はチャット
    // 本文には出さず、応答バブル内のリンクからこの最上位レイヤーのモーダルで
    // 最大30件まで表形式に表示する。行の質問文リンクからは、それぞれの回答が
    // 書き込まれたAIチャットの詳細プレビュー(historyModal)を(このモーダルより
    // さらに手前に)呼び出せる。
    var nekoResultsModal = document.getElementById('nekoResultsModal');
    var nekoResultsModalTitle = document.getElementById('nekoResultsModalTitle');
    var nekoResultsModalClose = document.getElementById('nekoResultsModalClose');
    var nekoResultsModalBody = document.getElementById('nekoResultsModalBody');

    function renderNekoResultsTable(items) {
      if (!items || items.length === 0) {
        nekoResultsModalBody.innerHTML = '<div class="search-log-empty">記録がありません</div>';
        return;
      }
      var html = '<table class="search-log-table"><thead><tr><th>No.</th><th>質問文</th></tr></thead><tbody>';
      items.forEach(function(item, idx) {
        var q = item.question || '';
        var qShort = q.length > 60 ? q.slice(0, 60) + '…' : (q || '(削除済み)');
        html += '<tr><td class="search-log-date">' + (idx + 1) + '</td>' +
          '<td class="search-log-q kw-q-link" data-share-id="' + escHtml(item.id) + '" title="' + escHtml(q) + '">' +
          '<span class="impr-q-text">' + escHtml(qShort) + '</span></td></tr>';
      });
      html += '</tbody></table>';
      nekoResultsModalBody.innerHTML = html;
    }

    function openNekoResultsModal(items, title) {
      nekoResultsModalTitle.textContent = title || '/neko 結果一覧（最大30件）';
      renderNekoResultsTable(items);
      nekoResultsModal.style.zIndex = String(getNextZ());
      nekoResultsModal.classList.add('open');
      nekoResultsModal.setAttribute('aria-hidden', 'false');
    }

    function closeNekoResultsModal() {
      nekoResultsModal.classList.remove('open');
      nekoResultsModal.setAttribute('aria-hidden', 'true');
    }

    nekoResultsModalClose.addEventListener('click', closeNekoResultsModal);
    nekoResultsModal.addEventListener('click', function(e) { if (e.target === nekoResultsModal) closeNekoResultsModal(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && nekoResultsModal.classList.contains('open')) closeNekoResultsModal();
    });
    nekoResultsModalBody.addEventListener('click', function(e) {
      var td = e.target.closest('td[data-share-id]');
      if (!td) return;
      openHistoryModalByShareId(td.getAttribute('data-share-id'), '[]');
    });

    var cursorAgentAnswerModal = document.getElementById('cursorAgentAnswerModal');
    var cursorAgentAnswerModalTitle = document.getElementById('cursorAgentAnswerModalTitle');
    var cursorAgentAnswerModalClose = document.getElementById('cursorAgentAnswerModalClose');
    var cursorAgentAnswerModalBody = document.getElementById('cursorAgentAnswerModalBody');

    function formatCursorAgentCsearchAnswerText(payload) {
      if (payload && typeof payload.error === 'string' && payload.error.trim()) return payload.error;
      var answers = [];
      if (payload && Array.isArray(payload.answers)) {
        payload.answers.forEach(function(a) {
          if (typeof a === 'string' && a.length > 0) answers.push(a);
        });
      }
      if (answers.length === 0) return 'キャッシュに回答文がありません';
      var body = answers.join('\\n\\n');
      if (payload && typeof payload.cacheError === 'string' && payload.cacheError.trim()) {
        return body + '\\n\\n' + payload.cacheError;
      }
      return body;
    }

    function closeCursorAgentAnswerModal() {
      cursorAgentAnswerModal.classList.remove('open');
      cursorAgentAnswerModal.setAttribute('aria-hidden', 'true');
    }

    function openCursorAgentAnswerModal(launchId, question) {
      cursorAgentAnswerModalTitle.textContent = question || '回答全文';
      cursorAgentAnswerModalBody.textContent = '読み込み中...';
      cursorAgentAnswerModal.style.zIndex = String(getNextZ());
      cursorAgentAnswerModal.classList.add('open');
      cursorAgentAnswerModal.setAttribute('aria-hidden', 'false');
      fetch('/api/cursor-agent/history/' + encodeURIComponent(String(launchId)) + '/conversation', { credentials: 'same-origin' })
        .then(function(res) { return res.json().then(function(data) { return data; }); })
        .then(function(data) {
          var payload = data || {};
          var text = formatCursorAgentCsearchAnswerText(payload);
          if (typeof payload.error === 'string' && payload.error.trim()) {
            cursorAgentAnswerModalBody.textContent = text;
            return;
          }
          cursorAgentAnswerModalBody.innerHTML = parseMd(text);
        })
        .catch(function(err) {
          cursorAgentAnswerModalBody.textContent = '回答の取得に失敗しました: ' + (err && err.message ? err.message : String(err));
        });
    }

    function parseCsearchHrefId(href) {
      if (!href) return '';
      var prefix = '#csearch-';
      if (href.indexOf(prefix) !== 0) return '';
      var rest = href.slice(prefix.length);
      if (!rest) return '';
      var i;
      for (i = 0; i < rest.length; i++) {
        var code = rest.charCodeAt(i);
        if (code < 48 || code > 57) return '';
      }
      return rest;
    }

    function bindCsearchAnswerLink(a, item) {
      if (!a || !item) return;
      a.href = '#csearch-' + item.id;
      a.className = 'csearch-answer-link';
      a.textContent = '表示';
      a.removeAttribute('target');
      a.setAttribute('data-launch-id', String(item.id));
      a.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openCursorAgentAnswerModal(item.id, item.question || '');
      });
    }

    function createCsearchAnswerLink(item) {
      var a = document.createElement('a');
      bindCsearchAnswerLink(a, item);
      return a;
    }

    function questionFromCsearchRow(tr) {
      if (!tr || !tr.cells || tr.cells.length < 2) return '';
      return (tr.cells[tr.cells.length - 2].textContent || '').trim();
    }

    function createdAtFromCsearchRow(tr) {
      if (!tr || !tr.cells || tr.cells.length < 3) return '(時刻不明)';
      return (tr.cells[0].textContent || '').trim() || '(時刻不明)';
    }

    function wireCsearchAnswerLinks(el, items) {
      if (!el) return;
      var byId = {};
      (items || []).forEach(function(item) {
        if (item && item.id != null) byId[String(item.id)] = item;
      });
      var table = el.querySelector('table');
      if (!table) {
        if (!items || items.length === 0) return;
        table = document.createElement('table');
        table.className = 'csearch-result-table';
        var thead = document.createElement('thead');
        var headRow = document.createElement('tr');
        var tHead = document.createElement('th');
        tHead.textContent = '作成時刻(JST)';
        var qHead = document.createElement('th');
        qHead.textContent = '質問文';
        var aHead = document.createElement('th');
        aHead.textContent = '表示';
        headRow.appendChild(tHead);
        headRow.appendChild(qHead);
        headRow.appendChild(aHead);
        thead.appendChild(headRow);
        table.appendChild(thead);
        var tbody = document.createElement('tbody');
        items.forEach(function(item) {
          var tr = document.createElement('tr');
          var timeTd = document.createElement('td');
          timeTd.className = 'csearch-created-at';
          timeTd.textContent = item.createdAtJst || '(時刻不明)';
          var qTd = document.createElement('td');
          qTd.textContent = item.question || '(質問文なし)';
          var aTd = document.createElement('td');
          aTd.appendChild(createCsearchAnswerLink(item));
          tr.appendChild(timeTd);
          tr.appendChild(qTd);
          tr.appendChild(aTd);
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        el.appendChild(table);
        return;
      }
      table.classList.add('csearch-result-table');
      var rows = table.querySelectorAll('tbody tr');
      rows.forEach(function(tr, i) {
        var lastTd = tr.cells[tr.cells.length - 1];
        if (!lastTd) return;
        var existing = lastTd.querySelector('a');
        var hrefId = existing ? parseCsearchHrefId(existing.getAttribute('href') || '') : '';
        var item = (hrefId && byId[hrefId]) || (items && items[i]) || null;
        if (!item) {
          var inferredId = hrefId || (existing && existing.getAttribute('data-launch-id')) || '';
          if (!inferredId) return;
          item = {
            id: Number(inferredId),
            question: questionFromCsearchRow(tr),
            createdAtJst: createdAtFromCsearchRow(tr),
          };
        }
        if (existing) {
          bindCsearchAnswerLink(existing, item);
        } else {
          lastTd.textContent = '';
          lastTd.appendChild(createCsearchAnswerLink(item));
        }
      });
    }

    cursorAgentAnswerModalClose.addEventListener('click', closeCursorAgentAnswerModal);
    cursorAgentAnswerModal.addEventListener('click', function(e) { if (e.target === cursorAgentAnswerModal) closeCursorAgentAnswerModal(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && cursorAgentAnswerModal.classList.contains('open')) closeCursorAgentAnswerModal();
    });

    var qsearchAnswerModal = document.getElementById('qsearchAnswerModal');
    var qsearchAnswerModalTitle = document.getElementById('qsearchAnswerModalTitle');
    var qsearchAnswerModalClose = document.getElementById('qsearchAnswerModalClose');
    var qsearchAnswerModalBody = document.getElementById('qsearchAnswerModalBody');

    function formatAichatQsearchAnswerText(payload) {
      if (payload && typeof payload.error === 'string' && payload.error.trim()) return payload.error;
      if (payload && typeof payload.answer === 'string' && payload.answer.length > 0) return payload.answer;
      return '回答文がありません';
    }

    function closeQsearchAnswerModal() {
      qsearchAnswerModal.classList.remove('open');
      qsearchAnswerModal.setAttribute('aria-hidden', 'true');
    }

    function openQsearchAnswerModal(id, model) {
      qsearchAnswerModalTitle.textContent = id || '最新の回答';
      qsearchAnswerModalBody.textContent = '読み込み中...';
      qsearchAnswerModal.style.zIndex = String(getNextZ());
      qsearchAnswerModal.classList.add('open');
      qsearchAnswerModal.setAttribute('aria-hidden', 'false');
      fetch('/api/aichat/qsearch/latest-answer?id=' + encodeURIComponent(id || '') + '&model=' + encodeURIComponent(model || ''), { credentials: 'same-origin' })
        .then(function(res) { return res.json().then(function(data) { return data; }); })
        .then(function(data) {
          var payload = data || {};
          if (payload && typeof payload.question === 'string' && payload.question.trim()) {
            qsearchAnswerModalTitle.textContent = payload.question;
          }
          var text = formatAichatQsearchAnswerText(payload);
          if (typeof payload.error === 'string' && payload.error.trim()) {
            qsearchAnswerModalBody.textContent = text;
            return;
          }
          qsearchAnswerModalBody.innerHTML = parseMd(text);
        })
        .catch(function(err) {
          qsearchAnswerModalBody.textContent = '回答の取得に失敗しました: ' + (err && err.message ? err.message : String(err));
        });
    }

    function parseAichatQsearchHref(href) {
      if (!href) return null;
      var normalized = String(href);
      while (normalized.indexOf('&amp;') !== -1) {
        normalized = normalized.split('&amp;').join('&');
      }
      var prefix = '#qsearch?';
      if (normalized.indexOf(prefix) !== 0) return null;
      var params = new URLSearchParams(normalized.slice(prefix.length));
      var id = params.get('id') || '';
      if (!id) return null;
      return { id: id, model: params.get('model') || '' };
    }

    function bindQsearchIdLink(a) {
      if (!a) return;
      var parsed = parseAichatQsearchHref(a.getAttribute('href') || '');
      a.className = 'qsearch-id-link';
      a.removeAttribute('target');
      a.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!parsed) return;
        openQsearchAnswerModal(parsed.id || '', parsed.model || '');
      });
    }

    function wireQsearchIdLinks(el) {
      if (!el) return;
      var table = el.querySelector('table');
      if (table) table.classList.add('qsearch-result-table');
      var links = el.querySelectorAll('a[href^="#qsearch"]');
      links.forEach(function(a) { bindQsearchIdLink(a); });
    }

    qsearchAnswerModalClose.addEventListener('click', closeQsearchAnswerModal);
    qsearchAnswerModal.addEventListener('click', function(e) { if (e.target === qsearchAnswerModal) closeQsearchAnswerModal(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && qsearchAnswerModal.classList.contains('open')) closeQsearchAnswerModal();
    });

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
    var searchLogRecordBtn = document.getElementById('searchLogRecordBtn');
    var sidebarSearchTargetBtn = document.getElementById('sidebarSearchTargetBtn');
    var sidebarSearchTarget = 'llama-4';
    var searchLogRecordModal = document.getElementById('searchLogRecordModal');
    var searchLogRecordModalBody = document.getElementById('searchLogRecordModalBody');
    var searchLogRecordTitle = document.getElementById('searchLogRecordTitle');
    var searchLogApproveBtn = document.getElementById('searchLogApproveBtn');
    var searchLogPendingNewIds = [];
    var searchLogCurrentKeyword = '';
    var searchLogCurrentShareIds = [];
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
      sidebarResults.innerHTML = '';
      currentResults = [];
      searchLogRecordBtn.style.display = 'none';
      sidebarStatus.textContent = '';
      currentMode = 'search';
      currentDateLabel = '';
      currentKeywordLabel = '';
      sidebarModeToggle.style.display = 'none';
      canvasSearchBtn.style.display = 'none';
      canvasSearchModal.classList.remove('open');
    }

    sidebarToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      if (sidebarOpen) {
        closeSidebar();
        return;
      }
      sidebarOpen = true;
      sidebar.classList.add('open');
      sidebarToggle.classList.add('active');
      var q = sidebarSearch.value.trim();
      if (q) {
        sidebarResults.innerHTML = '';
        currentResults = [];
        searchLogRecordBtn.style.display = 'none';
        sidebarStatus.textContent = '検索中...';
        currentMode = 'search';
        currentDateLabel = '';
        currentKeywordLabel = '';
        sidebarModeToggle.style.display = 'none';
        doSearch(q);
      } else {
        var todayDate = new Date().toISOString().slice(0, 10);
        calCurrentMonth = todayDate.slice(0, 7);
        calSelectedDay = todayDate;
        loadCalendar(calCurrentMonth);
        doDateLoad(todayDate);
      }
      setTimeout(function() { sidebarSearch.focus(); }, 260);
    });

    document.addEventListener('click', function(e) {
      if (sidebarKwModal.classList.contains('open') && !sidebarKwModal.contains(e.target) && e.target !== sidebarModeKw) {
        sidebarKwModal.classList.remove('open');
      }
      if (sidebarOpen && isTapCloseEnabled() && !sidebar.contains(e.target) && !sidebarKwModal.contains(e.target) && !canvasSearchModal.contains(e.target) && e.target !== sidebarToggle) {
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
        var modelTags = '';
        if (kw.models) {
          kw.models.split(',').forEach(function(m) {
            var short = m.trim().split('/').pop();
            if (short) modelTags += '<span class="kw-model-tag" title="' + escHtml(m.trim()) + '">' + escHtml(short) + '</span>';
          });
        }
        html += '<div class="sidebar-kw-item' + sel + '" data-keyword="' + escHtml(kw.keyword) + '">'
          + '<div style="flex:1;min-width:0;">'
          + '<div>' + escHtml(kw.keyword) + '</div>'
          + (modelTags ? '<div style="margin-top:2px;">' + modelTags + '</div>' : '')
          + '</div>'
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
          canvasSearchBtn.style.display = currentResults.length > 0 ? 'inline-block' : 'none';
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
      if (!q) { sidebarStatus.textContent = ''; sidebarResults.innerHTML = ''; currentResults = []; canvasSearchBtn.style.display = 'none'; return; }
      sidebarStatus.textContent = '検索中...';
      searchTimer = setTimeout(function() { doSearch(q); }, 350);
    });

    sidebarClear.addEventListener('click', function() {
      sidebarSearch.value = '';
      sidebarClear.classList.remove('visible');
      searchLogRecordBtn.style.display = 'none';
      canvasSearchBtn.style.display = 'none';
      sidebarStatus.textContent = '';
      sidebarResults.innerHTML = '';
      currentResults = [];
      currentMode = 'search';
      currentDateLabel = '';
      updateSidebarModeUI();
      clearSelectedDay();
      sidebarSearch.focus();
    });

    var SIDEBAR_SEARCH_TARGET_CYCLE = ['llama-4', 'moondream3.1', 'kimi-gemma'];
    // アイコン+ツールチップだけでは「kimi-gemma対象も選べる」ことに気づけず、
    // llama-4のまま検索して0件になる問い合わせが実際にあったため、検索欄の
    // placeholderに現在の検索対象名を常時表示する(ホバー不要で視認できるようにする)。
    var SIDEBAR_SEARCH_TARGET_LABEL = {
      'llama-4': ['🖼️', '検索対象: llama-4(質問・回答)。クリックでmoondream3.1(画像分析)に切替', '履歴を検索...(llama-4)'],
      'moondream3.1': ['🩻', '検索対象: moondream3.1(画像分析)。クリックでkimi-gemma(kimi-codeのGemmaレビュー)に切替', '履歴を検索...(moondream3.1)'],
      'kimi-gemma': ['🌙', '検索対象: kimi-gemma(kimi-codeのGemmaレビュー)。クリックでllama-4(質問・回答)に切替', '履歴を検索...(kimi-gemma)'],
    };
    sidebarSearchTargetBtn.addEventListener('click', function() {
      var idx = SIDEBAR_SEARCH_TARGET_CYCLE.indexOf(sidebarSearchTarget);
      sidebarSearchTarget = SIDEBAR_SEARCH_TARGET_CYCLE[(idx + 1) % SIDEBAR_SEARCH_TARGET_CYCLE.length];
      var label = SIDEBAR_SEARCH_TARGET_LABEL[sidebarSearchTarget];
      sidebarSearchTargetBtn.textContent = label[0];
      sidebarSearchTargetBtn.title = label[1];
      sidebarSearch.placeholder = label[2];
      sidebarSearchTargetBtn.classList.toggle('active', sidebarSearchTarget !== 'llama-4');
      var q = sidebarSearch.value.trim();
      if (q && currentMode === 'search') doSearch(q);
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
      fetch('/api/aichat/shares/search?q=' + encodeURIComponent(q) + '&target=' + encodeURIComponent(sidebarSearchTarget), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          currentResults = data.results || [];
          selectedIdx = -1;
          currentMode = 'search';
          renderSidebarResults();
          sidebarStatus.textContent = currentResults.length > 0 ? currentResults.length + ' 件ヒット' : '一致なし';
          updateSidebarModeUI();
          searchLogRecordBtn.style.display = currentResults.length > 0 ? 'inline-block' : 'none';
          canvasSearchBtn.style.display = currentResults.length > 0 ? 'inline-block' : 'none';
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

    function openSearchLogRecordModal(keyword, shareIds) {
      searchLogCurrentKeyword = keyword;
      searchLogCurrentShareIds = shareIds;
      searchLogRecordTitle.textContent = '📋 検索ログ: ' + keyword;
      searchLogRecordModalBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      searchLogApproveBtn.style.display = 'none';
      searchLogPendingNewIds = [];
      searchLogRecordModal.style.zIndex = String(getNextZ());
      searchLogRecordModal.classList.add('open');
      searchLogRecordModal.setAttribute('aria-hidden', 'false');
      fetch('/api/aichat/search-log/open-modal', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword, shareIds: shareIds })
      }).then(function(r) { return r.json(); })
        .then(function(data) {
          var entries = data.entries || [];
          if (!entries.length) { searchLogRecordModalBody.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px 0;">データがありません</div>'; return; }
          var newIds = entries.filter(function(e) { return e.isNew; }).map(function(e) { return e.shareId; });
          searchLogPendingNewIds = newIds;
          var newCount = newIds.length;
          var summary = '<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">'
            + entries.length + ' 件中 '
            + '<span style="color:#e53e3e;font-weight:600;">' + newCount + ' 件が未登録</span>'
            + '、<span style="color:#16a34a;font-weight:600;">' + (entries.length - newCount) + ' 件が登録済み</span>'
            + '</div>';
          var html = summary;
          entries.forEach(function(e) {
            var modelShort = e.model ? e.model.split('/').pop() : '?';
            var cls = 'slm-entry' + (e.isNew ? ' slm-entry-new' : ' slm-entry-registered');
            html += '<div class="' + cls + '">';
            html += '<div class="slm-kw">' + escHtml(keyword)
              + (e.isNew ? '<span class="slm-entry-new-badge">未登録</span>' : '<span class="slm-entry-reg-badge">登録済</span>')
              + '</div>';
            html += '<div class="slm-model">モデル: ' + escHtml(modelShort) + '</div>';
            html += '<div class="slm-id">ID: ' + escHtml(e.shareId) + '</div>';
            if (e.question) html += '<div class="slm-q">質問: ' + escHtml(e.question) + '</div>';
            html += '</div>';
          });
          searchLogRecordModalBody.innerHTML = html;
          if (newCount > 0) searchLogApproveBtn.style.display = 'inline-block';
        })
        .catch(function() { searchLogRecordModalBody.innerHTML = '<div style="color:#e53e3e;font-size:12px;">読み込みエラー</div>'; });
    }

    document.getElementById('searchLogRecordClose').addEventListener('click', function() {
      searchLogRecordModal.classList.remove('open');
      searchLogRecordModal.setAttribute('aria-hidden', 'true');
    });
    searchLogRecordModal.addEventListener('click', function(e) {
      if (e.target === searchLogRecordModal) { searchLogRecordModal.classList.remove('open'); searchLogRecordModal.setAttribute('aria-hidden', 'true'); }
    });
    searchLogApproveBtn.addEventListener('click', function() {
      if (!searchLogCurrentKeyword || !searchLogPendingNewIds.length) return;
      searchLogApproveBtn.disabled = true;
      fetch('/api/aichat/search-log/approve', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: searchLogCurrentKeyword, shareIds: searchLogPendingNewIds })
      }).then(function(r) { return r.json(); })
        .then(function(data) {
          searchLogApproveBtn.disabled = false;
          if (data.ok) {
            openSearchLogRecordModal(searchLogCurrentKeyword, searchLogCurrentShareIds);
          } else {
            searchLogRecordModalBody.innerHTML = '<div style="color:#e53e3e;font-size:12px;">登録に失敗しました: ' + escHtml(String(data.error || '')) + '</div>';
          }
        })
        .catch(function() { searchLogApproveBtn.disabled = false; });
    });
    searchLogRecordBtn.addEventListener('click', function() {
      var q = sidebarSearch.value.trim();
      var shareIds = currentResults.map(function(r) { return String(r.id); });
      if (!q || !shareIds.length) return;
      openSearchLogRecordModal(q, shareIds);
    });

    // ===== 質問・回答・キーワードのキャンバス表示 =====
    var canvasSearchBtn = document.getElementById('canvasSearchBtn');
    var canvasSearchModal = document.getElementById('canvasSearchModal');
    var canvasSearchClose = document.getElementById('canvasSearchClose');
    var canvasSearchInput = document.getElementById('canvasSearchInput');
    var canvasSearchStatus = document.getElementById('canvasSearchStatus');
    var canvasSearchCanvas = document.getElementById('canvasSearchCanvas');
    var canvasSearchCtx = canvasSearchCanvas ? canvasSearchCanvas.getContext('2d') : null;
    var canvasSearchAllResults = [];
    var canvasSearchKeyword = '';
    var CANVAS_SEARCH_W = 700;
    var CANVAS_SEARCH_PAD = 14;
    var CANVAS_SEARCH_LINE_H = 18;

    function openCanvasSearchModal() {
      if (!currentResults.length) return;
      canvasSearchAllResults = currentResults.slice();
      canvasSearchKeyword = sidebarSearch.value.trim();
      canvasSearchInput.value = '';
      canvasSearchModal.style.zIndex = String(getNextZ());
      canvasSearchModal.classList.add('open');
      canvasSearchModal.setAttribute('aria-hidden', 'false');
      renderCanvasSearch('');
      setTimeout(function() { canvasSearchInput.focus(); }, 50);
    }

    function closeCanvasSearchModal() {
      canvasSearchModal.classList.remove('open');
      canvasSearchModal.setAttribute('aria-hidden', 'true');
    }

    canvasSearchBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      openCanvasSearchModal();
    });
    canvasSearchClose.addEventListener('click', closeCanvasSearchModal);
    canvasSearchModal.addEventListener('click', function(e) {
      if (e.target === canvasSearchModal) closeCanvasSearchModal();
    });
    canvasSearchInput.addEventListener('input', function() {
      renderCanvasSearch(canvasSearchInput.value);
    });

    function renderCanvasSearch(filterQ) {
      var q = filterQ.trim();
      var qLower = q.toLowerCase();
      var list = canvasSearchAllResults.filter(function(r) {
        if (!qLower) return true;
        var hay = ((r.question || '') + ' ' + (r.answer || '')).toLowerCase();
        return hay.indexOf(qLower) !== -1;
      });
      var labelKw = q || canvasSearchKeyword;
      canvasSearchStatus.textContent = list.length + ' 件表示中' + (labelKw ? '（キーワード: ' + labelKw + '）' : '');
      drawCanvasSearch(list, labelKw);
    }

    function wrapCanvasText(ctx, text, maxWidth) {
      var chars = String(text).split('');
      var lines = [];
      var cur = '';
      for (var i = 0; i < chars.length; i++) {
        if (chars[i] === '\\n') { lines.push(cur); cur = ''; continue; }
        var test = cur + chars[i];
        if (cur && ctx.measureText(test).width > maxWidth) {
          lines.push(cur);
          cur = chars[i];
        } else {
          cur = test;
        }
      }
      if (cur) lines.push(cur);
      return lines;
    }

    function drawCanvasLineWithHighlight(ctx, line, x, y, word) {
      if (!word) { ctx.fillText(line, x, y); return; }
      var lower = line.toLowerCase();
      var wlower = word.toLowerCase();
      var idx = 0;
      var cursorX = x;
      var baseFill = ctx.fillStyle;
      while (true) {
        var pos = lower.indexOf(wlower, idx);
        if (pos === -1) {
          ctx.fillStyle = baseFill;
          ctx.fillText(line.slice(idx), cursorX, y);
          break;
        }
        var pre = line.slice(idx, pos);
        if (pre) {
          ctx.fillStyle = baseFill;
          ctx.fillText(pre, cursorX, y);
          cursorX += ctx.measureText(pre).width;
        }
        var match = line.slice(pos, pos + word.length);
        var mw = ctx.measureText(match).width;
        ctx.fillStyle = 'rgba(102,126,234,0.30)';
        ctx.fillRect(cursorX, y - 13, mw, 17);
        ctx.fillStyle = '#1a202c';
        ctx.fillText(match, cursorX, y);
        cursorX += mw;
        idx = pos + word.length;
      }
      ctx.fillStyle = baseFill;
    }

    function drawCanvasSearch(list, keyword) {
      if (!canvasSearchCtx) return;
      var ctx = canvasSearchCtx;
      var W = CANVAS_SEARCH_W;
      var innerW = W - CANVAS_SEARCH_PAD * 2 - 16;
      var items = [];

      ctx.font = '700 13px sans-serif';
      list.forEach(function(r) {
        var qLines = wrapCanvasText(ctx, '質問: ' + (r.question || ''), innerW);
        ctx.font = '12px sans-serif';
        var answerText = String(r.answer || '').split('\\n').join(' ').split('\\t').join(' ');
        if (answerText.length > 260) answerText = answerText.slice(0, 260) + '…';
        var aLines = wrapCanvasText(ctx, '回答: ' + answerText, innerW);
        var hasKw = keyword && (String(r.question || '') + String(r.answer || '')).toLowerCase().indexOf(keyword.toLowerCase()) !== -1;
        var kwLine = keyword ? ('キーワード: ' + keyword + (hasKw ? '' : '（本文になし）')) : 'キーワード: -';
        ctx.font = '700 13px sans-serif';
        var itemH = CANVAS_SEARCH_PAD + qLines.length * CANVAS_SEARCH_LINE_H
          + aLines.length * CANVAS_SEARCH_LINE_H + CANVAS_SEARCH_LINE_H + CANVAS_SEARCH_PAD;
        items.push({ qLines: qLines, aLines: aLines, kwLine: kwLine, height: itemH, hasKw: hasKw });
      });

      var totalH = CANVAS_SEARCH_PAD;
      items.forEach(function(it) { totalH += it.height + 10; });
      totalH = Math.max(totalH, 80);

      var dpr = window.devicePixelRatio || 1;
      canvasSearchCanvas.width = W * dpr;
      canvasSearchCanvas.height = totalH * dpr;
      canvasSearchCanvas.style.height = totalH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = '#f7f8fa';
      ctx.fillRect(0, 0, W, totalH);

      if (items.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px sans-serif';
        ctx.fillText('一致する質問・回答がありません', CANVAS_SEARCH_PAD, 30);
        return;
      }

      var y = CANVAS_SEARCH_PAD;
      items.forEach(function(it) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        var cardTop = y;
        ctx.fillRect(CANVAS_SEARCH_PAD - 6, cardTop, W - (CANVAS_SEARCH_PAD - 6) * 2, it.height);
        ctx.strokeRect(CANVAS_SEARCH_PAD - 6, cardTop, W - (CANVAS_SEARCH_PAD - 6) * 2, it.height);

        var ty = y + CANVAS_SEARCH_LINE_H - 4;
        ctx.font = '700 13px sans-serif';
        it.qLines.forEach(function(line) {
          ctx.fillStyle = '#1a202c';
          drawCanvasLineWithHighlight(ctx, line, CANVAS_SEARCH_PAD, ty, keyword);
          ty += CANVAS_SEARCH_LINE_H;
        });
        ctx.font = '12px sans-serif';
        it.aLines.forEach(function(line) {
          ctx.fillStyle = '#4a5568';
          drawCanvasLineWithHighlight(ctx, line, CANVAS_SEARCH_PAD, ty, keyword);
          ty += CANVAS_SEARCH_LINE_H;
        });
        ctx.font = '700 11px sans-serif';
        ctx.fillStyle = it.hasKw ? '#667eea' : '#a0aec0';
        ctx.fillText(it.kwLine, CANVAS_SEARCH_PAD, ty);

        y += it.height + 10;
      });
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
        canvasSearchBtn.style.display = currentResults.length > 0 ? 'inline-block' : 'none';
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
        if (r.model) {
          var modelLabel = document.createElement('span');
          modelLabel.className = 'result-model-label';
          modelLabel.textContent = r.model.split('/').pop();
          meta.appendChild(modelLabel);
        }
        meta.appendChild(document.createTextNode(r.created_at.slice(0, 16).replace('T', ' ')));
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
        .catch(function() { renderCalendar(month); });
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
        } else {
          cell.title = day + '日';
        }
        (function(ds) {
          cell.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!sidebarOpen) {
              sidebarOpen = true;
              sidebar.classList.add('open');
              sidebarToggle.classList.add('active');
            }
            calSelectedDay = ds;
            sidebarSearch.value = '';
            sidebarClear.classList.remove('visible');
            renderCalendar(calCurrentMonth);
            sidebarResults.scrollTop = 0;
            doDateLoad(ds);
          });
        })(dateStr);
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
    ${getMarkdownParserScript()}

    // ===== 詳細パネル =====
    var resultsPanel = document.getElementById('resultsPanel');
    var resultsPanelQ = document.getElementById('resultsPanelQ');
    var resultsPanelA = document.getElementById('resultsPanelA');
    var resultsPanelReviewCol = document.getElementById('resultsPanelReviewCol');
    var resultsPanelReviewLabel = document.getElementById('resultsPanelReviewLabel');
    var resultsPanelReview = document.getElementById('resultsPanelReview');
    var resultsPanelMeta = document.getElementById('resultsPanelMeta');
    var resultsPanelShareLink = document.getElementById('resultsPanelShareLink');
    var resultsPanelClose = document.getElementById('resultsPanelClose');
    var historyModalBackdrop = document.getElementById('historyModalBackdrop');
    var historyModalChat = document.getElementById('historyModalChat');
    var historyModalDateLink = document.getElementById('historyModalDateLink');
    var historyModalTime = document.getElementById('historyModalTime');
    var historyModalMeta = document.getElementById('historyModalMeta');
    var historyModalTokens = document.getElementById('historyModalTokens');
    var historyModalShareLink = document.getElementById('historyModalShareLink');
    var historyModalJevValuesBtn = document.getElementById('historyModalJevValuesBtn');
    var historyModalScissorsBtn = document.getElementById('historyModalScissorsBtn');
    var jevValuesModal = document.getElementById('jevValuesModal');
    var jevValuesBody = document.getElementById('jevValuesBody');
    var jevValuesClose = document.getElementById('jevValuesClose');
    var historyModalClose = document.getElementById('historyModalClose');
    var historyModalFullscreenBtn = document.getElementById('historyModalFullscreenBtn');
    var historyModal = document.querySelector('.history-modal');
    var historyModalCurrentId = null;

    var historyModalSwipeItems = [];
    var historyModalSwipeIndex = 0;
    var historyModalSwipeDataCache = {};
    var historySwipeTouchStartX = 0;

    function renderHistoryModalModelDots() {
      if (historyModalSwipeItems.length <= 1) return;
      var current = historyModalSwipeItems[historyModalSwipeIndex];
      if (!current) return;
      var dotColor = MODEL_COLORS[current.model] || '';
      var dotsHtml = historyModalSwipeItems.map(function(item, idx) {
        var isActive = idx === historyModalSwipeIndex;
        var c = MODEL_COLORS[item.model] || 'var(--text-muted)';
        var sz = isActive ? '12px' : '7px';
        var shadow = isActive ? ';box-shadow:0 0 0 3px ' + (dotColor ? dotColor + '33' : 'rgba(0,0,0,0.15)') : '';
        return '<span data-swipe-index="' + idx + '" style="display:inline-block;width:' + sz + ';height:' + sz + ';border-radius:50%;background:' + c + ';cursor:pointer;transition:all 0.2s;vertical-align:middle;flex-shrink:0;' + shadow + ';" title="' + escHtml(shortModelName(item.model)) + '"></span>';
      }).join('');
      var counter = '(' + (historyModalSwipeIndex + 1) + '/' + historyModalSwipeItems.length + ')';
      historyModalMeta.innerHTML =
        '<span class="history-modal-model-filter-btn" style="cursor:pointer;' + (dotColor ? 'color:' + dotColor + ';' : '') + 'text-decoration:underline dotted;display:inline-flex;align-items:center;gap:5px;" title="モデルで絞り込む">'
        + '<span class="history-swipe-dots" style="display:inline-flex;gap:4px;align-items:center;">' + dotsHtml + '</span>'
        + escHtml(shortModelName(current.model))
        + '<span style="color:var(--text-muted);font-size:11px;">' + counter + '</span>'
        + '</span>'
        + '　👁 ' + (current.access_count || 0);
    }

    function historyModalSwipeNavigate(direction) {
      if (historyModalSwipeItems.length <= 1) return;
      var nextIdx = historyModalSwipeIndex + direction;
      if (nextIdx < 0 || nextIdx >= historyModalSwipeItems.length) return;
      var targetItem = historyModalSwipeItems[nextIdx];
      var assistBubble = historyModalChat.querySelector('.chat-bubble.assistant');
      if (assistBubble) {
        assistBubble.style.transition = 'opacity 0.15s ease';
        assistBubble.style.opacity = '0';
      }
      function applyData(data) {
        historyModalSwipeIndex = nextIdx;
        historyModalSwipeDataCache[targetItem.id] = data;
        historyModalCurrentId = data.id;
        historyModalCurrentModel = data.model;
        refreshJevValuesButtonState();
        historyModalShareLink.href = '/s/' + data.user_hash + '/' + data.id;
        renderHistoryModalTokens(data);
        if (assistBubble) {
          assistBubble.innerHTML = parseMd(truncateForHistoryPreview(data.answer));
          if (historyModalHighlightActive && historyModalCurrentKeyword) {
            applyKeywordHighlight(assistBubble, historyModalCurrentKeyword);
          }
          assistBubble.style.opacity = '1';
        }
        var wasDbApplied = historyModalDBKeywordsApplied;
        historyModalDBKeywordsApplied = false;
        historyModalChipsPinned = false;
        historyModalActiveChipKeyword = '';
        historyModalKeywordsFromDB = [];
        fetchShareKeywords(data.id, function() { if (wasDbApplied && historyModalHighlightActive) applyAllDbKeywordHighlights(); });
        renderHistoryModalModelDots();
        updateHighlightToggleBtn();
      }
      if (historyModalSwipeDataCache[targetItem.id] && historyModalSwipeDataCache[targetItem.id].answer) {
        setTimeout(function() { applyData(historyModalSwipeDataCache[targetItem.id]); }, 150);
      } else {
        fetch('/api/aichat/shares/' + encodeURIComponent(String(targetItem.id)), { credentials: 'same-origin' })
          .then(function(r) { return r.json(); })
          .then(function(data) { setTimeout(function() { applyData(data); }, 100); })
          .catch(function() { if (assistBubble) assistBubble.style.opacity = '1'; });
      }
    }

    // コピーのためテキストを指でなぞって選択する操作も水平方向に50px以上
    // 動くことが多く、区別せずにスワイプ判定すると指を離した瞬間に
    // historyModalSwipeNavigate() が再描画してしまい選択中のハイライトが
    // 消えてしまう。window.getSelection() が空でない（＝選択中）場合は
    // スワイプとみなさないようにする。
    function shouldTriggerHistoryModalSwipe(dx) {
      if (Math.abs(dx) <= 50) return false;
      var selectedText = window.getSelection ? window.getSelection().toString() : '';
      if (selectedText) return false;
      return true;
    }

    historyModalChat.addEventListener('touchstart', function(e) {
      historySwipeTouchStartX = e.touches[0].clientX;
    }, { passive: true });

    historyModalChat.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - historySwipeTouchStartX;
      if (shouldTriggerHistoryModalSwipe(dx)) historyModalSwipeNavigate(dx < 0 ? 1 : -1);
    });

    function shouldIgnoreHistorySwipeKey(e) {
      if (e.isComposing) return true;
      var target = e.target;
      if (!target) return false;
      if (target.isContentEditable) return true;
      return typeof target.closest === 'function'
        && !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
    }

    document.addEventListener('keydown', function(e) {
      if (!historyModalBackdrop.classList.contains('open')) return;
      if (historyModalSwipeItems.length <= 1) return;
      // 履歴プレビューの上に分類モーダルを開いた場合もこのハンドラは有効なままになる。
      // 入力欄でのカーソル移動や IME 変換を履歴切替として奪わないようにする。
      if (shouldIgnoreHistorySwipeKey(e)) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); historyModalSwipeNavigate(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); historyModalSwipeNavigate(1); }
    });

    historyModalMeta.addEventListener('click', function(e) {
      var dot = e.target.closest('[data-swipe-index]');
      if (dot) {
        e.stopPropagation();
        var targetIdx = parseInt(dot.getAttribute('data-swipe-index'));
        if (!isNaN(targetIdx) && targetIdx !== historyModalSwipeIndex) {
          historyModalSwipeNavigate(targetIdx - historyModalSwipeIndex);
        }
        return;
      }
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
      historyModalBackdrop.classList.remove('fullscreen');
      historyModal.classList.remove('fullscreen');
      historyModal.classList.remove('frames-hidden');
      historyModalFullscreenBtn.textContent = '⬜︎';
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

    // Slack応答等、モデルによっては極端に長い(数万〜数十万文字規模)応答が
    // 保存される場合があり、そのままMarkdownパーサー・キーワードハイライト処理に
    // 渡すと処理時間が長くなりページがフリーズしたように見える原因になる。
    // 履歴表示(検索結果からのプレビュー)ではこの上限を超える分は切り詰める。
    var HISTORY_PREVIEW_MAX_CHARS = 20000;
    function truncateForHistoryPreview(text) {
      if (typeof text !== 'string' || text.length <= HISTORY_PREVIEW_MAX_CHARS) return text;
      return text.slice(0, HISTORY_PREVIEW_MAX_CHARS) + '\\n\\n…(長すぎるため以下省略。共有リンクから全文を確認できます)';
    }

    function appendHistoryModalBubble(text, role, imageDataUrl) {
      var el = document.createElement('div');
      if (role === 'assistant') {
        el.className = 'chat-bubble assistant preview-area';
        el.innerHTML = parseMd(truncateForHistoryPreview(text));
      } else {
        el.className = 'chat-bubble user preview-area';
        if (imageDataUrl) {
          var bubbleImg = document.createElement('img');
          bubbleImg.className = 'chat-bubble-image';
          bubbleImg.src = imageDataUrl;
          el.appendChild(bubbleImg);
        }
        if (text) {
          var textEl = document.createElement('div');
          textEl.innerHTML = parseMd(truncateForHistoryPreview(text));
          el.appendChild(textEl);
        }
      }
      historyModalChat.appendChild(el);
    }

    // kimi-gemma専用: 回答(生成コード)バブルの下に、外部レビュー結果を
    // 別要素の注釈カードとして追加する。r.review_noteが無ければ何もしない。
    function appendReviewNoteCard(reviewNote) {
      if (!reviewNote || !reviewNote.text) return;
      var card = document.createElement('div');
      card.className = 'review-note-card';
      var label = document.createElement('div');
      label.className = 'review-note-label';
      label.textContent = '🔍 ' + reviewNote.label;
      var body = document.createElement('div');
      body.className = 'preview-area';
      body.innerHTML = parseMd(truncateForHistoryPreview(reviewNote.text));
      card.appendChild(label);
      card.appendChild(body);
      historyModalChat.appendChild(card);
    }

    // ===== キーワードハイライト(画像添付会話プレビュー等と共通) =====
    ${getKeywordHighlightScript()}
    ${getVectorizeAndBulkRegisterScript()}

    function buildAllKeywords() {
      var all = [];
      if (historyModalCurrentKeyword) {
        if (Array.isArray(historyModalCurrentKeyword)) {
          all = all.concat(historyModalCurrentKeyword.filter(Boolean));
        } else {
          all.push(historyModalCurrentKeyword);
        }
      }
      historyModalKeywordsFromDB.forEach(function(k) {
        var kw = k && typeof k === 'object' ? k.keyword : k;
        if (kw && all.indexOf(kw) === -1) all.push(kw);
      });
      return all;
    }

    function applyAllDbKeywordHighlights() {
      historyModalHighlightActive = true;
      historyModalChat.classList.remove('highlights-hidden');
      clearKeywordHighlights(historyModalChat);
      var allKws = buildAllKeywords();
      if (allKws.length > 0) applyKeywordHighlight(historyModalChat, allKws);
      historyModalDBKeywordsApplied = true;
      updateHighlightToggleBtn();
    }

    function fetchShareKeywords(shareId, cb) {
      fetch('/api/aichat/share-keywords?shareId=' + encodeURIComponent(String(shareId)), { credentials: 'same-origin' })
        .then(function(res) { return res.json(); })
        .then(function(d) {
          historyModalKeywordsFromDB = d.keywords || [];
          updateHighlightToggleBtn();
          if (cb) cb();
        })
        .catch(function() {
          updateHighlightToggleBtn();
          if (cb) cb();
        });
    }

    function renderKeywordChips(show) {
      var chipsEl = document.getElementById('historyModalKeywordChips');
      if (!chipsEl) return;
      if (!show || historyModalKeywordsFromDB.length === 0) {
        chipsEl.style.display = 'none';
        chipsEl.innerHTML = '';
        return;
      }
      chipsEl.innerHTML = '';
      chipsEl.style.display = 'flex';
      var sorted = historyModalKeywordsFromDB.slice().sort(function(a, b) {
        var ca = typeof a === 'object' ? (a.count || 0) : 0;
        var cb = typeof b === 'object' ? (b.count || 0) : 0;
        return cb - ca;
      });
      sorted.forEach(function(item) {
        var kw = typeof item === 'object' ? item.keyword : item;
        var cnt = typeof item === 'object' ? item.count : null;
        var isClassified = typeof item === 'object' ? !!item.is_classified : false;
        var isActive = kw === historyModalActiveChipKeyword;
        var label = cnt != null ? escHtml(kw) + ' <span style="opacity:0.6">(' + cnt + ')</span>' : escHtml(kw);
        var chip = document.createElement('span');
        chip.className = 'hist-kw-chip ' + (isClassified ? 'hist-kw-chip-cls' : 'hist-kw-chip-unc') + (isActive ? ' hist-kw-chip-active' : '');
        chip.innerHTML = label;
        chip.title = kw + (cnt != null ? ' (出現回数: ' + cnt + ')' : '') + (isClassified ? ' [分類済]' : ' [未分類]');
        chip.addEventListener('click', function() {
          if (historyModalKwEditMode && !isClassified) {
            openKwClassifyModal(kw, function() {
              if (historyModalCurrentId) fetchShareKeywords(historyModalCurrentId, function() { renderKeywordChips(true); });
            });
            return;
          }
          historyModalChipsPinned = true;
          historyModalActiveChipKeyword = kw;
          clearKeywordHighlights(historyModalChat);
          applyKeywordHighlight(historyModalChat, kw);
          historyModalHighlightActive = true;
          historyModalChat.classList.remove('highlights-hidden');
          var first = historyModalChat.querySelector('.kw-highlight');
          if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
          chipsEl.querySelectorAll('.hist-kw-chip').forEach(function(c) { c.classList.remove('hist-kw-chip-active'); });
          chip.classList.add('hist-kw-chip-active');
          updateHighlightToggleBtn();
        });
        chipsEl.appendChild(chip);
      });
    }

    function updateHighlightToggleBtn() {
      var marks = historyModalChat.querySelectorAll('.kw-highlight');
      var highlightsVisible = marks && marks.length > 0 && historyModalHighlightActive;
      renderKeywordChips(!highlightsVisible || historyModalChipsPinned);
      if (!marks || marks.length === 0) {
        if (historyModalKeywordsFromDB.length > 0) {
          historyModalHighlightToggleBtn.style.opacity = '1';
          historyModalHighlightToggleBtn.title = '🔑 クリックでキーワードをハイライト表示';
        } else {
          historyModalHighlightToggleBtn.style.opacity = '0.2';
          historyModalHighlightToggleBtn.title = 'キーワードハイライトなし';
        }
        return;
      }
      if (historyModalHighlightActive) {
        historyModalHighlightToggleBtn.style.opacity = '1';
        historyModalHighlightToggleBtn.title = '🔑 ハイライト表示中（クリックで非表示）';
      } else {
        historyModalHighlightToggleBtn.style.opacity = '0.35';
        historyModalHighlightToggleBtn.title = '🔑 ハイライト非表示（クリックで表示）';
      }
    }

    function showResultsPanel(r, keyword) {
      closeHistoryModal();
      resultsPanelQ.innerHTML = '';
      if (r.image_data_url) {
        var resultsPanelImg = document.createElement('img');
        resultsPanelImg.className = 'chat-bubble-image';
        resultsPanelImg.src = r.image_data_url;
        resultsPanelQ.appendChild(resultsPanelImg);
      }
      resultsPanelQ.appendChild(document.createTextNode(r.question));
      resultsPanelA.innerHTML = parseMd(truncateForHistoryPreview(r.answer));
      if (r.review_note && r.review_note.text) {
        resultsPanelReviewLabel.textContent = '🔍 ' + r.review_note.label;
        resultsPanelReview.innerHTML = parseMd(truncateForHistoryPreview(r.review_note.text));
        resultsPanelReviewCol.style.display = '';
      } else {
        resultsPanelReviewCol.style.display = 'none';
        resultsPanelReview.innerHTML = '';
      }
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
    var historyModalHighlightToggleBtn = document.getElementById('historyModalHighlightToggleBtn');
    var historyModalKwEditToggleBtn = document.getElementById('historyModalKwEditToggleBtn');
    var currentHistoryQuestion = '';
    var historyModalCurrentModel = '';
    var historyModalHighlightActive = true;
    var historyModalCurrentKeyword = '';
    var historyModalKeywordsFromDB = [];
    var historyModalDBKeywordsApplied = false;
    var historyModalChipsPinned = false;
    var historyModalActiveChipKeyword = '';
    var historyModalKwEditMode = false;

    if (historyModalKwEditToggleBtn) {
      historyModalKwEditToggleBtn.addEventListener('click', function() {
        historyModalKwEditMode = !historyModalKwEditMode;
        historyModalKwEditToggleBtn.style.opacity = historyModalKwEditMode ? '1' : '0.4';
        historyModalKwEditToggleBtn.style.background = historyModalKwEditMode ? 'var(--accent-color,#667eea)' : '';
        historyModalKwEditToggleBtn.style.color = historyModalKwEditMode ? '#fff' : '';
      });
    }

    function renderSubqueryLinks(items) {
      if (!items || items.length === 0) {
        historyModalSubqueryLinks.style.display = 'none';
        historyModalSubqueryLinks.innerHTML = '';
        return;
      }
      var html = '<div style="font-weight:600;margin-bottom:4px;color:var(--text-secondary);">追加質問リンク</div>';
      html += '<div style="display:flex;flex-direction:column;gap:4px;">';
      items.forEach(function(item) {
        var dotColor = (item.model && MODEL_COLORS && MODEL_COLORS[item.model]) ? MODEL_COLORS[item.model] : '#aaaaaa';
        html += '<div style="display:flex;gap:8px;align-items:center;">';
        html += '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + dotColor + ';flex-shrink:0;" title="' + escHtml(item.model || '') + '"></span>';
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

    function renderHistoryModalTokens(r) {
      var parts = [];
      if (r.input_tokens != null) parts.push('in:' + r.input_tokens);
      if (r.output_tokens != null) parts.push('out:' + r.output_tokens);
      historyModalTokens.textContent = parts.length > 0 ? '　📊 ' + parts.join(' / ') : '';
    }

    function showHistoryModal(r, keyword) {
      closeResultsPanel();
      historyModalSwipeItems = [];
      historyModalSwipeIndex = 0;
      historyModalSwipeDataCache = {};
      historyModalSwipeDataCache[r.id] = r;
      historyModalHighlightActive = true;
      historyModalChipsPinned = true;
      historyModalActiveChipKeyword = '';
      historyModalCurrentKeyword = keyword || '';
      historyModalKeywordsFromDB = [];
      historyModalDBKeywordsApplied = false;
      historyModalChat.classList.remove('highlights-hidden');
      historyModalChat.innerHTML = '';
      appendHistoryModalBubble(r.question, 'user', r.image_data_url);
      appendHistoryModalBubble(r.answer, 'assistant');
      appendReviewNoteCard(r.review_note);
      if (keyword) applyKeywordHighlight(historyModalChat, keyword);
      updateHighlightToggleBtn();
      historyModalDateLink.textContent = r.created_at.slice(0, 10);
      historyModalTime.textContent = ' ' + r.created_at.slice(11, 16);
      var dotColor = MODEL_COLORS[r.model] || '';
      var dotStyle = dotColor ? 'display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dotColor + ';margin-right:4px;vertical-align:middle;' : '';
      historyModalMeta.innerHTML = '<span class="history-modal-model-filter-btn" style="cursor:pointer;' + (dotColor ? 'color:' + dotColor + ';' : '') + 'text-decoration:underline dotted;" title="モデルで絞り込む">' + (dotStyle ? '<span style="' + dotStyle + '"></span>' : '') + escHtml(shortModelName(r.model)) + '</span>' + '　👁 ' + (r.access_count || 0);
      renderHistoryModalTokens(r);
      historyModalShareLink.href = '/s/' + r.user_hash + '/' + r.id;
      historyModalCurrentId = r.id;
      currentHistoryQuestion = r.question || '';
      historyModalCurrentModel = r.model || '';
      refreshJevValuesButtonState();
      historyModalSubqueryLinks.style.display = 'none';
      historyModalSubqueryLinks.innerHTML = '';
      historyModalBackdrop.style.zIndex = String(getNextZ());
      historyModalBackdrop.classList.add('open');
      historyModalBackdrop.setAttribute('aria-hidden', 'false');
      if (currentHistoryQuestion) loadSubqueryLinks(currentHistoryQuestion);
      fetch('/api/aichat/share-keywords?shareId=' + encodeURIComponent(String(r.id)), { credentials: 'same-origin' })
        .then(function(res) { return res.json(); })
        .then(function(d) {
          historyModalKeywordsFromDB = d.keywords || [];
          updateHighlightToggleBtn();
        })
        .catch(function() {});
      var swipeUrl = r.question_hash
        ? '/api/aichat/shares-by-question-hash?hash=' + encodeURIComponent(String(r.question_hash))
        : '/api/aichat/shares-by-question?question=' + encodeURIComponent(String(r.question));
      fetch(swipeUrl, { credentials: 'same-origin' })
        .then(function(res) { return res.json(); })
        .then(function(d) {
          var siblings = d.items || [];
          if (siblings.length > 1) {
            historyModalSwipeItems = siblings;
            var idx = 0;
            for (var i = 0; i < siblings.length; i++) {
              if (String(siblings[i].id) === String(r.id)) { idx = i; break; }
            }
            historyModalSwipeIndex = idx;
            renderHistoryModalModelDots();
          }
        })
        .catch(function() {});
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
      sidebarResults.innerHTML = '';
      currentResults = [];
      sidebarStatus.textContent = '検索中...';
      currentMode = 'search';
      currentDateLabel = '';
      doSearch(kw);
      historyModalSearchInput.value = '';
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
    var linkedQuestionsSortToggle = document.getElementById('linkedQuestionsSortToggle');
    var linkedQuestionsAllItems = [];
    var linkedQuestionsFilter = 'all';
    var linkedQuestionsSortOrder = 'default';
    var subqueriesAllItems = [];
    var sqSelectedCats = {};
    var sqSelectedGroupId = null;
    var subqueriesCats = [];
    var subqueriesGroups = [];
    var subqueriesKwCatMap = {};
    var subqueriesClassifiedSet = {};

    function renderLinkedQuestions(items) {
      var sorted = linkedQuestionsSortOrder === 'newest'
        ? items.slice().sort(function(a, b) {
            var ai = parseInt(a.share_id) || 0;
            var bi = parseInt(b.share_id) || 0;
            return bi - ai;
          })
        : items.slice();
      var filtered = linkedQuestionsFilter === 'all'
        ? sorted
        : sorted.filter(function(it) {
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
      document.querySelectorAll('div[data-overlay]').forEach(function(el) {
        var z = parseInt(el.style.zIndex) || 0;
        if (z > max && z < 9000) max = z;
      });
      var staticZDefaults = {
        linkedQuestionsOverlay: 700, nekoResultsModal: 700, impressionsSubqueryModal: 800,
        kwClassifyListModal: 820, sqKwQuestionsOverlay: 850, addSubqueryModal: 900, historyModalBackdrop: 750,
        tokenUsageModal: 820, dailyStatsModal: 820, modelDotDropdown: 700,
        kwColorPaletteModal: 900, kwCatGroupModal: 920, searchLogRecordModal: 880,
        canvasSearchModal: 890, ztTreeModal: 895, ztBgeModal: 905, ztCacheModal: 910, ztOverviewModal: 915,
        ztKeywordSharesModal: 920, cursorAgentAnswerModal: 700, qsearchAnswerModal: 700,
        jevValuesModal: 820,
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

    /**
     * 送信直後、指定中のモデルでフォールバックせず処理されたか、
     * フォールバックして別モデルに切り替わったかをトーストで明示する。
     * ok=trueなら薄緑色で「送信完了」、falseならフォールバック後の
     * 実際に使われたモデルの色(MODEL_COLORS)を背景にして
     * 「送信失敗 フォールバックし継続」を表示する。
     * モデル色が取得できない場合は無彩色(グレー)にフォールバックする。
     */
    function showAichatSendToast(ok, fallbackModelColor) {
      var container = document.getElementById('aichatSendToastContainer');
      if (!container) return;
      var toast = document.createElement('div');
      if (ok) {
        toast.className = 'aichat-send-toast aichat-send-toast-ok';
        toast.textContent = '送信完了';
      } else {
        toast.className = 'aichat-send-toast';
        toast.style.background = fallbackModelColor || '#718096';
        toast.style.color = '#fff';
        toast.textContent = '送信失敗 フォールバックし継続';
      }
      container.appendChild(toast);
      setTimeout(function() {
        toast.classList.add('aichat-send-toast-fade');
        setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
      }, 4000);
    }

    /**
     * showAichatSendToastと同じ #aichatSendToastContainer を使う汎用トースト。
     * ✂️ボタン(切り出し・キーワード登録・ベクタ化完了の各段階)のように、
     * 固定文言でなく呼び出し元ごとに異なるメッセージ・配色を出したい場合に使う。
     */
    function showAichatToast(message, className) {
      var container = document.getElementById('aichatSendToastContainer');
      if (!container) return;
      var toast = document.createElement('div');
      toast.className = 'aichat-send-toast' + (className ? ' ' + className : '');
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(function() {
        toast.classList.add('aichat-send-toast-fade');
        setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
      }, 4000);
    }

    function openQuestionHashModal(hash) {
      if (!hash) return;
      var overlay = document.createElement('div');
      overlay.setAttribute('data-overlay', '');
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
      overlay.setAttribute('data-overlay', '');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:' + getNextZ() + ';display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary);border-radius:10px;padding:20px;min-width:240px;max-width:340px;box-shadow:0 8px 32px rgba(0,0,0,0.18);';
      var title = document.createElement('div');
      title.textContent = '別のモデルに質問する';
      title.style.cssText = 'font-weight:700;margin-bottom:12px;font-size:14px;';
      box.appendChild(title);
      var cachedModelMap = {};
      historyModalSwipeItems.forEach(function(item, idx) {
        if (item.model !== historyModalCurrentModel) {
          cachedModelMap[item.model] = idx;
        }
      });
      MODEL_LIST.forEach(function(entry) {
        var m = entry.value;
        var btn = document.createElement('button');
        var dotColor = MODEL_COLORS[m] || '';
        var isCurrent = m === historyModalCurrentModel;
        var isCached = Object.prototype.hasOwnProperty.call(cachedModelMap, m);
        var dotHtml = dotColor ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dotColor + ';margin-right:6px;vertical-align:middle;flex-shrink:0;"></span>' : '';
        var cachedBadge = isCached ? '<span style="margin-left:auto;font-size:10px;background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:1px 6px;flex-shrink:0;">回答済み</span>' : '';
        btn.innerHTML = dotHtml + escHtml(shortModelName(m)) + (isCurrent ? ' <span style="font-size:11px;opacity:0.6;">（現在）</span>' : '') + cachedBadge;
        var bgColor = isCurrent ? 'rgba(102,126,234,0.08)' : (isCached ? '#eff6ff' : 'var(--bg-primary)');
        var borderColor = isCurrent ? 'var(--accent-color,#667eea)' : (isCached ? '#bfdbfe' : 'var(--border-color)');
        btn.style.cssText = 'display:flex;align-items:center;width:100%;text-align:left;padding:8px 12px;margin-bottom:6px;border-radius:6px;border:1px solid ' + borderColor + ';background:' + bgColor + ';color:var(--text-primary);cursor:' + (isCurrent ? 'default' : 'pointer') + ';font-size:13px;';
        if (!isCurrent) {
          if (isCached) {
            btn.addEventListener('click', function() {
              document.body.removeChild(overlay);
              var targetIdx = cachedModelMap[m];
              var delta = targetIdx - historyModalSwipeIndex;
              if (delta !== 0) historyModalSwipeNavigate(delta);
            });
          } else {
            btn.addEventListener('click', function() {
              openReAskConfirmModal(m, currentHistoryQuestion, overlay);
            });
          }
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
      overlay.setAttribute('data-overlay', '');
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
        historyModalBackdrop.classList.remove('fullscreen');
        historyModal.classList.remove('fullscreen');
        historyModal.classList.remove('frames-hidden');
        historyModalFullscreenBtn.textContent = '⬜︎';
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
      var isLocalCommand = usedModel === 'local/neko';
      var isFallback = !!data.fallbackUsed || (data.usedModel != null && data.usedModel !== selectedModel);
      var ansBubble = buildAssistantBubble(responseText, selectedModel, isFallback, extractRespUsage(data), isLocalCommand, data.nekoResults, data.svg, data.nekoCursorResults, data.shareId);
      box.appendChild(ansBubble);
      if (!isLocalCommand) {
        appendAiResponseRow(box, question, responseText, usedModel, data.shareId, data.userHash);
      }
    }

    function openReAskResponseModal(selectedModel, question) {
      var overlay = document.createElement('div');
      overlay.setAttribute('data-overlay', '');
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
      qBubble.className = 'chat-bubble user preview-area';
      qBubble.innerHTML = parseMd(question);
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
        body: JSON.stringify({ message: question, model: selectedModel, source: 'textbox' })
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
      overlay.setAttribute('data-overlay', '');
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
      linkedQuestionsSortOrder = 'default';
      linkedQuestionsSortToggle.textContent = '現状順';
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

    linkedQuestionsSortToggle.addEventListener('click', function() {
      linkedQuestionsSortOrder = linkedQuestionsSortOrder === 'newest' ? 'default' : 'newest';
      linkedQuestionsSortToggle.textContent = linkedQuestionsSortOrder === 'newest' ? '最新順' : '現状順';
      renderLinkedQuestions(linkedQuestionsAllItems);
    });
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

    function renderSubqueriesList() {
      var classifiedSet = subqueriesClassifiedSet;
      var filtered = Object.keys(sqSelectedCats).length > 0
        ? subqueriesAllItems.filter(function(item) {
            return (item.keywords || []).some(function(kw) {
              var cids = subqueriesKwCatMap[kw.keyword] || [];
              return cids.some(function(id) { return sqSelectedCats[String(id)]; });
            });
          })
        : subqueriesAllItems;

      var html = '';

      if (subqueriesCats.length > 0) {
        html += '<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border-color);">';
        subqueriesCats.forEach(function(cat) {
          html += '<span class="kw-cat-summary-badge" data-cat-id="' + escHtml(String(cat.id)) + '" data-cat-color="' + escHtml(cat.color || '#6366f1') + '" style="display:inline-block;font-size:11px;padding:3px 11px;border-radius:2px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-muted);cursor:pointer;white-space:nowrap;margin:1px;">' + escHtml(cat.name) + ' (' + cat.kw_count + ')</span>';
        });
        html += '</div>';
      }

      if (subqueriesGroups.length > 0) {
        html += '<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border-color);">';
        html += '<span style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-right:6px;">大分類 :</span>';
        subqueriesGroups.forEach(function(g) {
          html += '<span class="kw-group-summary-badge" data-group-id="' + escHtml(String(g.id)) + '" data-cat-ids="' + escHtml(JSON.stringify(g.category_ids || [])) + '" style="display:inline-block;font-size:11px;padding:3px 11px;border-radius:2px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-muted);cursor:pointer;white-space:nowrap;margin:1px;">' + escHtml(g.group_name) + ' (' + (g.kw_count || 0) + ')</span>';
        });
        html += '</div>';
      }

      if (filtered.length === 0) {
        html += '<div style="color:var(--text-muted);padding:10px;">' + (subqueriesAllItems.length > 0 ? '選択中の分類に該当するサブクエリがありません' : 'サブクエリがまだ登録されていません') + '</div>';
      } else {
        html += '<table class="search-log-table"><thead><tr>' +
          '<th style="text-align:right;width:56px;">追加質問数</th>' +
          '<th>サブクエリ</th>' +
          '<th>キーワード</th>' +
          '</tr></thead><tbody>';
        var sqCatColorMap = {};
        subqueriesCats.forEach(function(cat) { sqCatColorMap[String(cat.id)] = cat.color || '#6366f1'; });
        filtered.forEach(function(item) {
          var kwHtml = '';
          if (item.keywords && item.keywords.length > 0) {
            item.keywords.forEach(function(kw) {
              var cids = subqueriesKwCatMap[kw.keyword] || [];
              var activeCid = null;
              cids.forEach(function(id) {
                if (activeCid == null && sqSelectedCats[String(id)]) activeCid = String(id);
              });
              var isActive = activeCid != null;
              var kwClass = 'sq-kw-badge';
              var kwStyle = '';
              if (isActive) {
                var catColor = kwPaletteActColor || sqCatColorMap[activeCid] || '#6366f1';
                kwClass += ' sq-kw-badge-active';
                kwStyle = ' style="--kwcat-color:' + escHtml(catColor) + ';--kwcat-bg:' + escHtml(catColor) + '33;"';
              } else if (classifiedSet[kw.keyword]) {
                kwClass += ' kw-kw-classified';
              }
              kwHtml += '<span class="' + kwClass + '" data-subquery-id="' + escHtml(String(item.id)) + '" data-subquery="' + escHtml(item.query) + '" data-keyword="' + escHtml(kw.keyword) + '"' + kwStyle + '>' + escHtml(kw.keyword) + ' (' + kw.cnt + ')</span>';
            });
          }
          html += '<tr>';
          html += '<td style="text-align:right;color:var(--text-muted);">' + (item.link_count || 0) + '</td>';
          html += '<td class="sq-query-cell" data-subquery-id="' + escHtml(String(item.id)) + '" data-subquery-query="' + escHtml(item.query) + '" style="cursor:pointer;color:var(--accent-color,#667eea);text-decoration:underline dotted;" title="タップしてこのサブクエリを含む質問一覧を表示">' + escHtml(item.query) + '</td>';
          html += '<td>' + kwHtml + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table>';
      }

      subqueriesListBody.innerHTML = html;

      subqueriesListBody.querySelectorAll('.kw-cat-summary-badge').forEach(function(sqCatEl) {
        var catId = sqCatEl.dataset.catId;
        var catColor = sqCatEl.dataset.catColor || '#6366f1';
        // 大分類グループを選択中は、その大分類に属さない中分類カテゴリの
        // 色を一時的に暗い色へ差し替え、属する中分類カテゴリ(元の色のまま)
        // と一目で区別できるようにする(キーワード分類モーダルと同様)。
        var isDimmed = !!sqSelectedGroupId && !sqSelectedCats[catId];
        var displayColor = isDimmed ? KW_CAT_DIM_COLOR : catColor;
        sqCatEl.style.borderColor = displayColor;
        sqCatEl.style.color = displayColor;
        sqCatEl.style.setProperty('--kw-pal-cat', displayColor);
        sqCatEl.style.setProperty('--kw-pal-cat-bg', displayColor + '22');
        sqCatEl.classList.toggle('kw-cat-badge-dimmed', isDimmed);
        sqCatEl.classList.toggle('kw-cat-badge-active', !!sqSelectedCats[catId]);
        sqCatEl.addEventListener('click', function() {
          if (sqSelectedCats[catId]) { delete sqSelectedCats[catId]; } else { sqSelectedCats[catId] = true; }
          renderSubqueriesList();
        });
      });

      subqueriesListBody.querySelectorAll('.kw-group-summary-badge').forEach(function(sqGrpEl) {
        sqGrpEl.classList.toggle('kw-group-badge-active', sqGrpEl.dataset.groupId === sqSelectedGroupId);
        sqGrpEl.addEventListener('click', function() {
          var groupId = sqGrpEl.dataset.groupId;
          var catIds = [];
          try { catIds = JSON.parse(sqGrpEl.dataset.catIds || '[]'); } catch(e) {}
          if (sqSelectedGroupId === groupId) {
            sqSelectedGroupId = null;
            sqSelectedCats = {};
          } else {
            sqSelectedGroupId = groupId;
            sqSelectedCats = {};
            catIds.forEach(function(id) { sqSelectedCats[String(id)] = true; });
          }
          renderSubqueriesList();
        });
      });
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
      var qCell = e.target.closest('.sq-query-cell');
      if (qCell) {
        openSubquerySelectModal();
        return;
      }
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
      sqSelectedCats = {};
      sqSelectedGroupId = null;
      subqueriesListBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      Promise.allSettled([
        fetch('/api/aichat/subqueries', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/all-keywords', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/keyword-categories-summary', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/category-groups', { credentials: 'same-origin' }).then(function(r) { return r.json(); })
      ]).then(function(results) {
        var sqData    = results[0].status === 'fulfilled' ? results[0].value : {};
        var kwData    = results[1].status === 'fulfilled' ? results[1].value : {};
        var catData   = results[2].status === 'fulfilled' ? results[2].value : {};
        var groupData = results[3].status === 'fulfilled' ? results[3].value : {};
        subqueriesAllItems = sqData.items || [];
        subqueriesCats = catData.categories || [];
        subqueriesGroups = (groupData.groups || []).slice().sort(function(a, b) { return (b.kw_count || 0) - (a.kw_count || 0); });
        subqueriesKwCatMap = {};
        subqueriesClassifiedSet = {};
        (kwData.keywords || []).forEach(function(kw) {
          var ids = [];
          if (kw.category_pairs) {
            String(kw.category_pairs).split(',').forEach(function(pair) {
              var sep = pair.indexOf(':');
              if (sep > 0) ids.push(pair.slice(0, sep));
            });
          } else if (kw.category_id != null) {
            ids.push(String(kw.category_id));
          }
          if (ids.length > 0) subqueriesKwCatMap[kw.keyword] = ids;
          if (kw.is_classified) subqueriesClassifiedSet[kw.keyword] = true;
        });
        renderSubqueriesList();
      }).catch(function() { subqueriesListBody.innerHTML = '<div style="color:var(--text-muted);">取得に失敗しました</div>'; });
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
              .then(function(d2) { subqueriesAllItems = d2.items || []; renderSubqueriesList(); })
              .catch(function() {});
          } else {
            subqueriesAddMsg.textContent = d.error || '追加に失敗しました';
          }
        })
        .catch(function() { subqueriesAddMsg.textContent = '通信エラーが発生しました'; });
    });

    // ===== サブクエリ選択→質問一覧モーダル =====
    function openSubquerySelectModal() {
      var sorted = subqueriesAllItems.slice().sort(function(a, b) { return (b.link_count || 0) - (a.link_count || 0); });
      var overlay = document.createElement('div');
      overlay.setAttribute('data-overlay', '');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:' + getNextZ() + ';display:flex;align-items:flex-start;justify-content:center;padding-top:80px;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary);border-radius:12px;width:min(480px,92vw);max-height:70vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.22);';
      var head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border-color);flex-shrink:0;';
      var title = document.createElement('span');
      title.textContent = 'サブクエリを選択（追加質問の多い順）';
      title.style.cssText = 'font-size:14px;font-weight:700;';
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:18px;color:var(--text-muted);padding:0 4px;';
      closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      head.appendChild(title);
      head.appendChild(closeBtn);
      box.appendChild(head);
      var listDiv = document.createElement('div');
      listDiv.style.cssText = 'overflow-y:auto;flex:1;';
      if (sorted.length === 0) {
        var empty = document.createElement('div');
        empty.textContent = 'サブクエリがありません';
        empty.style.cssText = 'color:var(--text-muted);padding:16px 18px;font-size:13px;';
        listDiv.appendChild(empty);
      } else {
        sorted.forEach(function(item) {
          var row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:11px 18px;cursor:pointer;border-bottom:1px solid var(--border-color);';
          var badge = document.createElement('span');
          badge.textContent = String(item.link_count || 0) + '件';
          badge.style.cssText = 'background:var(--accent-color,#667eea);color:#fff;border-radius:10px;padding:1px 8px;font-size:11px;flex-shrink:0;';
          var label = document.createElement('span');
          label.textContent = item.query;
          label.style.cssText = 'font-size:13px;color:var(--text-primary);';
          row.appendChild(badge);
          row.appendChild(label);
          row.addEventListener('mouseenter', function() { row.style.background = 'var(--bg-primary)'; });
          row.addEventListener('mouseleave', function() { row.style.background = ''; });
          row.addEventListener('click', function() {
            document.body.removeChild(overlay);
            openSubqueryLinkedQuestionsModal(item.id, item.query);
          });
          listDiv.appendChild(row);
        });
      }
      box.appendChild(listDiv);
      overlay.appendChild(box);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
      document.body.appendChild(overlay);
    }

    function renderLinkedQuestionsInto(items, container, onItemClose) {
      if (!items || items.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);padding:12px;">該当する質問がありません</div>';
        return;
      }
      var html = '<table class="search-log-table"><thead><tr>'
        + '<th>質問</th>'
        + '<th>サブクエリ / リンク</th></tr></thead><tbody>';
      items.forEach(function(item) {
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
          + '<td class="kw-q-link" data-share-id="' + escHtml(item.share_id || '') + '" style="vertical-align:top;max-width:220px;cursor:pointer;padding-left:8px;">' + escHtml(item.question) + '</td>'
          + '<td style="vertical-align:top;">' + linkRows + '</td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;
      container.querySelectorAll('td.kw-q-link').forEach(function(td) {
        td.addEventListener('click', function() {
          var shareId = td.getAttribute('data-share-id');
          if (shareId) {
            if (onItemClose) onItemClose();
            openHistoryModalByShareId(shareId, '[]');
          }
        });
      });
      container.querySelectorAll('.lk-hash-badge').forEach(function(badge) {
        badge.addEventListener('click', function(e) {
          e.stopPropagation();
          openQuestionHashModal(badge.getAttribute('data-hash'));
        });
      });
    }

    function openSubqueryLinkedQuestionsModal(subqueryId, subqueryQuery) {
      var overlay = document.createElement('div');
      overlay.setAttribute('data-overlay', '');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:' + getNextZ() + ';display:flex;align-items:flex-start;justify-content:center;padding-top:56px;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary);border-radius:12px;width:min(720px,96vw);max-height:calc(100vh - 80px);display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.25);';
      var head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border-color);flex-shrink:0;';
      var title = document.createElement('span');
      title.style.cssText = 'font-size:14px;font-weight:700;';
      title.textContent = '「' + subqueryQuery + '」を含む質問一覧';
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:18px;color:var(--text-muted);padding:0 4px;';
      closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      head.appendChild(title);
      head.appendChild(closeBtn);
      box.appendChild(head);
      var bodyDiv = document.createElement('div');
      bodyDiv.className = 'search-log-body';
      bodyDiv.innerHTML = '<div class=\\"search-log-loading\\">読み込み中...</div>';
      box.appendChild(bodyDiv);
      overlay.appendChild(box);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
      document.body.appendChild(overlay);
      function doRender(allItems) {
        var filtered = allItems.filter(function(it) {
          return (it.links || []).some(function(lk) { return lk.subquery_id === subqueryId; });
        });
        renderLinkedQuestionsInto(filtered, bodyDiv, function() { if (overlay.parentNode) document.body.removeChild(overlay); });
      }
      if (linkedQuestionsAllItems.length > 0) {
        doRender(linkedQuestionsAllItems);
      } else {
        fetch('/api/aichat/share-subquery-links/all', { credentials: 'same-origin' })
          .then(function(r) { return r.json(); })
          .then(function(d) { linkedQuestionsAllItems = d.items || []; doRender(linkedQuestionsAllItems); })
          .catch(function() { bodyDiv.innerHTML = '<div style="color:var(--text-muted);padding:12px;">取得に失敗しました</div>'; });
      }
    }

    // ===== 追加質問モーダル =====
    var addSubqueryModal = document.getElementById('addSubqueryModal');
    var addSubqueryClose = document.getElementById('addSubqueryClose');
    var addSubqueryList = document.getElementById('addSubqueryList');
    var addSubquerySelected = document.getElementById('addSubquerySelected');
    var addSubqueryUrl = document.getElementById('addSubqueryUrl');
    var addSubquerySubmit = document.getElementById('addSubquerySubmit');
    var addSubqueryMsg = document.getElementById('addSubqueryMsg');
    var selectedSubqueryId = null;

    function openAddSubqueryModal(baseZ) {
      var z = (baseZ && baseZ > 0) ? baseZ + 100 : getNextZ();
      addSubqueryModal.style.zIndex = String(z);
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

    historyModalHighlightToggleBtn.addEventListener('click', function() {
      if (historyModalKeywordsFromDB.length > 0 && !historyModalDBKeywordsApplied) {
        historyModalChipsPinned = false;
        historyModalHighlightActive = true;
        historyModalChat.classList.remove('highlights-hidden');
        clearKeywordHighlights(historyModalChat);
        applyKeywordHighlight(historyModalChat, buildAllKeywords());
        historyModalDBKeywordsApplied = true;
        updateHighlightToggleBtn();
        return;
      }
      if (!historyModalDBKeywordsApplied && historyModalCurrentId) { fetchShareKeywords(historyModalCurrentId, applyAllDbKeywordHighlights); return; }
      var marks = historyModalChat.querySelectorAll('.kw-highlight');
      if (!marks || marks.length === 0) return;
      historyModalHighlightActive = !historyModalHighlightActive;
      if (historyModalHighlightActive) {
        historyModalChipsPinned = false;
        historyModalChat.classList.remove('highlights-hidden');
      } else {
        historyModalChat.classList.add('highlights-hidden');
      }
      updateHighlightToggleBtn();
    });

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

    // アイコン設置(ボタンのイベント配線)〜モーダル処理(状態判定・確認・表示)〜
    // Jev問い合わせ〜DB登録(POST /api/aichat/jev-score)までの一連の流れを
    // 1つのファクトリ関数にまとめたもの。DOM要素と「今どのshareId/modelを
    // 見ているか」を返すgetContext()だけを差し替えれば、historyModal以外の
    // 場所(将来resultsPanel等に同種のボタンを置く場合)からも
    // createJevValuesWidget(...)を呼ぶだけで同じ挙動を再現できる。
    function createJevValuesWidget(config) {
      var button = config.button;
      var modal = config.modal;
      var body = config.body;
      var closeBtn = config.closeBtn;
      var getContext = config.getContext;
      var onJevComplete = config.onJevComplete;
      var onStateLoaded = config.onStateLoaded;

      // 固定色を使う(CLAUDE.CSS.mdの例外: バッジ・ステータス表示で意味的に
      // 色が固定されているもの、PK/FK/UK/IDXバッジと同じ扱い)。
      var COLORS = { pink: '#ffd6e8', yellow: '#fff8c5', green: '#d1f7dd' };
      var TITLES = {
        pink: 'Jev評価値: 通常のjevテーブルにこの質問+モデルのデータがありません(タップして追加)',
        yellow: 'Jev評価値: テーブルはありますが評価データがまだありません(タップして追加)',
        green: 'Jev評価値: 評価済みです(タップして表示)'
      };

      function gridHtml(values) {
        if (!values || values.length === 0) {
          return '<div class="search-log-loading">評価データがありません</div>';
        }
        var itemsHtml = values.map(function(v) {
          var text = v.value === null || v.value === undefined ? '—' : String(v.value);
          return '<span style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-secondary);min-width:44px;">'
            + '<span style="font-size:10px;color:var(--text-muted);">' + escHtml(String(v.jevLabelId)) + '</span>'
            + '<span style="font-size:14px;color:var(--text-primary);font-weight:600;">' + escHtml(text) + '</span>'
            + '</span>';
        }).join('');
        return '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + itemsHtml + '</div>';
      }

      function applyButtonState(state) {
        button.style.background = COLORS[state] || '';
        button.dataset.jevState = state || '';
        button.title = TITLES[state] || 'Jev評価値';
      }

      function refresh() {
        var ctx = getContext();
        if (!ctx || !ctx.shareId) return;
        var shareIdAtRequest = ctx.shareId;
        fetch(
          '/api/aichat/jev-values?shareId=' + encodeURIComponent(String(shareIdAtRequest)) + '&model=' + encodeURIComponent(ctx.model || ''),
          { credentials: 'same-origin' }
        )
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (getContext().shareId !== shareIdAtRequest) return;
            var state = data && data.state;
            applyButtonState(state);
            if (typeof onStateLoaded === 'function') onStateLoaded(state);
          })
          .catch(function() {
            if (getContext().shareId !== shareIdAtRequest) return;
            applyButtonState('pink');
            if (typeof onStateLoaded === 'function') onStateLoaded('pink');
          });
      }

      function showResult(values, state, extraFooterHtml) {
        applyButtonState(state);
        body.innerHTML = gridHtml(values) + (extraFooterHtml || '');
      }

      function close() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }

      function openModal() {
        modal.style.zIndex = String(getNextZ());
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
      }

      function openValuesDisplay() {
        var ctx = getContext();
        if (!ctx || !ctx.shareId) return;
        openModal();
        body.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
        fetch(
          '/api/aichat/jev-values?shareId=' + encodeURIComponent(String(ctx.shareId)) + '&model=' + encodeURIComponent(ctx.model || ''),
          { credentials: 'same-origin' }
        )
          .then(function(r) { return r.json(); })
          .then(function(data) { showResult(data && data.values, data && data.state, ''); })
          .catch(function() {
            body.innerHTML = '<div class="search-log-loading">読み込みに失敗しました</div>';
          });
      }

      function runJevScoreAndShow() {
        var ctx = getContext();
        var shareIdAtRequest = ctx.shareId;
        var modelAtRequest = ctx.model || '';
        body.innerHTML = '<div class="search-log-loading">Jevへ問い合わせ中...</div>';
        fetch('/api/aichat/jev-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ shareId: shareIdAtRequest, model: modelAtRequest })
        })
          .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
          .then(function(result) {
            if (getContext().shareId !== shareIdAtRequest) return;
            if (!result.ok || !result.data || result.data.verified !== true) {
              var errText = (result.data && result.data.error) || '書き込みに失敗しました';
              body.innerHTML = '<div class="search-log-loading">' + escHtml(errText) + '</div>';
              return;
            }
            showResult(
              result.data.values,
              result.data.state,
              '<div style="margin-top:10px;text-align:center;color:var(--text-primary);font-weight:600;">完了</div>'
            );
            if (typeof onJevComplete === 'function') onJevComplete(shareIdAtRequest, modelAtRequest);
          })
          .catch(function() {
            if (getContext().shareId !== shareIdAtRequest) return;
            body.innerHTML = '<div class="search-log-loading">通信エラーが発生しました</div>';
          });
      }

      function showAddConfirm() {
        openModal();
        body.innerHTML =
          '<div style="text-align:center;padding:12px;">'
          + '<div style="margin-bottom:12px;color:var(--text-primary);">Jev評価データがまだありません。追加しますか?</div>'
          + '<button type="button" id="jevValuesConfirmYes" class="search-hist-btn" style="margin-right:8px;">はい</button>'
          + '<button type="button" id="jevValuesConfirmNo" class="search-hist-btn">いいえ</button>'
          + '</div>';
        var yesBtn = document.getElementById('jevValuesConfirmYes');
        var noBtn = document.getElementById('jevValuesConfirmNo');
        if (noBtn) noBtn.addEventListener('click', close);
        if (yesBtn) yesBtn.addEventListener('click', runJevScoreAndShow);
      }

      button.addEventListener('click', function() {
        var ctx = getContext();
        if (!ctx || !ctx.shareId) return;
        var state = button.dataset.jevState;
        if (state === 'pink' || state === 'yellow') {
          showAddConfirm();
        } else {
          openValuesDisplay();
        }
      });
      // closeBtn/modal(背景)のクリックは「今開いているモーダルを閉じる」だけの
      // 副作用の無い操作なので、同じmodal/closeBtn要素を複数のボタン(複数の
      // AI応答バブル)で共有してcreateJevValuesWidgetを繰り返し呼んでも、
      // 二重登録によるリスナーの積み上がりを避けるため一度だけ配線する。
      if (!modal.dataset.jevModalWired) {
        modal.dataset.jevModalWired = '1';
        closeBtn.addEventListener('click', close);
        modal.addEventListener('click', function(e) {
          if (e.target === modal) close();
        });
      }

      return { refresh: refresh, runJevScoreAndShow: runJevScoreAndShow };
    }

    var historyModalJevValuesWidget = createJevValuesWidget({
      button: historyModalJevValuesBtn,
      modal: jevValuesModal,
      body: jevValuesBody,
      closeBtn: jevValuesClose,
      getContext: function() { return { shareId: historyModalCurrentId, model: historyModalCurrentModel }; }
    });

    // Jev評価値ボタンの右に置く✂️ボタン。クリックされたら
    // (1) GET /api/aichat/shares/:idで既にベクタ化済み(登録済み)かどうかを
    //     確認し、ボタンの黄色/通常表示に反映する(「既登録チェック」)
    // (2) vectorizeAnswerAndExtractKeywordsでPlaMo埋め込みモデルによる
    //     ベクタ化+予備知識キーワード抽出を行う
    // (3) 抽出できたキーワードがあればbulkRegisterUnregisteredKeywordsで
    //     一括登録する
    var HISTORY_MODAL_SCISSORS_DEFAULT_TITLE = 'この回答をベクタ化してキーワードを一括登録する';
    function applyHistoryModalScissorsState(vectorized) {
      historyModalScissorsBtn.style.background = vectorized ? '' : '#fff8c5';
    }
    function refreshHistoryModalScissorsState() {
      if (!historyModalCurrentId) return;
      var shareIdAtRequest = historyModalCurrentId;
      fetch('/api/aichat/shares/' + encodeURIComponent(String(shareIdAtRequest)), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (historyModalCurrentId !== shareIdAtRequest) return;
          applyHistoryModalScissorsState(!!(data && data.vectorized));
        })
        .catch(function() {});
    }
    historyModalScissorsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var shareId = historyModalCurrentId;
      if (!shareId) return;
      historyModalScissorsBtn.disabled = true;
      historyModalScissorsBtn.title = '既登録チェック中...';
      historyModalScissorsBtn.classList.add('scissors-btn-spinning');
      fetch('/api/aichat/shares/' + encodeURIComponent(String(shareId)), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          applyHistoryModalScissorsState(!!(data && data.vectorized));
          historyModalScissorsBtn.title = 'ベクタ化中...';
          return vectorizeAnswerAndExtractKeywords(shareId, AICHAT_SCISSORS_EMBEDDING_MODEL, true);
        })
        .then(function(result) {
          if (result.status < 200 || result.status >= 300 || !result.data) {
            throw new Error((result.data && result.data.error) || 'ベクタ化に失敗しました');
          }
          applyHistoryModalScissorsState(true);
          showAichatToast('✂️切り出し完了', 'aichat-scissors-toast-cyan');
          var keywords = result.data.keywords || [];
          if (!keywords.length) {
            showAichatToast('ベクタ化終了', 'aichat-send-toast-ok');
            return;
          }
          historyModalScissorsBtn.title = 'キーワード一括登録中...';
          return bulkRegisterUnregisteredKeywords(shareId, keywords, {})
            .then(function() {
              showAichatToast('新規キーワード切り出し完了', 'aichat-scissors-toast-neutral');
              showAichatToast('ベクタ化終了', 'aichat-send-toast-ok');
            });
        })
        .catch(function() {})
        .then(function() {
          historyModalScissorsBtn.disabled = false;
          historyModalScissorsBtn.title = HISTORY_MODAL_SCISSORS_DEFAULT_TITLE;
          historyModalScissorsBtn.classList.remove('scissors-btn-spinning');
        });
    });

    function refreshJevValuesButtonState() {
      historyModalJevValuesWidget.refresh();
      refreshHistoryModalScissorsState();
    }

    historyModalClose.addEventListener('click', function() {
      closeHistoryModal();
      clearHistorySelection();
    });
    historyModalFullscreenBtn.addEventListener('click', function() {
      var isFrameless = historyModal.classList.toggle('frames-hidden');
      historyModal.classList.toggle('fullscreen', isFrameless);
      historyModalBackdrop.classList.toggle('fullscreen', isFrameless);
      historyModalFullscreenBtn.textContent = isFrameless ? '🔲' : '⬜︎';
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

    // ===== カラーパレット =====
    var kwPaletteActColor = '';
    function readKwPaletteFromCookies() {
      var map = {};
      document.cookie.split(';').forEach(function(c) {
        var p = c.trim().split('='); map[p[0]] = decodeURIComponent(p.slice(1).join('='));
      });
      return { cat: map['kw_pal_cat'] || '', cls: map['kw_pal_cls'] || '', unc: map['kw_pal_unc'] || '', act: map['kw_pal_act'] || '' };
    }
    function saveKwPaletteToCookies(colors) {
      var maxAge = 60 * 60 * 24 * 365;
      ['cat','cls','unc','act'].forEach(function(k) {
        document.cookie = 'kw_pal_' + k + '=' + encodeURIComponent(colors[k] || '') + '; max-age=' + maxAge + '; path=/; SameSite=Lax; Secure';
      });
    }
    function applyKwPaletteToDom(colors) {
      var r = document.documentElement;
      var cat = colors.cat || '#3b82f6';
      r.style.setProperty('--kw-pal-cat', cat);
      r.style.setProperty('--kw-pal-cat-bg', cat + '33');
      var cls = colors.cls || '#7c3aed';
      r.style.setProperty('--kw-pal-cls', cls);
      if (colors.unc) { r.style.setProperty('--kw-pal-unc-bg', colors.unc + '22'); r.style.setProperty('--kw-pal-unc-fg', colors.unc); }
      else { r.style.removeProperty('--kw-pal-unc-bg'); r.style.removeProperty('--kw-pal-unc-fg'); }
      kwPaletteActColor = colors.act || '';
      if (colors.act) r.style.setProperty('--kw-pal-act', colors.act);
      else r.style.removeProperty('--kw-pal-act');
    }
    (function() { applyKwPaletteToDom(readKwPaletteFromCookies()); })();

    var kwColorPaletteModal = document.getElementById('kwColorPaletteModal');
    var kwColorPaletteClose = document.getElementById('kwColorPaletteClose');
    var kwColorPaletteBody = document.getElementById('kwColorPaletteBody');
    var kwColorPaletteConfirm = document.getElementById('kwColorPaletteConfirm');
    var kwColorPaletteBtn = document.getElementById('kwColorPaletteBtn');
    var pendingPalette = { cat: '', cls: '', unc: '', act: '' };

    function openKwColorPaletteModal() {
      pendingPalette = readKwPaletteFromCookies();
      kwColorPaletteBody.querySelectorAll('.kw-color-swatch').forEach(function(sw) {
        var key = sw.closest('[data-palette-key]') ? sw.closest('[data-palette-key]').dataset.paletteKey : '';
        var col = sw.dataset.color;
        if (key && pendingPalette[key] === col) { sw.classList.add('kw-color-swatch-selected'); }
        else { sw.classList.remove('kw-color-swatch-selected'); }
      });
      kwColorPaletteModal.style.zIndex = String(getNextZ());
      kwColorPaletteModal.classList.add('open');
      kwColorPaletteModal.setAttribute('aria-hidden', 'false');
    }

    kwColorPaletteBody.querySelectorAll('.kw-color-swatch').forEach(function(sw) {
      sw.addEventListener('click', function() {
        var section = sw.closest('[data-palette-key]');
        if (!section) return;
        var key = section.dataset.paletteKey;
        section.querySelectorAll('.kw-color-swatch').forEach(function(s) { s.classList.remove('kw-color-swatch-selected'); });
        sw.classList.add('kw-color-swatch-selected');
        pendingPalette[key] = sw.dataset.color || '';
        applyKwPaletteToDom(pendingPalette);
        var body = document.getElementById('kwClassifyListBody');
        if (body && body.querySelector('.kw-classify-kw-badge')) {
          body.querySelectorAll('.kw-classify-kw-badge').forEach(function(el) {
            var cid = el.dataset.catId;
            if (!cid) { if (pendingPalette.unc) { el.style.background = pendingPalette.unc + '22'; el.style.color = pendingPalette.unc; } else { el.style.background = ''; el.style.color = ''; } }
          });
        }
      });
    });
    kwColorPaletteConfirm.addEventListener('click', function() {
      saveKwPaletteToCookies(pendingPalette);
      kwColorPaletteModal.classList.remove('open');
      kwColorPaletteModal.setAttribute('aria-hidden', 'true');
    });
    kwColorPaletteClose.addEventListener('click', function() {
      kwColorPaletteModal.classList.remove('open'); kwColorPaletteModal.setAttribute('aria-hidden', 'true');
    });
    kwColorPaletteModal.addEventListener('click', function(e) {
      if (e.target === kwColorPaletteModal) { kwColorPaletteModal.classList.remove('open'); kwColorPaletteModal.setAttribute('aria-hidden', 'true'); }
    });
    kwColorPaletteBtn.addEventListener('click', function(e) { e.stopPropagation(); openKwColorPaletteModal(); });

    // ===== 大分類カテゴリグループ =====
    var kwCatGroupModal = document.getElementById('kwCatGroupModal');
    var kwCatGroupClose = document.getElementById('kwCatGroupClose');
    var kwCatGroupBody = document.getElementById('kwCatGroupBody');
    var kwCachedCatGroups = null;

    function renderKwCatGroupList(groups, selectedIds, catMap, ownerGroupId) {
      var isRemoveMode = !!ownerGroupId;
      var html = '';
      if (groups && groups.length > 0) {
        html += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">既存の大分類カテゴリ :</div>';
        html += '<div style="margin-bottom:12px;">';
        groups.forEach(function(g) {
          if (isRemoveMode && String(g.id) !== String(ownerGroupId)) return;
          var matchedNames = (g.category_ids || []).map(function(id) { return catMap[id] ? catMap[id].name : '#' + id; }).join('・');
          html += '<button type="button" class="cg-group-btn" data-group-id="' + escHtml(g.id) + '" data-group-name="' + escHtml(g.group_name) + '" data-group-ids="' + escHtml(JSON.stringify(g.category_ids)) + '" style="display:block;width:100%;text-align:left;margin-bottom:4px;">';
          html += '<span style="font-weight:600;">' + escHtml(g.group_name) + '</span> <span style="font-size:10px;color:var(--text-muted);">(' + escHtml(matchedNames) + ')</span>';
          html += '</button>';
        });
        html += '</div>';
      }
      if (isRemoveMode) {
        html += '<div id="kwCatGroupRemoveRow" style="display:none;margin-top:8px;">';
        html += '<button id="kwCatGroupRemoveBtn" style="padding:7px 14px;font-size:12px;border-radius:4px;border:none;background:#e53e3e;color:#fff;cursor:pointer;width:100%;">この大分類から削除する</button>';
        html += '</div>';
      } else {
        html += '<div style="border-top:1px solid var(--border-color);padding-top:12px;">';
        html += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:6px;">新しい大分類カテゴリとして登録 :</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">選択中のカテゴリ: ' + selectedIds.map(function(id) { return escHtml(catMap[id] ? catMap[id].name : '#' + id); }).join('・') + '</div>';
        html += '<div style="display:flex;gap:6px;align-items:center;">';
        html += '<input id="kwCatGroupNameInput" type="text" maxlength="64" placeholder="大分類名を入力" style="flex:1;padding:6px 10px;font-size:12px;border:1px solid var(--border-color);border-radius:4px;background:var(--card-bg);color:var(--text-primary);">';
        html += '<button id="kwCatGroupConfirm" style="padding:6px 14px;font-size:12px;border-radius:4px;border:none;background:#3b82f6;color:#fff;cursor:pointer;white-space:nowrap;">登録</button>';
        html += '</div>';
        html += '<div id="kwCatGroupError" style="font-size:11px;color:#e53e3e;margin-top:4px;min-height:14px;"></div>';
        html += '</div>';
      }
      kwCatGroupBody.innerHTML = html;
      if (isRemoveMode) {
        var ownerBtn = kwCatGroupBody.querySelector('.cg-group-btn[data-group-id="' + ownerGroupId + '"]');
        var removeRow = document.getElementById('kwCatGroupRemoveRow');
        var removeBtn = document.getElementById('kwCatGroupRemoveBtn');
        if (ownerBtn) {
          ownerBtn.classList.add('cg-group-btn-active');
          ownerBtn.addEventListener('click', function() {
            ownerBtn.classList.toggle('cg-group-btn-active');
            if (removeRow) {
              removeRow.style.display = ownerBtn.classList.contains('cg-group-btn-active') ? 'none' : 'block';
            }
          });
        }
        if (removeBtn) {
          removeBtn.addEventListener('click', function() {
            var confirmOverlay = document.createElement('div');
            confirmOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:' + String(getNextZ()) + ';';
            var confirmBox = document.createElement('div');
            confirmBox.style.cssText = 'background:var(--card-bg);border-radius:10px;padding:22px 24px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.18);';
            confirmBox.innerHTML = '<div style="font-size:13px;line-height:1.6;margin-bottom:18px;color:var(--text-primary);">分類カテゴリ「' + escHtml(kwRemoveFromCatName) + '」を大分類カテゴリから削除します</div>' +
              '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
              '<button id="kwRemoveCatNo" style="padding:7px 16px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;cursor:pointer;">いいえ</button>' +
              '<button id="kwRemoveCatYes" style="padding:7px 16px;border-radius:6px;border:none;background:#e53e3e;color:#fff;font-size:13px;cursor:pointer;">はい</button>' +
              '</div>';
            confirmOverlay.appendChild(confirmBox);
            document.body.appendChild(confirmOverlay);
            confirmBox.querySelector('#kwRemoveCatNo').addEventListener('click', function() {
              document.body.removeChild(confirmOverlay);
            });
            confirmBox.querySelector('#kwRemoveCatYes').addEventListener('click', function() {
              var yesBtn = confirmBox.querySelector('#kwRemoveCatYes');
              yesBtn.disabled = true;
              var removeId = kwRemoveFromCatId;
              fetch('/api/aichat/category-groups/' + encodeURIComponent(String(ownerGroupId)) + '/remove-category', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_id: removeId })
              }).then(function(r) { return r.json(); }).then(function() {
                kwRemoveFromCatId = null;
                kwRemoveFromCatName = '';
                document.body.removeChild(confirmOverlay);
                kwCatGroupModal.classList.remove('open');
                kwCatGroupModal.setAttribute('aria-hidden', 'true');
                renderKwClassifyList();
              }).catch(function() { yesBtn.disabled = false; });
            });
          });
        }
      } else {
        kwCatGroupBody.querySelectorAll('.cg-group-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            if (kwAddToCatId != null) {
              var groupId = btn.dataset.groupId;
              var groupName = btn.dataset.groupName || '';
              var confirmOverlay = document.createElement('div');
              confirmOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:' + String(getNextZ()) + ';';
              var confirmBox = document.createElement('div');
              confirmBox.style.cssText = 'background:var(--card-bg);border-radius:10px;padding:22px 24px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.18);';
              confirmBox.innerHTML = '<div style="font-size:13px;line-height:1.6;margin-bottom:18px;color:var(--text-primary);">「' + escHtml(groupName) + '」に「' + escHtml(kwAddToCatName) + '」を追加登録しますか？</div>' +
                '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
                '<button id="kwAddCatNo" style="padding:7px 16px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:13px;cursor:pointer;">いいえ</button>' +
                '<button id="kwAddCatYes" style="padding:7px 16px;border-radius:6px;border:none;background:#3b82f6;color:#fff;font-size:13px;cursor:pointer;">はい</button>' +
                '</div>';
              confirmOverlay.appendChild(confirmBox);
              document.body.appendChild(confirmOverlay);
              confirmBox.querySelector('#kwAddCatNo').addEventListener('click', function() {
                document.body.removeChild(confirmOverlay);
              });
              confirmBox.querySelector('#kwAddCatYes').addEventListener('click', function() {
                var yesBtn = confirmBox.querySelector('#kwAddCatYes');
                yesBtn.disabled = true;
                var addId = kwAddToCatId;
                fetch('/api/aichat/category-groups/' + encodeURIComponent(groupId) + '/add-category', {
                  method: 'POST', credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ category_id: addId })
                }).then(function(r) { return r.json(); }).then(function() {
                  kwAddToCatId = null;
                  kwAddToCatName = '';
                  document.body.removeChild(confirmOverlay);
                  kwCatGroupModal.classList.remove('open');
                  kwCatGroupModal.setAttribute('aria-hidden', 'true');
                  selectedGroupId = groupId;
                  renderKwClassifyList();
                }).catch(function() { yesBtn.disabled = false; });
              });
            } else {
              var ids = JSON.parse(btn.dataset.groupIds || '[]');
              var newSel = {};
              ids.forEach(function(id) { newSel[String(id)] = true; });
              if (typeof applyKwBadgeColorsExternal === 'function') applyKwBadgeColorsExternal(newSel);
              kwCatGroupModal.classList.remove('open');
              kwCatGroupModal.setAttribute('aria-hidden', 'true');
            }
          });
        });
        var nameInput = document.getElementById('kwCatGroupNameInput');
        var confirmBtn = document.getElementById('kwCatGroupConfirm');
        var errDiv = document.getElementById('kwCatGroupError');
        if (nameInput && confirmBtn) {
          confirmBtn.addEventListener('click', function() {
            var name = nameInput.value.trim();
            if (!name) { errDiv.textContent = 'グループ名を入力してください'; return; }
            confirmBtn.disabled = true;
            fetch('/api/aichat/category-groups', {
              method: 'POST', credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ group_name: name, category_ids: selectedIds })
            }).then(function(r) { return r.json(); })
              .then(function(d) {
                if (d.error) { errDiv.textContent = d.error; confirmBtn.disabled = false; return; }
                kwCachedCatGroups = null;
                kwCatGroupModal.classList.remove('open');
                kwCatGroupModal.setAttribute('aria-hidden', 'true');
                selectedGroupId = d.id;
                renderKwClassifyList();
              })
              .catch(function() { errDiv.textContent = '登録に失敗しました'; confirmBtn.disabled = false; });
          });
        }
      }
    }

    function loadKwCatGroups(cb) {
      fetch('/api/aichat/category-groups', { credentials: 'same-origin', cache: 'no-store' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(d) { kwCachedCatGroups = (d && Array.isArray(d.groups)) ? d.groups : []; if (cb) cb(kwCachedCatGroups); })
        .catch(function() { kwCachedCatGroups = []; if (cb) cb([]); });
    }

    // ===== キーワード分類 =====
    var kwClassifyBtn = document.getElementById('kwClassifyBtn');
    var kwClassifyListModal = document.getElementById('kwClassifyListModal');
    var kwClassifyListClose = document.getElementById('kwClassifyListClose');
    var kwClassifyListBody = document.getElementById('kwClassifyListBody');
    var kwClassifySearchInput = document.getElementById('kwClassifySearchInput');

    function applyKwClassifySearchFilter() {
      var q = kwClassifySearchInput.value.trim().toLowerCase();
      kwClassifyListBody.querySelectorAll('.kw-classify-kw-badge').forEach(function(el) {
        var kw = (el.dataset.keyword || '').toLowerCase();
        el.style.display = (!q || kw.indexOf(q) >= 0) ? '' : 'none';
      });
    }

    kwClassifySearchInput.addEventListener('input', function() {
      applyKwClassifySearchFilter();
    });

    var KW_CAT_COLORS = [
      '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
      '#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1',
      '#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#64748b',
      '#6b7280','#1e293b'
    ];

    var selectedCats = {};
    var selectedGroupId = null;
    var KW_CAT_DIM_COLOR = '#64748b';
    var kwAddToCatId = null;
    var kwAddToCatName = '';
    var kwRemoveFromCatId = null;
    var kwRemoveFromCatName = '';
    var kwMidSoloActive = false;
    var kwMidSoloCatId = null;

    // 大分類が選択されていない状態で単独の中分類カテゴリが選択された時、
    // それ以外の中分類トグルを全てOFF+グレーアウト(実際に非活性)にし、
    // キーワードバッジを一旦全て非表示にしてから選択中の中分類に属する
    // キーワードだけを表示する「単独中分類分離モード」に入る。
    function enterKwMidSoloMode(catId) {
      kwMidSoloActive = true;
      kwMidSoloCatId = catId;
      kwClassifyListBody.querySelectorAll('.kw-cat-summary-badge').forEach(function(catEl) {
        var cid = catEl.dataset.catId;
        catEl.classList.toggle('kw-cat-badge-solo-disabled', cid !== catId);
      });
      kwClassifyListBody.querySelectorAll('.kw-classify-kw-badge').forEach(function(el) {
        el.style.display = 'none';
      });
      kwClassifyListBody.querySelectorAll('.kw-classify-kw-badge').forEach(function(el) {
        var catIds = [];
        try { catIds = JSON.parse(el.dataset.catIds || '[]'); } catch(e) {}
        if (catIds.length === 0 && el.dataset.catId) catIds = [el.dataset.catId];
        if (catIds.indexOf(catId) !== -1) el.style.display = '';
      });
      var releaseWrap = document.getElementById('kwMidSoloReleaseWrap');
      if (releaseWrap) releaseWrap.style.display = '';
    }

    // 「解除する」ボタン押下時、または選択中の中分類自身をタップして
    // OFFにした時に、中分類カテゴリ群をページ読み込み時の状態(全て
    // 有効・非グレーアウト)へ戻し、キーワードバッジを全て非表示に戻す。
    function exitKwMidSoloMode() {
      if (kwMidSoloCatId != null) delete selectedCats[kwMidSoloCatId];
      kwMidSoloActive = false;
      kwMidSoloCatId = null;
      kwClassifyListBody.querySelectorAll('.kw-cat-summary-badge').forEach(function(catEl) {
        catEl.classList.remove('kw-cat-badge-solo-disabled');
      });
      kwClassifyListBody.querySelectorAll('.kw-classify-kw-badge').forEach(function(el) {
        el.style.display = '';
      });
      applyKwBadgeColors();
      var releaseWrap = document.getElementById('kwMidSoloReleaseWrap');
      if (releaseWrap) releaseWrap.style.display = 'none';
    }

    function applyKwGroupBadgeState() {
      kwClassifyListBody.querySelectorAll('.kw-group-summary-badge').forEach(function(el) {
        if (el.dataset.groupId === selectedGroupId) {
          el.classList.add('kw-group-badge-active');
        } else {
          el.classList.remove('kw-group-badge-active');
        }
      });
    }

    function applyKwBadgeColors() {
      kwClassifyListBody.querySelectorAll('.kw-classify-kw-badge').forEach(function(kwEl) {
        var el = kwEl, cid = el.dataset.catId;
        var catIds = [];
        try { catIds = JSON.parse(el.dataset.catIds || '[]'); } catch(e) {}
        if (catIds.length === 0 && cid) catIds = [cid];
        var activeId = null;
        catIds.forEach(function(id) {
          if (activeId == null && selectedCats[String(id)]) activeId = String(id);
        });
        var base = 'kw-classify-kw-badge sq-kw-badge';
        if (activeId != null) {
          var catColors = {};
          try { catColors = JSON.parse(el.dataset.catColors || '{}'); } catch(e) {}
          var c = kwPaletteActColor || catColors[activeId] || el.dataset.catColor || '#6366f1';
          el.className = base + ' sq-kw-badge-active';
          el.style.setProperty('--kwcat-color', c);
          el.style.setProperty('--kwcat-bg', c + '33');
        } else {
          el.className = base + (catIds.length > 0 ? ' kw-kw-classified' : '');
          if (catIds.length > 0) {
            var catColors2 = {};
            try { catColors2 = JSON.parse(el.dataset.catColors || '{}'); } catch(e) {}
            var ownColor = catColors2[catIds[0]] || el.dataset.catColor || '#7c3aed';
            el.style.setProperty('--kw-pal-cls', ownColor);
          } else {
            el.style.removeProperty('--kw-pal-cls');
          }
        }
      });
      kwClassifyListBody.querySelectorAll('.kw-cat-summary-badge').forEach(function(catEl) {
        var catId = catEl.dataset.catId;
        var catColor = catEl.dataset.catColor || '#6366f1';
        // 大分類カテゴリを選択中は、その大分類に属さない中分類カテゴリの
        // 色を一時的に暗い色へ差し替え、属する中分類カテゴリ(元の色のまま)
        // と一目で区別できるようにする。
        var isDimmed = !!selectedGroupId && !selectedCats[catId];
        var displayColor = isDimmed ? KW_CAT_DIM_COLOR : catColor;
        catEl.style.borderColor = displayColor;
        catEl.style.color = displayColor;
        catEl.style.setProperty('--kw-pal-cat', displayColor);
        catEl.style.setProperty('--kw-pal-cat-bg', displayColor + '22');
        catEl.classList.toggle('kw-cat-badge-dimmed', isDimmed);
        if (selectedCats[catId]) {
          catEl.classList.add('kw-cat-badge-active');
        } else {
          catEl.classList.remove('kw-cat-badge-active');
        }
      });
    }

    function renderKwClassifyList() {
      kwClassifyListBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      Promise.allSettled([
        fetch('/api/aichat/keyword-categories-summary', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/all-keywords', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/category-groups', { credentials: 'same-origin' }).then(function(r) { return r.json(); })
      ]).then(function(results) {
        var catData   = results[0].status === 'fulfilled' ? results[0].value : {};
        var kwData    = results[1].status === 'fulfilled' ? results[1].value : {};
        var groupData = results[2].status === 'fulfilled' ? results[2].value : {};
        var cats   = catData.categories  || [];
        var kws    = kwData.keywords     || [];
        var groups = (groupData.groups || []).slice().sort(function(a, b) { return (b.kw_count || 0) - (a.kw_count || 0); });
        if (selectedGroupId) {
          var activeGroup = groups.find(function(g) { return g.id === selectedGroupId; });
          if (activeGroup) {
            selectedCats = {};
            (activeGroup.category_ids || []).forEach(function(id) { selectedCats[String(id)] = true; });
          } else {
            selectedGroupId = null;
          }
        }
        var html = '';
        if (cats.length > 0) {
          html += '<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border-color);">';
          cats.forEach(function(cat) {
            html += '<span class="kw-cat-summary-badge" data-cat-id="' + escHtml(String(cat.id)) + '" data-cat-color="' + escHtml(cat.color || '#6366f1') + '" style="display:inline-block;font-size:11px;padding:3px 11px;border-radius:2px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-muted);cursor:pointer;white-space:nowrap;margin:1px;">' + escHtml(cat.name) + ' (' + cat.kw_count + ')</span>';
          });
          html += '<div id="kwMidSoloReleaseWrap" style="display:none;text-align:center;margin-top:8px;"><button id="kwMidSoloReleaseBtn" type="button">解除する</button></div>';
          html += '</div>';
        }
        if (groups.length > 0) {
          html += '<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border-color);">';
          html += '<span style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-right:6px;">大分類 :</span>';
          groups.forEach(function(g) {
            html += '<span class="kw-group-summary-badge" data-group-id="' + escHtml(g.id) + '" data-cat-ids="' + escHtml(JSON.stringify(g.category_ids || [])) + '" style="display:inline-block;font-size:11px;padding:3px 11px;border-radius:2px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-muted);cursor:pointer;white-space:nowrap;margin:1px;">' + escHtml(g.group_name) + ' (' + (g.kw_count || 0) + ')</span>';
          });
          html += '</div>';
        }
        if (kws.length === 0) {
          html += '<div class="search-log-empty">キーワードがありません</div>';
        } else {
          html += '<div style="line-height:1;">';
          kws.forEach(function(kw) {
            var catIds = [];
            var catColors = {};
            if (kw.category_pairs) {
              String(kw.category_pairs).split(',').forEach(function(pair) {
                var sep = pair.indexOf(':');
                if (sep <= 0) return;
                var pid = pair.slice(0, sep);
                catIds.push(pid);
                catColors[pid] = pair.slice(sep + 1);
              });
            } else if (kw.category_id != null) {
              catIds.push(String(kw.category_id));
              catColors[String(kw.category_id)] = kw.category_color || '#6366f1';
            }
            var catIdAttr = kw.category_id != null ? ' data-cat-id="' + escHtml(String(kw.category_id)) + '"' : '';
            var catColorAttr = kw.category_color ? ' data-cat-color="' + escHtml(kw.category_color) + '"' : '';
            var catIdsAttr = catIds.length > 0 ? ' data-cat-ids="' + escHtml(JSON.stringify(catIds)) + '" data-cat-colors="' + escHtml(JSON.stringify(catColors)) + '"' : '';
            var kwCls = 'kw-classify-kw-badge sq-kw-badge' + (kw.is_classified ? ' kw-kw-classified' : '');
            html += '<span class="' + kwCls + '" data-keyword="' + escHtml(kw.keyword) + '"' + catIdAttr + catColorAttr + catIdsAttr + '>' + escHtml(kw.keyword) + ' (' + kw.cnt + ')</span>';
          });
          html += '</div>';
        }
        kwClassifyListBody.innerHTML = html;
        applyKwBadgeColors();
        applyKwGroupBadgeState();
        applyKwClassifySearchFilter();
        var kwMidSoloReleaseBtn = document.getElementById('kwMidSoloReleaseBtn');
        if (kwMidSoloReleaseBtn) {
          kwMidSoloReleaseBtn.addEventListener('click', function() { exitKwMidSoloMode(); });
        }
        kwClassifyListBody.querySelectorAll('.kw-cat-summary-badge').forEach(function(catEl) {
          catEl.addEventListener('click', function() {
            var catId = catEl.dataset.catId;
            if (kwMidSoloActive && catId !== kwMidSoloCatId) return;
            if (selectedGroupId && selectedCats[catId]) {
              var catMap = {};
              cats.forEach(function(cat) { catMap[String(cat.id)] = { name: cat.name, color: cat.color || '#6366f1' }; });
              kwRemoveFromCatId = Number(catId);
              kwRemoveFromCatName = catMap[catId] ? catMap[catId].name : catId;
              kwCatGroupBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
              kwCatGroupModal.style.zIndex = String(getNextZ());
              kwCatGroupModal.classList.add('open');
              kwCatGroupModal.setAttribute('aria-hidden', 'false');
              loadKwCatGroups(function(grps) { renderKwCatGroupList(grps, [], catMap, selectedGroupId); });
              return;
            }
            if (selectedGroupId && !selectedCats[catId]) {
              var catMap = {};
              cats.forEach(function(cat) { catMap[String(cat.id)] = { name: cat.name, color: cat.color || '#6366f1' }; });
              kwAddToCatId = Number(catId);
              kwAddToCatName = catMap[catId] ? catMap[catId].name : catId;
              kwCatGroupBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
              kwCatGroupModal.style.zIndex = String(getNextZ());
              kwCatGroupModal.classList.add('open');
              kwCatGroupModal.setAttribute('aria-hidden', 'false');
              loadKwCatGroups(function(grps) { renderKwCatGroupList(grps, [], catMap); });
              return;
            }
            if (selectedCats[catId]) {
              delete selectedCats[catId];
            } else {
              selectedCats[catId] = true;
            }
            applyKwBadgeColors();
            var selCount = Object.keys(selectedCats).length;
            if (!selectedGroupId && selCount === 1 && !kwMidSoloActive) {
              enterKwMidSoloMode(catId);
              return;
            }
            if (kwMidSoloActive && selCount !== 1) {
              exitKwMidSoloMode();
            }
            if (selCount >= 2) {
              var catMap = {};
              cats.forEach(function(cat) { catMap[String(cat.id)] = { name: cat.name, color: cat.color || '#6366f1' }; });
              var selectedIds = Object.keys(selectedCats).map(Number);
              openKwCatGroupModal(selectedIds, catMap, function(newSel) {
                selectedCats = newSel;
                applyKwBadgeColors();
              });
            }
          });
        });
        kwClassifyListBody.querySelectorAll('.kw-classify-kw-badge').forEach(function(el) {
          el.addEventListener('click', function() { openKwClassifyModal(el.dataset.keyword); });
        });
        kwClassifyListBody.querySelectorAll('.kw-group-summary-badge').forEach(function(grpEl) {
          grpEl.addEventListener('click', function() {
            var groupId = grpEl.dataset.groupId;
            var catIds = [];
            try { catIds = JSON.parse(grpEl.dataset.catIds || '[]'); } catch(e) {}
            if (selectedGroupId === groupId) {
              selectedGroupId = null;
              selectedCats = {};
            } else {
              selectedGroupId = groupId;
              selectedCats = {};
              catIds.forEach(function(id) { selectedCats[String(id)] = true; });
            }
            applyKwBadgeColors();
            applyKwGroupBadgeState();
            if (kwMidSoloActive) exitKwMidSoloMode();
          });
        });
        if (dailyStatsModal && dailyStatsModal.classList.contains('open')) {
          renderDailyStatsChart();
        }
      });
    }

    var applyKwBadgeColorsExternal = null;

    function openKwCatGroupModal(selectedCatIds, catMap, applyFn) {
      applyKwBadgeColorsExternal = applyFn || null;
      kwCatGroupBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      kwCatGroupModal.style.zIndex = String(getNextZ());
      kwCatGroupModal.classList.add('open');
      kwCatGroupModal.setAttribute('aria-hidden', 'false');
      loadKwCatGroups(function(groups) {
        renderKwCatGroupList(groups, selectedCatIds, catMap || {});
      });
    }

    kwCatGroupClose.addEventListener('click', function() {
      kwCatGroupModal.classList.remove('open'); kwCatGroupModal.setAttribute('aria-hidden', 'true');
    });
    kwCatGroupModal.addEventListener('click', function(e) {
      if (e.target === kwCatGroupModal) { kwCatGroupModal.classList.remove('open'); kwCatGroupModal.setAttribute('aria-hidden', 'true'); }
    });

    function openKwClassifyList() {
      selectedCats = {};
      selectedGroupId = null;
      kwAddToCatId = null;
      kwAddToCatName = '';
      kwMidSoloActive = false;
      kwMidSoloCatId = null;
      kwClassifySearchInput.value = '';
      kwClassifyListModal.style.zIndex = String(getNextZ());
      kwClassifyListModal.classList.add('open');
      renderKwClassifyList();
    }

    function openKwClassifyModal(keyword, onSaved) {
      var overlay = document.createElement('div');
      overlay.setAttribute('data-overlay', '');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:' + getNextZ() + ';display:flex;align-items:flex-start;justify-content:center;padding-top:60px;';

      var box = document.createElement('div');
      box.style.cssText = 'background:var(--bg-secondary);border-radius:12px;width:min(520px,94vw);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.22);';

      var head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border-color);flex-shrink:0;';
      var titleEl = document.createElement('span');
      titleEl.textContent = '🔑 分類: ' + keyword;
      titleEl.style.cssText = 'font-weight:700;font-size:14px;';
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted);padding:0 4px;';
      closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      head.appendChild(titleEl);
      head.appendChild(closeBtn);
      box.appendChild(head);

      var body = document.createElement('div');
      body.style.cssText = 'padding:16px 18px;overflow-y:auto;flex:1;';

      var suggestBadge = document.createElement('div');
      suggestBadge.style.cssText = 'font-size:11px;color:var(--text-muted);margin-bottom:8px;min-height:16px;';
      body.appendChild(suggestBadge);

      var catsSection = document.createElement('div');
      catsSection.style.cssText = 'margin-bottom:14px;min-height:24px;line-height:2;';
      body.appendChild(catsSection);

      var colorEditorStatus = document.createElement('div');
      colorEditorStatus.style.cssText = 'font-size:11px;margin-bottom:6px;min-height:14px;color:var(--text-muted);';
      body.appendChild(colorEditorStatus);
      var colorEditorPanel = document.createElement('div');
      colorEditorPanel.style.cssText = 'display:none;flex-wrap:wrap;gap:5px;margin-bottom:10px;padding:8px;border:1px dashed var(--border-color);border-radius:6px;';
      body.appendChild(colorEditorPanel);

      function openColorEditor(catId, currentColor) {
        colorEditorStatus.textContent = 'この分類の識別色を選択してください';
        colorEditorPanel.innerHTML = '';
        colorEditorPanel.style.display = 'flex';
        KW_CAT_COLORS.forEach(function(col) {
          var sw = document.createElement('span');
          sw.className = 'kwcat-color-edit-swatch';
          sw.dataset.color = col;
          sw.style.cssText = 'display:inline-block;width:22px;height:22px;border-radius:50%;background:' + col + ';cursor:pointer;box-sizing:border-box;border:2.5px solid ' + (col === currentColor ? '#fff' : 'transparent') + ';box-shadow:0 0 0 1px rgba(0,0,0,0.15);';
          sw.addEventListener('click', function() {
            colorEditorStatus.textContent = '保存中…';
            fetch('/api/aichat/keyword-categories/' + catId, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ color: col }),
            })
              .then(function(r) {
                return r.json().catch(function() { return {}; }).then(function(d) {
                  if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status));
                  return d;
                });
              })
              .then(function() {
                colorEditorStatus.textContent = '';
                colorEditorPanel.style.display = 'none';
                loadCategories();
              })
              .catch(function(err) {
                colorEditorStatus.textContent = '色の変更を保存できませんでした: ' + (err && err.message ? err.message : '不明なエラー');
              });
          });
          colorEditorPanel.appendChild(sw);
        });
      }

      var registerLabel = document.createElement('div');
      registerLabel.textContent = '新しいカテゴリを登録';
      registerLabel.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-muted);letter-spacing:0.05em;margin-bottom:6px;';
      body.appendChild(registerLabel);

      var selectedColor = KW_CAT_COLORS[11];
      var colorRow = document.createElement('div');
      colorRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;';
      KW_CAT_COLORS.forEach(function(col) {
        var swatch = document.createElement('span');
        swatch.dataset.color = col;
        swatch.style.cssText = 'display:inline-block;width:22px;height:22px;border-radius:50%;background:' + col + ';cursor:pointer;box-sizing:border-box;border:2.5px solid ' + (col === selectedColor ? '#fff' : 'transparent') + ';box-shadow:0 0 0 1px rgba(0,0,0,0.15);transition:border-color 0.1s;';
        swatch.addEventListener('click', function() {
          selectedColor = col;
          colorRow.querySelectorAll('span').forEach(function(s) {
            s.style.borderColor = s.dataset.color === selectedColor ? '#fff' : 'transparent';
          });
        });
        colorRow.appendChild(swatch);
      });
      body.appendChild(colorRow);

      var inputRow = document.createElement('div');
      inputRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:14px;';
      var catInput = document.createElement('input');
      catInput.type = 'text';
      catInput.placeholder = 'カテゴリ名を入力…';
      catInput.style.cssText = 'flex:1;padding:6px 10px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;background:var(--bg-primary);color:var(--text-primary);';
      var addCatBtn = document.createElement('button');
      addCatBtn.textContent = '登録';
      addCatBtn.disabled = true;
      addCatBtn.style.cssText = 'padding:6px 14px;border-radius:6px;border:none;background:var(--accent-color,#667eea);color:#fff;font-size:13px;cursor:pointer;opacity:0.4;';
      inputRow.appendChild(catInput);
      inputRow.appendChild(addCatBtn);
      body.appendChild(inputRow);

      var foot = document.createElement('div');
      foot.style.cssText = 'padding:12px 18px;border-top:1px solid var(--border-color);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;';
      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'キャンセル';
      cancelBtn.style.cssText = 'padding:7px 16px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);font-size:13px;cursor:pointer;';
      cancelBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      var decideBtn = document.createElement('button');
      decideBtn.className = 'kwcat-decide-btn';
      decideBtn.textContent = '分類決定';
      decideBtn.disabled = true;
      decideBtn.style.cssText = 'padding:7px 16px;border-radius:6px;border:none;background:var(--accent-color,#667eea);color:#fff;font-size:13px;cursor:pointer;opacity:0.4;';
      foot.appendChild(cancelBtn);
      foot.appendChild(decideBtn);

      box.appendChild(body);
      box.appendChild(foot);
      overlay.appendChild(box);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
      document.body.appendChild(overlay);

      var selectedCatIds = [];

      function updateDecideBtn() {
        var ok = selectedCatIds.length > 0 || catInput.value.trim().length > 0;
        decideBtn.disabled = !ok;
        decideBtn.style.opacity = ok ? '1' : '0.4';
      }

      function renderCatBadge(cat) {
        var badge = document.createElement('span');
        var col = cat.color || '#6366f1';
        badge.style.cssText = 'display:inline-block;padding:3px 12px;margin:2px 4px;border-radius:6px;font-size:12px;cursor:pointer;border:2px solid ' + col + ';background:transparent;color:' + col + ';user-select:none;font-weight:600;';
        badge.dataset.catId = String(cat.id);
        badge.dataset.catName = cat.name;

        var nameSpan = document.createElement('span');
        nameSpan.textContent = cat.name;
        badge.appendChild(nameSpan);

        var editDot = document.createElement('span');
        editDot.className = 'kwcat-color-edit-dot';
        editDot.textContent = ' 🎨';
        editDot.title = 'この分類の識別色を変更';
        editDot.style.cssText = 'cursor:pointer;';
        editDot.addEventListener('click', function(e) {
          e.stopPropagation();
          openColorEditor(cat.id, col);
        });
        badge.appendChild(editDot);

        if (cat.is_mapped) {
          badge.style.background = col;
          badge.style.color = '#fff';
          selectedCatIds.push(cat.id);
        }
        nameSpan.addEventListener('click', function() {
          var id = cat.id;
          var sel = selectedCatIds.indexOf(id) >= 0;
          if (sel) {
            selectedCatIds = selectedCatIds.filter(function(x) { return x !== id; });
            badge.style.background = 'transparent';
            badge.style.color = col;
          } else {
            selectedCatIds.push(id);
            badge.style.background = col;
            badge.style.color = '#fff';
          }
          updateDecideBtn();
        });
        return badge;
      }

      function loadCategories() {
        selectedCatIds = [];
        fetch('/api/aichat/keyword-categories?keyword=' + encodeURIComponent(keyword), { credentials: 'same-origin' })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            var cats = d.categories || [];
            catsSection.innerHTML = '';
            if (cats.length === 0) {
              catsSection.style.display = 'none';
            } else {
              catsSection.style.display = '';
              cats.forEach(function(cat) { catsSection.appendChild(renderCatBadge(cat)); });
            }
            updateDecideBtn();
          })
          .catch(function() { catsSection.textContent = '読み込みに失敗しました'; });
      }

      loadCategories();

      fetch('/api/aichat/keyword-category-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ keyword: keyword }),
      })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d && d.suggestion) {
            var pct = Math.round(d.suggestion.similarity * 100);
            suggestBadge.textContent = '🤖 推定: ' + d.suggestion.name + '（類似度' + pct + '%・参考情報であり自動では反映されません）';
          }
        })
        .catch(function() {});

      catInput.addEventListener('input', function() {
        var val = catInput.value.trim();
        updateDecideBtn();
        if (!val) { addCatBtn.disabled = true; addCatBtn.style.opacity = '0.4'; return; }
        var exists = Array.from(catsSection.querySelectorAll('[data-cat-id]')).some(function(el) {
          return el.dataset.catName === val;
        });
        if (exists) { addCatBtn.disabled = true; addCatBtn.style.opacity = '0.4'; return; }
        addCatBtn.disabled = false;
        addCatBtn.style.opacity = '1';
      });

      addCatBtn.addEventListener('click', function() {
        var val = catInput.value.trim();
        if (!val) return;
        addCatBtn.disabled = true;
        addCatBtn.style.opacity = '0.4';
        fetch('/api/aichat/keyword-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name: val, color: selectedColor }),
        })
          .then(function(r) { return r.json(); })
          .then(function() {
            catInput.value = '';
            loadCategories();
          })
          .catch(function() {
            addCatBtn.disabled = false;
            addCatBtn.style.opacity = '1';
          });
      });

      decideBtn.addEventListener('click', function() {
        var pendingName = catInput.value.trim();
        if (selectedCatIds.length === 0 && !pendingName) return;
        decideBtn.disabled = true;
        decideBtn.style.opacity = '0.4';

        function restoreDecideBtn() {
          decideBtn.disabled = false;
          decideBtn.style.opacity = '1';
        }

        function saveMapping(catIds) {
          if (catIds.length === 0) { restoreDecideBtn(); return; }
          fetch('/api/aichat/keyword-category-map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ keyword: keyword, category_ids: catIds }),
          })
            .then(function(r) { return r.json(); })
            .then(function() {
              document.body.removeChild(overlay);
              renderKwClassifyList();
              if (typeof onSaved === 'function') onSaved();
            })
            .catch(restoreDecideBtn);
        }

        if (!pendingName) { saveMapping(selectedCatIds); return; }

        var existingEl = Array.from(catsSection.querySelectorAll('[data-cat-id]')).filter(function(el) {
          return el.dataset.catName === pendingName;
        })[0];
        if (existingEl) {
          var existingId = parseInt(existingEl.dataset.catId, 10);
          if (selectedCatIds.indexOf(existingId) < 0) selectedCatIds.push(existingId);
          saveMapping(selectedCatIds);
          return;
        }

        fetch('/api/aichat/keyword-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name: pendingName, color: selectedColor }),
        })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (d && d.category && typeof d.category.id === 'number') {
              if (selectedCatIds.indexOf(d.category.id) < 0) selectedCatIds.push(d.category.id);
              saveMapping(selectedCatIds);
            } else {
              restoreDecideBtn();
            }
          })
          .catch(restoreDecideBtn);
      });
    }

    kwClassifyBtn.addEventListener('click', function(e) { e.stopPropagation(); openKwClassifyList(); });
    kwClassifyListClose.addEventListener('click', function() { kwClassifyListModal.classList.remove('open'); });
    kwClassifyListModal.addEventListener('click', function(e) { if (e.target === kwClassifyListModal) kwClassifyListModal.classList.remove('open'); });

    // ===== Zanzibar形式分類ツリー（大分類 → 中分類/未分類 → キーワード） =====
    var ztTreeBtn = document.getElementById('ztTreeBtn');
    var ztTreeModal = document.getElementById('ztTreeModal');
    var ztTreeClose = document.getElementById('ztTreeClose');
    var ztTreeBody = document.getElementById('ztTreeBody');
    var ztTreeSearchInput = document.getElementById('ztTreeSearchInput');
    var ztTreeData = null;
    var ztTreeOpenNodes = {};
    var ztMatchCollector = [];
    var ztOverviewBtn = document.getElementById('ztOverviewBtn');
    var ztOverviewModal = document.getElementById('ztOverviewModal');
    var ztOverviewClose = document.getElementById('ztOverviewClose');
    var ztOverviewBody = document.getElementById('ztOverviewBody');
    var ztOverviewChartToggle = document.getElementById('ztOverviewChartToggle');
    var ztOverviewChartSection = document.getElementById('ztOverviewChartSection');
    var ztKeywordSharesModal = document.getElementById('ztKeywordSharesModal');
    var ztKeywordSharesClose = document.getElementById('ztKeywordSharesClose');
    var ztKeywordSharesBody = document.getElementById('ztKeywordSharesBody');
    var ztKeywordSharesTitle = document.getElementById('ztKeywordSharesTitle');
    var ztBgeBtn = document.getElementById('ztBgeBtn');
    var ztBgeModal = document.getElementById('ztBgeModal');
    var ztBgeClose = document.getElementById('ztBgeClose');
    var ztBgeModelSelect = document.getElementById('ztBgeModelSelect');
    var ztBgeBody = document.getElementById('ztBgeBody');
    var ztBgeCopyBtn = document.getElementById('ztBgeCopyBtn');
    var ztBgeRegisterBtn = document.getElementById('ztBgeRegisterBtn');
    var ztBgeRegisterStatus = document.getElementById('ztBgeRegisterStatus');
    var ztCacheBtn = document.getElementById('ztCacheBtn');
    var ztCacheModal = document.getElementById('ztCacheModal');
    var ztCacheClose = document.getElementById('ztCacheClose');
    var ztCacheBody = document.getElementById('ztCacheBody');
    var ztCacheAnalyzeBtn = document.getElementById('ztCacheAnalyzeBtn');
    var ztCacheSimilarWrap = document.getElementById('ztCacheSimilarWrap');
    var ztCacheSimilarBody = document.getElementById('ztCacheSimilarBody');
    var ztCacheThresholdSlider = document.getElementById('ztCacheThresholdSlider');
    var ztCacheThresholdValue = document.getElementById('ztCacheThresholdValue');
    var ZT_SIM_THRESHOLD_COOKIE_NAME = 'aichat_zt_sim_threshold=';
    var ZT_SIM_THRESHOLD_DEFAULT_PCT = 75;

    function readZtSimThresholdCookiePct() {
      var parts = document.cookie.split(';');
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        while (part.length > 0 && part.charAt(0) === ' ') part = part.slice(1);
        if (part.indexOf(ZT_SIM_THRESHOLD_COOKIE_NAME) === 0) {
          var pct = parseInt(decodeURIComponent(part.slice(ZT_SIM_THRESHOLD_COOKIE_NAME.length)), 10);
          if (isFinite(pct) && pct >= 50 && pct <= 100) return pct;
          return null;
        }
      }
      return null;
    }

    function writeZtSimThresholdCookiePct(pct) {
      document.cookie = ZT_SIM_THRESHOLD_COOKIE_NAME + pct + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
    }

    (function initZtSimThresholdSlider() {
      var pct = readZtSimThresholdCookiePct();
      if (pct == null) pct = ZT_SIM_THRESHOLD_DEFAULT_PCT;
      ztCacheThresholdSlider.value = String(pct / 100);
      ztCacheThresholdValue.textContent = pct + '%';
    })();

    var ztCacheAnalysisShown = false;
    var ZT_CACHE_METRIC_TOLERANCE = { l2Norm: 0.01, mean: 0.01, std: 0.01, min: 0.02, max: 0.02, nearZeroRatio: 0.05 };
    var ZT_CACHE_METRIC_LABELS = { dim: '次元数', l2Norm: 'L2ノルム', mean: '平均', std: '標準偏差', min: '最小値', max: '最大値', nearZeroRatio: 'ゼロ近傍割合' };
    var ZT_CACHE_METRIC_ORDER = ['dim', 'l2Norm', 'mean', 'std', 'min', 'max', 'nearZeroRatio'];
    var ztLastQuery = '';
    var ztLastMatchedKeywords = [];
    var ztCacheLookupTimer = null;
    var ztLastCacheInfo = null;

    function loadZtTreeData(cb) {
      Promise.allSettled([
        fetch('/api/aichat/all-keywords', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/keyword-categories-summary', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/category-groups', { credentials: 'same-origin' }).then(function(r) { return r.json(); })
      ]).then(function(results) {
        var kwData = results[0].status === 'fulfilled' ? results[0].value : {};
        var catData = results[1].status === 'fulfilled' ? results[1].value : {};
        var groupData = results[2].status === 'fulfilled' ? results[2].value : {};
        var keywords = kwData.keywords || [];
        var cats = catData.categories || [];
        var groups = groupData.groups || [];

        var catMap = {};
        cats.forEach(function(c) { catMap[String(c.id)] = c; });

        var catIdsInGroups = {};
        groups.forEach(function(g) {
          (g.category_ids || []).forEach(function(cid) { catIdsInGroups[String(cid)] = true; });
        });

        var catKeywords = {};
        var unclassified = [];
        keywords.forEach(function(kw) {
          var ids = [];
          if (kw.category_pairs) {
            String(kw.category_pairs).split(',').forEach(function(pair) {
              var sep = pair.indexOf(':');
              if (sep > 0) ids.push(pair.slice(0, sep));
            });
          } else if (kw.category_id != null) {
            ids.push(String(kw.category_id));
          }
          if (ids.length === 0) {
            unclassified.push(kw.keyword);
          } else {
            ids.forEach(function(cid) {
              if (!catKeywords[cid]) catKeywords[cid] = [];
              catKeywords[cid].push(kw.keyword);
            });
          }
        });

        ztTreeData = {
          groups: groups, cats: cats, catMap: catMap,
          catIdsInGroups: catIdsInGroups, catKeywords: catKeywords, unclassified: unclassified
        };
        cb();
      });
    }

    function ztHighlight(kw, q) {
      if (!q) return escHtml(kw);
      var idx = kw.toLowerCase().indexOf(q);
      if (idx === -1) return escHtml(kw);
      return escHtml(kw.slice(0, idx)) + '<mark class="zt-hl">' + escHtml(kw.slice(idx, idx + q.length)) + '</mark>' + escHtml(kw.slice(idx + q.length));
    }

    function ztRenderCatNode(cat, indentLevel, q) {
      var cid = String(cat.id);
      var kws = ztTreeData.catKeywords[cid] || [];
      var nameHit = !q || cat.name.toLowerCase().indexOf(q) !== -1;
      var kwHit = q && kws.some(function(kw) { return kw.toLowerCase().indexOf(q) !== -1; });
      if (q && !nameHit && !kwHit) return '';
      var isOpen = !!ztTreeOpenNodes[cid] || !!kwHit;
      var indent = indentLevel * 16;
      var html = '<div class="zt-line zt-node" data-node-id="' + escHtml(cid) + '" style="padding-left:' + indent + 'px;">'
        + '<span class="zt-toggle">' + (isOpen ? '▾' : '▸') + '</span>'
        + '<span class="zt-object">category</span><span class="zt-relation">#keyword</span>@<span class="zt-subject">' + escHtml(cat.name) + '</span>'
        + '<span class="zt-count">(' + kws.length + ')</span>'
        + '</div>';
      if (isOpen) {
        kws.forEach(function(kw) {
          var kwHitSelf = q && kw.toLowerCase().indexOf(q) !== -1;
          if (q && !nameHit && !kwHitSelf) return;
          if (kwHitSelf) ztMatchCollector.push(kw);
          html += '<div class="zt-line zt-kw-line" style="padding-left:' + (indent + 20) + 'px;">'
            + '<span class="zt-object">keyword</span><span class="zt-relation">#member</span>@<span class="zt-subject">' + ztHighlight(kw, q) + '</span>'
            + '</div>';
        });
      }
      return html;
    }

    function renderZtTree(filterQ) {
      if (!ztTreeData) return;
      var qRaw = (filterQ || '').trim();
      var q = qRaw.toLowerCase();
      var d = ztTreeData;
      var html = '';
      ztMatchCollector = [];

      d.groups.forEach(function(g) {
        var catIds = (g.category_ids || []).map(String);
        var catsInGroup = catIds.map(function(cid) { return d.catMap[cid]; }).filter(Boolean);
        var groupNameHit = !q || g.group_name.toLowerCase().indexOf(q) !== -1;
        var anyChildVisible = catsInGroup.some(function(c) {
          var kws = d.catKeywords[String(c.id)] || [];
          return c.name.toLowerCase().indexOf(q) !== -1 || kws.some(function(kw) { return kw.toLowerCase().indexOf(q) !== -1; });
        });
        if (q && !groupNameHit && !anyChildVisible) return;
        html += '<div class="zt-line zt-group-line"><span class="zt-object">category_group</span><span class="zt-relation">#category</span>@<span class="zt-subject">' + escHtml(g.group_name) + '</span></div>';
        catsInGroup.forEach(function(cat) { html += ztRenderCatNode(cat, 1, q); });
      });

      var ungroupedCats = d.cats.filter(function(c) { return !d.catIdsInGroups[String(c.id)]; });
      if (ungroupedCats.length > 0) {
        var anyVisible = !q || ungroupedCats.some(function(c) {
          var kws = d.catKeywords[String(c.id)] || [];
          return c.name.toLowerCase().indexOf(q) !== -1 || kws.some(function(kw) { return kw.toLowerCase().indexOf(q) !== -1; });
        });
        if (anyVisible) {
          html += '<div class="zt-line zt-group-line"><span class="zt-object">category_group</span><span class="zt-relation">#category</span>@<span class="zt-subject">未所属</span></div>';
          ungroupedCats.forEach(function(cat) { html += ztRenderCatNode(cat, 1, q); });
        }
      }

      var uncHit = d.unclassified.some(function(kw) { return kw.toLowerCase().indexOf(q) !== -1; });
      if (!q || uncHit) {
        var isOpen = !!ztTreeOpenNodes.unclassified || (!!q && uncHit);
        html += '<div class="zt-line zt-group-line"><span class="zt-object">category_group</span><span class="zt-relation">#category</span>@<span class="zt-subject">未分類</span></div>';
        html += '<div class="zt-line zt-node" data-node-id="unclassified" style="padding-left:16px;">'
          + '<span class="zt-toggle">' + (isOpen ? '▾' : '▸') + '</span>'
          + '<span class="zt-object">category</span><span class="zt-relation">#keyword</span>@<span class="zt-subject">未分類</span>'
          + '<span class="zt-count">(' + d.unclassified.length + ')</span>'
          + '</div>';
        if (isOpen) {
          d.unclassified.forEach(function(kw) {
            var kwHitSelf = q && kw.toLowerCase().indexOf(q) !== -1;
            if (q && !kwHitSelf) return;
            if (kwHitSelf) ztMatchCollector.push(kw);
            html += '<div class="zt-line zt-kw-line" style="padding-left:36px;">'
              + '<span class="zt-object">keyword</span><span class="zt-relation">#member</span>@<span class="zt-subject">' + ztHighlight(kw, q) + '</span>'
              + '</div>';
          });
        }
      }

      if (!html) html = '<div class="search-log-empty">一致するカテゴリ・キーワードがありません</div>';
      ztTreeBody.innerHTML = html;

      ztTreeBody.querySelectorAll('.zt-node').forEach(function(el) {
        el.addEventListener('click', function() {
          var nid = el.dataset.nodeId;
          ztTreeOpenNodes[nid] = !ztTreeOpenNodes[nid];
          renderZtTree(ztTreeSearchInput.value);
        });
      });

      ztLastQuery = qRaw;
      ztLastMatchedKeywords = [];
      ztMatchCollector.forEach(function(kw) {
        if (ztLastMatchedKeywords.indexOf(kw) === -1) ztLastMatchedKeywords.push(kw);
      });
      ztBgeBtn.style.display = (qRaw && ztLastMatchedKeywords.length > 0) ? 'inline-block' : 'none';
    }

    function computeZtBgeTexts() {
      var texts = ztLastQuery ? [ztLastQuery] : [];
      ztLastMatchedKeywords.forEach(function(kw) {
        if (texts.indexOf(kw) === -1) texts.push(kw);
      });
      return texts.slice(0, 50);
    }

    // モデルのドロップダウン選択に応じて、プレビューされる問い合わせ内容
    // (実際に「登録する」で送られるモデル名)を動的に切り替える。
    function renderZtBgePayload() {
      var payload = {
        model: ztBgeModelSelect.value,
        input: { text: computeZtBgeTexts() }
      };
      ztBgeBody.textContent = JSON.stringify(payload, null, 2);
    }

    function openZtBgeModal() {
      renderZtBgePayload();
      ztBgeCopyBtn.textContent = '📋 コピー';
      ztBgeModal.style.zIndex = String(getNextZ());
      ztBgeModal.classList.add('open');
      ztBgeModal.setAttribute('aria-hidden', 'false');
    }

    function closeZtBgeModal() {
      ztBgeModal.classList.remove('open');
      ztBgeModal.setAttribute('aria-hidden', 'true');
    }

    ztBgeBtn.addEventListener('click', function(e) { e.stopPropagation(); openZtBgeModal(); });
    ztBgeClose.addEventListener('click', closeZtBgeModal);
    ztBgeModal.addEventListener('click', function(e) { if (e.target === ztBgeModal) closeZtBgeModal(); });
    ztBgeModelSelect.addEventListener('click', function(e) { e.stopPropagation(); });
    ztBgeModelSelect.addEventListener('change', function(e) {
      e.stopPropagation();
      renderZtBgePayload();
    });
    ztBgeCopyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(ztBgeBody.textContent).then(function() {
        ztBgeCopyBtn.textContent = '✓ コピーしました';
        setTimeout(function() { ztBgeCopyBtn.textContent = '📋 コピー'; }, 2000);
      });
    });

    ztBgeRegisterBtn.addEventListener('click', function() {
      var texts;
      var model;
      try {
        var parsed = JSON.parse(ztBgeBody.textContent);
        texts = parsed.input.text;
        model = parsed.model;
      } catch (e) {
        ztBgeRegisterStatus.textContent = '登録データの読み取りに失敗しました';
        return;
      }
      if (!texts || texts.length === 0) return;
      ztBgeRegisterBtn.disabled = true;
      ztBgeRegisterStatus.textContent = '登録中...';
      fetch('/api/aichat/keyword-embeddings/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ texts: texts, model: model }),
      })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          ztBgeRegisterBtn.disabled = false;
          if (d && d.ok) {
            ztBgeRegisterStatus.textContent = '✓ 登録完了（成功' + d.registered + '件・失敗' + d.failed + '件）';
          } else {
            ztBgeRegisterStatus.textContent = '登録に失敗しました: ' + (d && d.error ? d.error : '不明なエラー');
          }
        })
        .catch(function() {
          ztBgeRegisterBtn.disabled = false;
          ztBgeRegisterStatus.textContent = '登録に失敗しました';
        });
    });

    function formatZtCacheAnalysis(info) {
      var a = info.analysis;
      if (!a) return '分析データがありません';
      return [
        '',
        '=== ベクタ分析 ===',
        '次元数: ' + a.dim,
        'L2ノルム: ' + a.l2Norm.toFixed(4),
        '平均: ' + a.mean.toFixed(6),
        '標準偏差: ' + a.std.toFixed(6),
        '最小値: ' + a.min.toFixed(6),
        '最大値: ' + a.max.toFixed(6),
        'ゼロに近い要素の割合(|v|<0.01): ' + (a.nearZeroRatio * 100).toFixed(1) + '%'
      ].join('\\n');
    }

    function renderZtCacheBody() {
      if (!ztLastCacheInfo) return;
      var base = JSON.stringify(ztLastCacheInfo, null, 2);
      ztCacheBody.textContent = ztCacheAnalysisShown ? base + formatZtCacheAnalysis(ztLastCacheInfo) : base;
      ztCacheAnalyzeBtn.textContent = ztCacheAnalysisShown ? '🔍 分析を隠す' : '🔍 分析';
    }

    function ztMetricIsClose(field, a, b) {
      if (field === 'dim') return a === b;
      var tol = ZT_CACHE_METRIC_TOLERANCE[field];
      return typeof tol === 'number' && Math.abs(a - b) <= tol;
    }

    function ztFormatMetricValue(field, v) {
      if (field === 'dim') return String(v);
      if (field === 'nearZeroRatio') return (v * 100).toFixed(1) + '%';
      return v.toFixed(4);
    }

    function renderZtCacheMetadataLine(analysis, targetAnalysis) {
      return ZT_CACHE_METRIC_ORDER.map(function(f) {
        var text = ZT_CACHE_METRIC_LABELS[f] + ':' + escHtml(ztFormatMetricValue(f, analysis[f]));
        var close = targetAnalysis ? ztMetricIsClose(f, analysis[f], targetAnalysis[f]) : false;
        return close ? '<span class="zt-hl">' + text + '</span>' : '<span>' + text + '</span>';
      }).join('　');
    }

    function loadZtCacheSimilar(keyword) {
      ztCacheSimilarWrap.style.display = '';
      ztCacheSimilarBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      var threshold = parseFloat(ztCacheThresholdSlider.value);
      fetch('/api/aichat/keyword-embeddings/similar?keyword=' + encodeURIComponent(keyword) + '&threshold=' + threshold, { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d && d._warning) {
            ztCacheSimilarBody.innerHTML = '<div style="color:#e53e3e;">類似検索でエラーが発生しました: ' + escHtml(d._warning) + '</div>';
            return;
          }
          var target = d && d.target;
          var groups = (d && d.groups) || [];
          if (groups.length === 0) {
            ztCacheSimilarBody.innerHTML = '<div style="color:var(--text-muted);">似ているキーワードは見つかりませんでした</div>';
            return;
          }
          var html = '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">※分類カテゴリへの所属は関連性の証明ではありません。ヒット数が多いカテゴリ順に並べています。</div>';
          groups.forEach(function(g, idx) {
            html += '<div style="font-weight:700;margin-top:10px;margin-bottom:4px;">' + (idx + 1) + '. ' + escHtml(g.categoryName)
              + '<span style="font-weight:400;color:var(--text-muted);font-size:11px;margin-left:6px;">(' + g.items.length + '件ヒット)</span>'
              + '</div>';
            g.items.forEach(function(item) {
              html += '<div style="padding:5px 0;border-bottom:1px dashed var(--border-color);">'
                + '<span style="font-weight:600;">' + escHtml(item.keyword) + '</span>'
                + '<span style="color:var(--text-muted);margin-left:6px;font-size:11px;">類似度' + Math.round(item.similarity * 100) + '%</span>'
                + '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">' + renderZtCacheMetadataLine(item.analysis, target) + '</div>'
                + '</div>';
            });
          });
          ztCacheSimilarBody.innerHTML = html;
        })
        .catch(function() { ztCacheSimilarBody.innerHTML = '<div style="color:#e53e3e;">読み込みに失敗しました</div>'; });
    }

    function openZtCacheModal() {
      if (!ztLastCacheInfo) return;
      ztCacheAnalysisShown = false;
      ztCacheSimilarWrap.style.display = 'none';
      renderZtCacheBody();
      ztCacheModal.style.zIndex = String(getNextZ());
      ztCacheModal.classList.add('open');
      ztCacheModal.setAttribute('aria-hidden', 'false');
    }

    function closeZtCacheModal() {
      ztCacheModal.classList.remove('open');
      ztCacheModal.setAttribute('aria-hidden', 'true');
    }

    ztCacheBtn.addEventListener('click', function(e) { e.stopPropagation(); openZtCacheModal(); });
    ztCacheClose.addEventListener('click', closeZtCacheModal);
    ztCacheModal.addEventListener('click', function(e) { if (e.target === ztCacheModal) closeZtCacheModal(); });
    ztCacheAnalyzeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      ztCacheAnalysisShown = !ztCacheAnalysisShown;
      renderZtCacheBody();
      if (ztCacheAnalysisShown && ztLastCacheInfo) {
        loadZtCacheSimilar(ztLastCacheInfo.keyword);
      } else {
        ztCacheSimilarWrap.style.display = 'none';
      }
    });
    ztCacheThresholdSlider.addEventListener('input', function() {
      ztCacheThresholdValue.textContent = Math.round(parseFloat(ztCacheThresholdSlider.value) * 100) + '%';
    });
    ztCacheThresholdSlider.addEventListener('change', function(e) {
      e.stopPropagation();
      writeZtSimThresholdCookiePct(Math.round(parseFloat(ztCacheThresholdSlider.value) * 100));
      if (ztCacheAnalysisShown && ztLastCacheInfo) loadZtCacheSimilar(ztLastCacheInfo.keyword);
    });

    function scheduleZtCacheLookup(rawKeyword) {
      clearTimeout(ztCacheLookupTimer);
      var keyword = (rawKeyword || '').trim();
      if (!keyword) {
        ztCacheBtn.style.display = 'none';
        ztLastCacheInfo = null;
        return;
      }
      ztCacheLookupTimer = setTimeout(function() {
        fetch('/api/aichat/keyword-embeddings/lookup?keyword=' + encodeURIComponent(keyword), { credentials: 'same-origin' })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (ztTreeSearchInput.value.trim() !== keyword) return;
            if (d && d.cached && d.embedding) {
              ztLastCacheInfo = d.embedding;
              ztCacheBtn.style.display = 'inline-block';
            } else {
              ztLastCacheInfo = null;
              ztCacheBtn.style.display = 'none';
            }
          })
          .catch(function() { ztCacheBtn.style.display = 'none'; ztLastCacheInfo = null; });
      }, 350);
    }

    function openZtTreeModal() {
      ztTreeModal.style.zIndex = String(getNextZ());
      ztTreeModal.classList.add('open');
      ztTreeModal.setAttribute('aria-hidden', 'false');
      ztTreeSearchInput.value = '';
      ztTreeOpenNodes = {};
      ztBgeBtn.style.display = 'none';
      ztCacheBtn.style.display = 'none';
      ztLastCacheInfo = null;
      ztTreeBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      loadZtTreeData(function() { renderZtTree(''); });
    }

    function closeZtTreeModal() {
      ztTreeModal.classList.remove('open');
      ztTreeModal.setAttribute('aria-hidden', 'true');
    }

    ztTreeBtn.addEventListener('click', function(e) { e.stopPropagation(); openZtTreeModal(); });
    ztTreeClose.addEventListener('click', closeZtTreeModal);
    ztTreeModal.addEventListener('click', function(e) { if (e.target === ztTreeModal) closeZtTreeModal(); });
    ztTreeSearchInput.addEventListener('input', function() {
      renderZtTree(ztTreeSearchInput.value);
      scheduleZtCacheLookup(ztTreeSearchInput.value);
    });

    // ===== ZTモーダルヘッダの📖: ベクタ化済みデータ一覧 =====
    var ZT_OVERVIEW_SOURCE_LABELS = {
      zt_manual: 'ZTモーダル手動登録',
      answer_graph_color: '自動(answer-graph色分け)',
      category_suggest: '自動(AI分類提案)',
      auto: '自動',
      unknown: '不明(旧データ)',
    };

    function formatZtOverviewSource(source) {
      return ZT_OVERVIEW_SOURCE_LABELS[source] || escHtml(source);
    }

    var ztOverviewLastItems = [];
    var ztOverviewCurrentFilter = 'all';
    var ztOverviewCurrentSearch = '';

    function getZtOverviewModelCounts(items) {
      return {
        bge: items.length,
        plamo: items.filter(function(it) { return !!it.plamoModel; }).length,
        gemma: items.filter(function(it) { return !!it.gemmaModel; }).length
      };
    }

    function filterZtOverviewItems(items, filter, search) {
      var out = items;
      if (filter === 'plamo') out = out.filter(function(it) { return !!it.plamoModel; });
      else if (filter === 'gemma') out = out.filter(function(it) { return !!it.gemmaModel; });
      var q = (search || '').trim().toLowerCase();
      if (q) out = out.filter(function(it) { return String(it.keyword || '').toLowerCase().indexOf(q) >= 0; });
      return out;
    }

    function buildZtOverviewModelFilterHtml(counts, current) {
      var entries = [
        { value: 'bge', label: 'bge-m3', count: counts.bge },
        { value: 'plamo', label: 'plamo-embedding-1b', count: counts.plamo },
        { value: 'gemma', label: 'embeddinggemma-300m', count: counts.gemma }
      ];
      entries.sort(function(a, b) { return b.count - a.count; });
      var optsHtml = '<option value="all"' + (current === 'all' ? ' selected' : '') + '>すべて</option>';
      entries.forEach(function(e) {
        optsHtml += '<option value="' + e.value + '"' + (current === e.value ? ' selected' : '') + '>' + escHtml(e.label) + '(' + e.count + ')</option>';
      });
      return '<select id="ztOverviewModelFilter" style="font-size:11px;padding:2px 4px;font-weight:normal;">' + optsHtml + '</select>';
    }

    function renderZtOverviewList(items, filter, search) {
      ztOverviewLastItems = items || [];
      ztOverviewCurrentFilter = filter || 'all';
      ztOverviewCurrentSearch = search || '';
      if (ztOverviewLastItems.length === 0) {
        ztOverviewBody.innerHTML = '<div class="search-log-empty">ベクタ化済みのキーワードはありません</div>';
        return;
      }
      var counts = getZtOverviewModelCounts(ztOverviewLastItems);
      var filterSelectHtml = buildZtOverviewModelFilterHtml(counts, ztOverviewCurrentFilter);
      var filtered = filterZtOverviewItems(ztOverviewLastItems, ztOverviewCurrentFilter, ztOverviewCurrentSearch);
      var ZT_TH_STICKY = 'position:sticky;top:0;z-index:2;background:var(--card-bg);';
      var html = '<table style="width:100%;border-collapse:collapse;">'
        + '<thead><tr>'
        + '<th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-secondary);' + ZT_TH_STICKY + '">キーワード</th>'
        + '<th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-secondary);' + ZT_TH_STICKY + '"><div style="display:flex;align-items:center;justify-content:space-between;gap:6px;"><span>埋め込みモデル</span>' + filterSelectHtml + '</div></th>'
        + '<th style="text-align:right;padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-secondary);' + ZT_TH_STICKY + '">次元数</th>'
        + '<th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-secondary);' + ZT_TH_STICKY + '">登録元</th>'
        + '</tr></thead><tbody>';
      if (filtered.length === 0) {
        html += '<tr><td colspan="4" style="padding:12px 8px;text-align:center;color:var(--text-muted);">該当するキーワードがありません</td></tr>';
      }
      filtered.forEach(function(it) {
        html += '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-primary);"><a href="javascript:void(0)" class="zt-overview-kw-link" data-keyword="' + escHtml(it.keyword) + '" style="color:inherit;text-decoration:underline dotted;cursor:pointer;">' + escHtml(it.keyword) + '</a></td>'
          + '<td style="padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-primary);">' + escHtml(it.model || 'bge-m3') + '</td>'
          + '<td style="text-align:right;padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-primary);">' + it.dim + '</td>'
          + '<td style="padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-muted);">' + formatZtOverviewSource(it.source) + '</td></tr>';
        if (it.plamoModel) {
          html += '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border-color);"></td>'
            + '<td style="padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-muted);">' + escHtml(it.plamoModel) + '</td>'
            + '<td style="text-align:right;padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-muted);">' + it.plamoDim + '</td>'
            + '<td style="padding:4px 8px;border-bottom:1px solid var(--border-color);"></td></tr>';
        }
        if (it.gemmaModel) {
          html += '<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border-color);"></td>'
            + '<td style="padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-muted);">' + escHtml(it.gemmaModel) + '</td>'
            + '<td style="text-align:right;padding:4px 8px;border-bottom:1px solid var(--border-color);color:var(--text-muted);">' + it.gemmaDim + '</td>'
            + '<td style="padding:4px 8px;border-bottom:1px solid var(--border-color);"></td></tr>';
        }
      });
      html += '</tbody></table>';
      ztOverviewBody.innerHTML = html;
    }

    ztOverviewBody.addEventListener('change', function(e) {
      if (e.target && e.target.id === 'ztOverviewModelFilter') {
        renderZtOverviewList(ztOverviewLastItems, e.target.value, ztOverviewCurrentSearch);
      }
    });

    var ztOverviewKeywordSearchInput = document.getElementById('ztOverviewKeywordSearchInput');
    ztOverviewKeywordSearchInput.addEventListener('click', function(e) { e.stopPropagation(); });
    ztOverviewKeywordSearchInput.addEventListener('input', function(e) {
      renderZtOverviewList(ztOverviewLastItems, ztOverviewCurrentFilter, e.target.value);
    });

    // 「別タブで開く」(共有ページへの外部公開URL)はデフォルトOFF。設定ページに
    // 項目は用意してあるが、当面は選択/変更不可(固定値)として扱う。
    var ZT_KEYWORD_SHARES_EXTERNAL_LINK_ENABLED = false;

    function openZtKeywordSharesModal(keyword) {
      ztKeywordSharesTitle.textContent = '🔎 「' + keyword + '」の関連する会話';
      ztKeywordSharesBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      ztKeywordSharesModal.style.zIndex = String(getNextZ());
      ztKeywordSharesModal.classList.add('open');
      ztKeywordSharesModal.setAttribute('aria-hidden', 'false');
      fetch('/api/aichat/shares/by-keyword?keyword=' + encodeURIComponent(keyword), { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var results = d.results || [];
          ztKeywordSharesTitle.textContent = '🔎 「' + keyword + '」の関連する会話 (' + results.length + ')';
          if (results.length === 0) {
            ztKeywordSharesBody.innerHTML = '<div class="search-log-empty">関連する会話が見つかりません</div>';
            return;
          }
          var html = '';
          results.forEach(function(r, i) {
            html += '<div style="padding:8px 0;border-bottom:1px solid var(--border-color);">'
              + '<div class="zt-keyword-share-q" data-share-id="' + escHtml(String(r.id)) + '" data-keyword="' + escHtml(keyword) + '" style="font-size:12px;color:var(--text-primary);margin-bottom:2px;cursor:pointer;text-decoration:underline dotted;">' + (i + 1) + '. ' + escHtml(r.question) + '</div>'
              + '<div style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
              + (r.model ? '<span>' + escHtml(String(r.model).split('/').pop()) + '</span>' : '')
              + '<span>' + escHtml(String(r.created_at || '').slice(0, 16).replace('T', ' ')) + '</span>'
              + (ZT_KEYWORD_SHARES_EXTERNAL_LINK_ENABLED ? '<a href="/s/' + escHtml(r.user_hash) + '/' + escHtml(r.id) + '" target="_blank" style="color:var(--accent-color,#667eea);text-decoration:none;">🔗 別タブで開く</a>' : '')
              + '</div></div>';
          });
          ztKeywordSharesBody.innerHTML = html;
        })
        .catch(function() {
          ztKeywordSharesBody.innerHTML = '<div class="search-log-empty">取得に失敗しました</div>';
        });
    }

    ztKeywordSharesBody.addEventListener('click', function(e) {
      var q = e.target && e.target.closest ? e.target.closest('.zt-keyword-share-q') : null;
      if (q) {
        openHistoryModalByShareId(q.getAttribute('data-share-id'), JSON.stringify([q.getAttribute('data-keyword')]));
      }
    });

    function closeZtKeywordSharesModal() {
      ztKeywordSharesModal.classList.remove('open');
      ztKeywordSharesModal.setAttribute('aria-hidden', 'true');
    }

    ztOverviewBody.addEventListener('click', function(e) {
      var link = e.target && e.target.closest ? e.target.closest('.zt-overview-kw-link') : null;
      if (link) {
        e.preventDefault();
        openZtKeywordSharesModal(link.getAttribute('data-keyword'));
      }
    });

    ztKeywordSharesClose.addEventListener('click', closeZtKeywordSharesModal);
    ztKeywordSharesModal.addEventListener('click', function(e) { if (e.target === ztKeywordSharesModal) closeZtKeywordSharesModal(); });

    var ZT_OVERVIEW_CHART_COOKIE = 'aichat_zt_overview_chart_visible';
    function getZtOverviewChartVisible() {
      var m = document.cookie.match(/(?:^|;\s*)aichat_zt_overview_chart_visible=([^;]*)/);
      return m ? m[1] === 'on' : true;
    }
    function setZtOverviewChartVisible(val) {
      document.cookie = ZT_OVERVIEW_CHART_COOKIE + '=' + (val ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
    }
    function updateZtOverviewChartToggleUi() {
      var visible = getZtOverviewChartVisible();
      ztOverviewChartSection.style.display = visible ? '' : 'none';
      ztOverviewChartToggle.style.opacity = visible ? '1' : '0.4';
    }

    function openZtOverviewModal() {
      ztOverviewBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      ztOverviewChartSection.innerHTML = '';
      ztOverviewKeywordSearchInput.value = '';
      updateZtOverviewChartToggleUi();
      ztOverviewModal.style.zIndex = String(getNextZ());
      ztOverviewModal.classList.add('open');
      ztOverviewModal.setAttribute('aria-hidden', 'false');
      Promise.allSettled([
        fetch('/api/aichat/keyword-embeddings/list', { credentials: 'same-origin' })
          .then(function(r) { return r.text().then(function(t) { return { status: r.status, text: t }; }); }),
        fetch('/api/aichat/all-keywords', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/keyword-embeddings/model-counts', { credentials: 'same-origin' }).then(function(r) { return r.json(); })
      ]).then(function(results) {
        var listRes = results[0].status === 'fulfilled' ? results[0].value : null;
        var d = null;
        if (listRes) { try { d = JSON.parse(listRes.text); } catch (e) { d = null; } }
        if (d && d.error) {
          ztOverviewBody.innerHTML = '<div class="search-log-empty">取得に失敗しました: ' + escHtml(d.error) + '</div>';
          return;
        }
        if (!d) {
          var statusTxt = listRes ? listRes.status : '?';
          var bodyTxt = listRes ? listRes.text : '';
          ztOverviewBody.innerHTML = '<div class="search-log-empty">取得に失敗しました: HTTP ' + statusTxt + ' / ' + escHtml(String(bodyTxt).slice(0, 120)) + '</div>';
          return;
        }
        renderZtOverviewList(d.items, 'all', '');
        var kwAll = results[1].status === 'fulfilled' ? ((results[1].value && results[1].value.keywords) || []) : [];
        var modelCounts = results[2].status === 'fulfilled' ? results[2].value : {};
        ztOverviewChartSection.innerHTML = buildEmbeddingModelRatioSectionHtml(kwAll.length, modelCounts);
      }).catch(function(err) {
        ztOverviewBody.innerHTML = '<div class="search-log-empty">取得に失敗しました（通信エラー: ' + escHtml((err && err.message) || '不明') + '）</div>';
      });
    }

    function closeZtOverviewModal() {
      ztOverviewModal.classList.remove('open');
      ztOverviewModal.setAttribute('aria-hidden', 'true');
    }

    ztOverviewBtn.addEventListener('click', function(e) { e.stopPropagation(); openZtOverviewModal(); });
    ztOverviewClose.addEventListener('click', closeZtOverviewModal);
    ztOverviewChartToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      setZtOverviewChartVisible(!getZtOverviewChartVisible());
      updateZtOverviewChartToggleUi();
    });
    ztOverviewModal.addEventListener('click', function(e) { if (e.target === ztOverviewModal) closeZtOverviewModal(); });

    // ===== トークン使用量グラフ =====
    var tokenUsageBtn = document.getElementById('tokenUsageBtn');
    var tokenUsageModal = document.getElementById('tokenUsageModal');
    var tokenUsageClose = document.getElementById('tokenUsageClose');
    var tokenUsageBody = document.getElementById('tokenUsageBody');
    var tokenUsageGranMonth = document.getElementById('tokenUsageGranMonth');
    var tokenUsageGranDay = document.getElementById('tokenUsageGranDay');
    var tokenUsageGranularity = 'month';

    function renderTokenUsageGraph() {
      tokenUsageBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      var qs = tokenUsageGranularity === 'day' ? 'granularity=day&days=30' : 'granularity=month&months=6';
      fetch('/api/aichat/token-usage?' + qs, { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var rows = d.rows || [];
          if (rows.length === 0) {
            tokenUsageBody.innerHTML = '<div class="search-log-empty">トークン使用量の記録がありません</div>';
            return;
          }
          var periods = [];
          var modelSet = {};
          rows.forEach(function(r) {
            if (periods.indexOf(r.period) < 0) periods.push(r.period);
            modelSet[r.model] = true;
          });
          periods.sort().reverse();
          var models = Object.keys(modelSet).sort();
          var dataMap = {};
          rows.forEach(function(r) {
            if (!dataMap[r.period]) dataMap[r.period] = {};
            dataMap[r.period][r.model] = r;
          });
          var MODEL_COLORS_LOCAL = (typeof MODEL_COLORS !== 'undefined' ? MODEL_COLORS : {});
          var defaultPalette = ['#6366f1','#22c55e','#f59e0b','#ef4444','#0ea5e9','#a855f7','#14b8a6','#f97316'];
          function modelColor(m, i) { return MODEL_COLORS_LOCAL[m] || defaultPalette[i % defaultPalette.length]; }
          function shortModel(m) { return m ? (m.split('/').pop() || m).replace(/-instruct.*/, '') : ''; }
          var MODEL_PRICING = {
            '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { in: 0.293, out: 2.253 },
            '@cf/meta/llama-3.1-8b-instruct-fp8':       { in: 0.152, out: 0.287 },
            '@cf/meta/llama-3.1-70b-instruct':          { in: 0.293, out: 2.253 },
            '@cf/google/gemma-4-26b-a4b-it':            { in: 0.100, out: 0.300 },
            '@cf/google/gemma-3-12b-it':                { in: 0.345, out: 0.556 },
            '@cf/meta/llama-4-scout-17b-16e-instruct':  { in: 0.270, out: 0.850 },
            '@cf/zai-org/glm-5.2':                      { in: null, out: null }
          };
          var html = '';
          html += '<div style="margin-bottom:12px;">';
          models.forEach(function(m, i) {
            html += '<span style="display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0;font-size:11px;">';
            html += '<span style="width:10px;height:10px;border-radius:2px;background:' + escHtml(modelColor(m, i)) + ';display:inline-block;flex-shrink:0;"></span>';
            html += escHtml(shortModel(m));
            html += '</span>';
          });
          html += '</div>';
          periods.forEach(function(period) {
            var periodData = dataMap[period] || {};
            var totalIn = 0, totalOut = 0, totalReq = 0;
            models.forEach(function(m) { if (periodData[m]) { totalIn += periodData[m].input_tokens || 0; totalOut += periodData[m].output_tokens || 0; totalReq += periodData[m].request_count || 0; } });
            var maxTok = totalIn + totalOut;
            html += '<div style="margin-bottom:16px;">';
            html += '<div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">' + escHtml(period) + ' <span style="font-weight:400;color:var(--text-muted);">計 ' + maxTok.toLocaleString() + ' tokens / ' + totalReq + ' 件</span></div>';
            html += '<svg width="100%" height="' + (models.length * 20 + 4) + '" style="display:block;overflow:visible;">';
            var barW = 100 / (maxTok || 1);
            models.forEach(function(m, i) {
              var row = periodData[m];
              var inTok = row ? (row.input_tokens || 0) : 0;
              var outTok = row ? (row.output_tokens || 0) : 0;
              var total = inTok + outTok;
              if (total === 0) return;
              var pct = total / (maxTok || 1) * 100;
              var col = escHtml(modelColor(m, i));
              var y = i * 20 + 2;
              html += '<rect x="0" y="' + y + '" width="' + pct.toFixed(2) + '%" height="14" rx="3" fill="' + col + '" opacity="0.85"/>';
              html += '<text x="' + (pct.toFixed(2)) + '%" y="' + (y + 11) + '" dx="4" font-size="10" fill="var(--text-muted)">' + total.toLocaleString() + ' (in:' + inTok.toLocaleString() + ' out:' + outTok.toLocaleString() + ')</text>';
            });
            html += '</svg>';
            html += '</div>';
          });
          html += '<div style="margin-top:20px;border-top:1px solid var(--border-color);padding-top:14px;">';
          html += '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;">モデル単価（Cloudflare Workers AI）</div>';
          html += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
          html += '<thead><tr style="border-bottom:1px solid var(--border-color);">';
          html += '<th style="text-align:left;padding:3px 6px;color:var(--text-muted);font-weight:600;">モデル</th>';
          html += '<th style="text-align:right;padding:3px 6px;color:var(--text-muted);font-weight:600;">入力 $/1M</th>';
          html += '<th style="text-align:right;padding:3px 6px;color:var(--text-muted);font-weight:600;">出力 $/1M</th>';
          html += '</tr></thead><tbody>';
          var pricingModels = Object.keys(MODEL_PRICING);
          pricingModels.forEach(function(m, i) {
            var p = MODEL_PRICING[m];
            var col = escHtml(modelColor(m, i));
            var label = escHtml(shortModel(m));
            var inUse = modelSet[m] ? 'font-weight:600;' : 'opacity:0.55;';
            html += '<tr style="border-bottom:1px solid var(--border-color);' + inUse + '">';
            html += '<td style="padding:3px 6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + col + ';margin-right:5px;vertical-align:middle;flex-shrink:0;"></span>' + label + '</td>';
            html += '<td style="padding:3px 6px;text-align:right;font-family:monospace;">' + (p.in != null ? '$' + p.in.toFixed(3) : '--') + '</td>';
            html += '<td style="padding:3px 6px;text-align:right;font-family:monospace;">' + (p.out != null ? '$' + p.out.toFixed(3) : '--') + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
          html += '<div style="margin-top:6px;font-size:10px;color:var(--text-muted);">太字: 使用実績あり　<a href="https://developers.cloudflare.com/workers-ai/platform/pricing/" target="_blank" rel="noopener" style="color:var(--accent-color,#667eea);">公式料金ページ ↗</a></div>';
          html += '</div>';
          tokenUsageBody.innerHTML = html;
        })
        .catch(function() { tokenUsageBody.innerHTML = '<div style="color:var(--text-muted);">取得に失敗しました</div>'; });
    }

    tokenUsageBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      tokenUsageModal.style.zIndex = String(getNextZ());
      tokenUsageModal.classList.add('open');
      tokenUsageModal.setAttribute('aria-hidden', 'false');
      renderTokenUsageGraph();
    });

    [tokenUsageGranMonth, tokenUsageGranDay].forEach(function(btn) {
      btn.addEventListener('click', function() {
        var granularity = btn.getAttribute('data-granularity');
        if (granularity === tokenUsageGranularity) return;
        tokenUsageGranularity = granularity;
        tokenUsageGranMonth.classList.toggle('active', granularity === 'month');
        tokenUsageGranDay.classList.toggle('active', granularity === 'day');
        renderTokenUsageGraph();
      });
    });
    tokenUsageClose.addEventListener('click', function() {
      tokenUsageModal.classList.remove('open');
      tokenUsageModal.setAttribute('aria-hidden', 'true');
    });
    tokenUsageModal.addEventListener('click', function(e) {
      if (e.target === tokenUsageModal) { tokenUsageModal.classList.remove('open'); tokenUsageModal.setAttribute('aria-hidden', 'true'); }
    });

    // ===== 日次統計グラフ =====
    var dailyStatsBtn = document.getElementById('dailyStatsBtn');
    var dailyStatsModal = document.getElementById('dailyStatsModal');
    var dailyStatsClose = document.getElementById('dailyStatsClose');
    var dailyStatsBody = document.getElementById('dailyStatsBody');
    var dailyStatsTitleEl = document.getElementById('dailyStatsTitle');
    var dailyStatsCurrentMonth = new Date().toISOString().slice(0, 7);

    var GROUP_COLOR_FALLBACK_PALETTE = ['#f59e0b', '#ec4899', '#a855f7', '#f97316', '#14b8a6', '#eab308'];
    function getDailyStatsGroupColor(name, index) {
      var n = String(name || '');
      if (n.indexOf('Travel') !== -1 || n.indexOf('旅行') !== -1) return '#38bdf8';
      if (n.indexOf('Coding') !== -1 || n.indexOf('コーディング') !== -1 || n.indexOf('コード') !== -1) return '#86efac';
      if (n.indexOf('MyApps') !== -1 || n.indexOf('My Apps') !== -1) return '#16a34a';
      return GROUP_COLOR_FALLBACK_PALETTE[index % GROUP_COLOR_FALLBACK_PALETTE.length];
    }

    function buildKwClassifyStatsHtml(kwAll, cats, groups) {
      var classified = 0, unclassified = 0;
      kwAll.forEach(function(kw) {
        if (kw.is_classified) classified++; else unclassified++;
      });
      var total = classified + unclassified;
      if (total === 0) return '';
      var CLS_COLOR = '#7c3aed', UNC_COLOR = '#94a3b8';
      var html = '<div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-top:14px;margin-bottom:4px;">キーワード分類状況</div>';
      html += '<div style="font-size:11px;color:var(--text-primary);margin-bottom:2px;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + CLS_COLOR + ';margin-right:4px;"></span>分類済みキーワード総数 : ' + classified + '</div>';
      html += '<div style="font-size:11px;color:var(--text-primary);margin-bottom:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + UNC_COLOR + ';margin-right:4px;"></span>未分類キーワード総数 : ' + unclassified + '</div>';

      var PR = 46, PCX = 50, PCY = 50, PSZ = 100;
      var pieSvg = '<svg viewBox="0 0 ' + PSZ + ' ' + PSZ + '" width="' + PSZ + '" height="' + PSZ + '" style="flex-shrink:0;">';
      if (classified === 0 || unclassified === 0) {
        pieSvg += '<circle cx="' + PCX + '" cy="' + PCY + '" r="' + PR + '" fill="' + (classified > 0 ? CLS_COLOR : UNC_COLOR) + '" opacity="0.9" stroke="var(--card-bg)" stroke-width="0.5"/>';
      } else {
        var ang = -Math.PI / 2;
        [[classified, CLS_COLOR], [unclassified, UNC_COLOR]].forEach(function(pair) {
          var cnt = pair[0];
          var slice = cnt / total * 2 * Math.PI;
          var endAng = ang + slice;
          var x1 = PCX + PR * Math.cos(ang), y1 = PCY + PR * Math.sin(ang);
          var x2 = PCX + PR * Math.cos(endAng), y2 = PCY + PR * Math.sin(endAng);
          var la = slice > Math.PI ? 1 : 0;
          pieSvg += '<path d="M ' + PCX + ' ' + PCY + ' L ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A ' + PR + ' ' + PR + ' 0 ' + la + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' Z" fill="' + pair[1] + '" opacity="0.9" stroke="var(--card-bg)" stroke-width="0.5"/>';
          ang = endAng;
        });
      }
      pieSvg += '</svg>';

      var clsRatio = Math.round(classified / total * 1000) / 10;
      var uncRatio = Math.round((1000 - classified / total * 1000)) / 10;
      var ratioHtml = '<div style="flex:1;min-width:0;">';
      ratioHtml += '<div style="font-size:10px;color:var(--text-primary);margin-bottom:2px;">分類済み <span style="color:var(--text-muted);">' + clsRatio.toFixed(1) + '%</span></div>';
      ratioHtml += '<div style="font-size:10px;color:var(--text-primary);">未分類 <span style="color:var(--text-muted);">' + uncRatio.toFixed(1) + '%</span></div>';
      ratioHtml += '</div>';
      html += '<div style="display:flex;align-items:flex-start;gap:8px;">' + pieSvg + ratioHtml + '</div>';

      var grpList = (groups || []).filter(function(g) { return (g.kw_count || 0) > 0; })
        .sort(function(a, b) { return (b.kw_count || 0) - (a.kw_count || 0); });
      if (grpList.length > 0) {
        var maxGrp = Math.max(1, grpList[0].kw_count || 0);
        html += '<div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-top:12px;margin-bottom:4px;">大分類別キーワード数</div>';
        grpList.forEach(function(g, gi) {
          var cnt = g.kw_count || 0;
          var pct = Math.round(cnt / maxGrp * 100);
          var grpColor = getDailyStatsGroupColor(g.group_name, gi);
          html += '<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;">';
          html += '<span style="font-size:10px;color:var(--text-primary);width:64px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml(g.group_name) + '">' + escHtml(g.group_name) + '</span>';
          html += '<span style="flex:1;height:8px;background:var(--bg-secondary);border-radius:4px;overflow:hidden;"><span style="display:block;height:100%;width:' + pct + '%;background:' + grpColor + ';border-radius:4px;"></span></span>';
          html += '<span style="font-size:10px;color:var(--text-muted);flex-shrink:0;">' + cnt + '</span>';
          html += '</div>';
        });
      } else {
        var sorted = (cats || []).slice()
          .filter(function(c) { return (c.kw_count || 0) > 0; })
          .sort(function(a, b) { return (b.kw_count || 0) - (a.kw_count || 0); });
        if (sorted.length > 0) {
          var maxCnt = Math.max(1, sorted[0].kw_count || 0);
          html += '<div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-top:12px;margin-bottom:4px;">分類カテゴリ別キーワード数</div>';
          sorted.forEach(function(c) {
            var cnt = c.kw_count || 0;
            var pct = Math.round(cnt / maxCnt * 100);
            html += '<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;">';
            html += '<span style="font-size:10px;color:var(--text-primary);width:64px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml(c.name) + '">' + escHtml(c.name) + '</span>';
            html += '<span style="flex:1;height:8px;background:var(--bg-secondary);border-radius:4px;overflow:hidden;"><span style="display:block;height:100%;width:' + pct + '%;background:' + escHtml(c.color || '#6366f1') + ';border-radius:4px;"></span></span>';
            html += '<span style="font-size:10px;color:var(--text-muted);flex-shrink:0;">' + cnt + '</span>';
            html += '</div>';
          });
        }
      }
      return html;
    }

    function buildEmbeddingModelRatioSectionHtml(totalKw, counts) {
      if (!totalKw || totalKw <= 0) return '';
      counts = counts || {};
      var models = [
        { key: 'bge', label: 'bge-m3', color: '#6366f1', count: counts.bge || 0 },
        { key: 'plamo', label: 'plamo-embedding-1b', color: '#22c55e', count: counts.plamo || 0 },
        { key: 'gemma', label: 'embeddinggemma-300m', color: '#f59e0b', count: counts.gemma || 0 }
      ];
      var UNREG_COLOR = '#94a3b8';
      var html = '<div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-top:14px;margin-bottom:6px;">埋め込みモデル別 登録済みキーワード率</div>';
      html += '<div style="display:flex;gap:16px;flex-wrap:wrap;">';
      models.forEach(function(m) {
        var registered = Math.min(m.count, totalKw);
        var unregistered = Math.max(0, totalKw - registered);
        var ratio = Math.round(registered / totalKw * 1000) / 10;
        var PR = 32, PCX = 36, PCY = 36, PSZ = 72;
        var pieSvg = '<svg viewBox="0 0 ' + PSZ + ' ' + PSZ + '" width="' + PSZ + '" height="' + PSZ + '">';
        if (registered === 0 || unregistered === 0) {
          pieSvg += '<circle cx="' + PCX + '" cy="' + PCY + '" r="' + PR + '" fill="' + (registered > 0 ? m.color : UNREG_COLOR) + '" opacity="0.9" stroke="var(--card-bg)" stroke-width="0.5"/>';
        } else {
          var ang = -Math.PI / 2;
          [[registered, m.color], [unregistered, UNREG_COLOR]].forEach(function(pair) {
            var cnt = pair[0];
            var slice = cnt / totalKw * 2 * Math.PI;
            var endAng = ang + slice;
            var x1 = PCX + PR * Math.cos(ang), y1 = PCY + PR * Math.sin(ang);
            var x2 = PCX + PR * Math.cos(endAng), y2 = PCY + PR * Math.sin(endAng);
            var la = slice > Math.PI ? 1 : 0;
            pieSvg += '<path d="M ' + PCX + ' ' + PCY + ' L ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A ' + PR + ' ' + PR + ' 0 ' + la + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' Z" fill="' + pair[1] + '" opacity="0.9" stroke="var(--card-bg)" stroke-width="0.5"/>';
            ang = endAng;
          });
        }
        pieSvg += '</svg>';
        html += '<div style="text-align:center;">'
          + '<div style="font-size:10px;color:var(--text-primary);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:96px;" title="' + escHtml(m.label) + '">' + escHtml(m.label) + '</div>'
          + pieSvg
          + '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">' + registered + ' / ' + totalKw + ' (' + ratio.toFixed(1) + '%)</div>'
          + '</div>';
      });
      html += '</div>';
      return html;
    }

    function renderDailyStatsChart() {
      var month = dailyStatsCurrentMonth;
      var parts = month.split('-');
      dailyStatsTitleEl.textContent = parseInt(parts[0]) + '年' + parseInt(parts[1]) + '月';
      dailyStatsBody.innerHTML = '<div class="search-log-loading">読み込み中...</div>';
      Promise.allSettled([
        fetch('/api/aichat/daily-stats?month=' + encodeURIComponent(month), { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/all-keywords', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/keyword-categories-summary', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/category-groups', { credentials: 'same-origin' }).then(function(r) { return r.json(); }),
        fetch('/api/aichat/keyword-embeddings/model-counts', { credentials: 'same-origin' }).then(function(r) { return r.json(); })
      ])
        .then(function(results) {
          var d = results[0].status === 'fulfilled' ? results[0].value : {};
          var kwAll = results[1].status === 'fulfilled' ? (results[1].value.keywords || []) : [];
          var catSummary = results[2].status === 'fulfilled' ? (results[2].value.categories || []) : [];
          var catGroups = results[3].status === 'fulfilled' ? (results[3].value.groups || []) : [];
          var embModelCounts = results[4].status === 'fulfilled' ? results[4].value : {};
          var days = d.days || [];
          var models = d.models || [];
          var apiModelTotals = d.apiModelTotals || {};
          if (days.length === 0) {
            dailyStatsBody.innerHTML = '<div class="search-log-empty">この月のデータがありません</div>';
            return;
          }

          var year = parseInt(parts[0]);
          var mon = parseInt(parts[1]) - 1;
          var daysInM = new Date(year, mon + 1, 0).getDate();

          var EXCL = 'deepseek-r1';
          var kwByDay = {}, modelsByDay = {}, totalsByModel = {};
          days.forEach(function(dayObj) {
            var dayNum = parseInt(dayObj.date.split('-')[2]);
            kwByDay[dayNum] = dayObj.kw_count || 0;
            modelsByDay[dayNum] = {};
            Object.keys(dayObj.models || {}).forEach(function(m) {
              if (m.indexOf(EXCL) >= 0) return;
              modelsByDay[dayNum][m] = dayObj.models[m];
              totalsByModel[m] = (totalsByModel[m] || 0) + (dayObj.models[m] || 0);
            });
          });

          var sortedModels = Object.keys(totalsByModel).sort(function(a, b) {
            return totalsByModel[b] - totalsByModel[a];
          });

          var MC = (typeof MODEL_COLORS !== 'undefined' ? MODEL_COLORS : {});
          var pal = ['#6366f1','#22c55e','#f59e0b','#ef4444','#0ea5e9','#a855f7','#14b8a6','#f97316'];
          var midxMap = {};
          models.forEach(function(m, i) { midxMap[m] = i; });
          function mCol(m) { return MC[m] || pal[(midxMap[m] !== undefined ? midxMap[m] : 0) % pal.length]; }
          function mShort(m) { return m ? (m.split('/').pop() || m).replace(/-instruct.*/, '').replace(/-fp8.*/, '').replace(/-distill.*/, '') : '?'; }

          // ===== 左パネル: 質問総数リスト =====
          var leftHtml = '<div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">質問総数（多い順）</div>';
          sortedModels.forEach(function(m) {
            var cnt = totalsByModel[m] || 0;
            leftHtml += '<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;">';
            leftHtml += '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + escHtml(mCol(m)) + ';flex-shrink:0;"></span>';
            leftHtml += '<span style="font-size:11px;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml(m) + '">' + escHtml(mShort(m)) + '</span>';
            leftHtml += '<span style="font-size:11px;color:var(--text-muted);flex-shrink:0;">' + cnt + '件</span>';
            leftHtml += '</div>';
          });

          // ===== 左パネル: パイチャート =====
          var pieModels = sortedModels;
          var pieTotal = pieModels.reduce(function(s, m) { return s + (totalsByModel[m] || 0); }, 0);

          if (pieTotal > 0) {
            leftHtml += '<div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-top:12px;margin-bottom:4px;">モデル比率</div>';
            leftHtml += '<div style="display:flex;align-items:flex-start;gap:8px;">';

            var PR = 46, PCX = 50, PCY = 50, PSZ = 100;
            var pieSvg = '<svg viewBox="0 0 ' + PSZ + ' ' + PSZ + '" width="' + PSZ + '" height="' + PSZ + '" style="flex-shrink:0;">';
            var ang = -Math.PI / 2;
            pieModels.forEach(function(m) {
              var cnt = totalsByModel[m] || 0;
              if (cnt <= 0) return;
              var slice = cnt / pieTotal * 2 * Math.PI;
              var endAng = ang + slice;
              var x1 = PCX + PR * Math.cos(ang), y1 = PCY + PR * Math.sin(ang);
              var x2 = PCX + PR * Math.cos(endAng), y2 = PCY + PR * Math.sin(endAng);
              var la = slice > Math.PI ? 1 : 0;
              pieSvg += '<path d="M ' + PCX + ' ' + PCY + ' L ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A ' + PR + ' ' + PR + ' 0 ' + la + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' Z" fill="' + escHtml(mCol(m)) + '" opacity="0.9" stroke="var(--card-bg)" stroke-width="0.5"/>';
              ang = endAng;
            });
            pieSvg += '</svg>';

            var ratioHtml = '<div style="flex:1;min-width:0;">';
            pieModels.forEach(function(m) {
              var cnt = totalsByModel[m] || 0;
              if (cnt <= 0) return;
              var ratio = Math.round(cnt / pieTotal * 1000) / 10;
              ratioHtml += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">';
              ratioHtml += '<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + escHtml(mCol(m)) + ';flex-shrink:0;"></span>';
              ratioHtml += '<span style="font-size:10px;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml(m) + '">' + escHtml(mShort(m)) + '</span>';
              ratioHtml += '<span style="font-size:10px;color:var(--text-muted);flex-shrink:0;margin-left:2px;">' + ratio.toFixed(1) + '%' + '</span>';
              ratioHtml += '</div>';
            });
            ratioHtml += '</div>';

            leftHtml += pieSvg + ratioHtml + '</div>';
          }

          // ===== 左パネル: API経由 モデル別円グラフ =====
          var apiModels = Object.keys(apiModelTotals).filter(function(m) { return m.indexOf(EXCL) < 0 && apiModelTotals[m] > 0; });
          apiModels.sort(function(a, b) { return apiModelTotals[b] - apiModelTotals[a]; });
          var apiTotal = apiModels.reduce(function(s, m) { return s + (apiModelTotals[m] || 0); }, 0);

          if (apiTotal > 0) {
            leftHtml += '<div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-top:12px;margin-bottom:4px;">API経由 モデル別</div>';
            leftHtml += '<div style="display:flex;align-items:flex-start;gap:8px;">';

            var APR = 46, APCX = 50, APCY = 50, APSZ = 100;
            var apiPieSvg = '<svg viewBox="0 0 ' + APSZ + ' ' + APSZ + '" width="' + APSZ + '" height="' + APSZ + '" style="flex-shrink:0;">';
            var apiAng = -Math.PI / 2;
            apiModels.forEach(function(m) {
              var cnt = apiModelTotals[m] || 0;
              if (cnt <= 0) return;
              var slice = cnt / apiTotal * 2 * Math.PI;
              var endAng = apiAng + slice;
              var x1 = APCX + APR * Math.cos(apiAng), y1 = APCY + APR * Math.sin(apiAng);
              var x2 = APCX + APR * Math.cos(endAng), y2 = APCY + APR * Math.sin(endAng);
              var la = slice > Math.PI ? 1 : 0;
              apiPieSvg += '<path d="M ' + APCX + ' ' + APCY + ' L ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A ' + APR + ' ' + APR + ' 0 ' + la + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' Z" fill="' + escHtml(mCol(m)) + '" opacity="0.9" stroke="var(--card-bg)" stroke-width="0.5"/>';
              apiAng = endAng;
            });
            apiPieSvg += '</svg>';

            var apiRatioHtml = '<div style="flex:1;min-width:0;">';
            apiModels.forEach(function(m) {
              var cnt = apiModelTotals[m] || 0;
              if (cnt <= 0) return;
              var ratio = Math.round(cnt / apiTotal * 1000) / 10;
              apiRatioHtml += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">';
              apiRatioHtml += '<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + escHtml(mCol(m)) + ';flex-shrink:0;"></span>';
              apiRatioHtml += '<span style="font-size:10px;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml(m) + '">' + escHtml(mShort(m)) + '</span>';
              apiRatioHtml += '<span style="font-size:10px;color:var(--text-muted);flex-shrink:0;margin-left:2px;">' + cnt + '件 ' + ratio.toFixed(1) + '%' + '</span>';
              apiRatioHtml += '</div>';
            });
            apiRatioHtml += '</div>';

            leftHtml += apiPieSvg + apiRatioHtml + '</div>';
          }

          // ===== 左パネル: リクエスト元別円グラフ(Slack/AIチャット入力窓/回答伝播ページ/ダイナミックワーカー) =====
          var SOURCE_LABELS = { slack: 'Slack', textbox: 'AIチャット入力窓', api: '回答伝播ページ', dynamicneko: 'ダイナミックワーカー' };
          var SOURCE_COLORS = { slack: '#611f69', textbox: '#0ea5e9', api: '#f59e0b', dynamicneko: '#10b981' };
          var sourceTotals = d.sourceTotals || {};
          var sourceKeys = ['slack', 'textbox', 'api', 'dynamicneko'].filter(function(k) { return (sourceTotals[k] || 0) > 0; });
          var sourceTotal = sourceKeys.reduce(function(s, k) { return s + (sourceTotals[k] || 0); }, 0);

          if (sourceTotal > 0) {
            leftHtml += '<div style="font-size:10px;font-weight:600;color:var(--text-secondary);margin-top:12px;margin-bottom:4px;">リクエスト元別</div>';

            var SPR = 46, SPCX = 50, SPCY = 50, SPSZ = 100;
            var sourcePieSvg = '<svg viewBox="0 0 ' + SPSZ + ' ' + SPSZ + '" width="' + SPSZ + '" height="' + SPSZ + '" style="flex-shrink:0;">';
            var sourceAng = -Math.PI / 2;
            sourceKeys.forEach(function(k) {
              var cnt = sourceTotals[k] || 0;
              if (cnt <= 0) return;
              var slice = cnt / sourceTotal * 2 * Math.PI;
              var endAng = sourceAng + slice;
              var x1 = SPCX + SPR * Math.cos(sourceAng), y1 = SPCY + SPR * Math.sin(sourceAng);
              var x2 = SPCX + SPR * Math.cos(endAng), y2 = SPCY + SPR * Math.sin(endAng);
              var la = slice > Math.PI ? 1 : 0;
              sourcePieSvg += '<path d="M ' + SPCX + ' ' + SPCY + ' L ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A ' + SPR + ' ' + SPR + ' 0 ' + la + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' Z" fill="' + SOURCE_COLORS[k] + '" opacity="0.9" stroke="var(--card-bg)" stroke-width="0.5"/>';
              sourceAng = endAng;
            });
            sourcePieSvg += '</svg>';

            // グラフの表記(円グラフ)の真下に、色見本とリクエスト元(Slack/AIチャット入力窓/
            // 回答伝播ページ/ダイナミックワーカー)の凡例を並べる(グラフの横ではなく下に配置)。
            var sourceRatioHtml = '<div style="margin-top:6px;">';
            sourceKeys.forEach(function(k) {
              var cnt = sourceTotals[k] || 0;
              if (cnt <= 0) return;
              var ratio = Math.round(cnt / sourceTotal * 1000) / 10;
              sourceRatioHtml += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">';
              sourceRatioHtml += '<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + SOURCE_COLORS[k] + ';flex-shrink:0;"></span>';
              sourceRatioHtml += '<span style="font-size:10px;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml(SOURCE_LABELS[k]) + '">' + escHtml(SOURCE_LABELS[k]) + '</span>';
              sourceRatioHtml += '<span style="font-size:10px;color:var(--text-muted);flex-shrink:0;margin-left:2px;">' + cnt + '件 ' + ratio.toFixed(1) + '%' + '</span>';
              sourceRatioHtml += '</div>';
            });
            sourceRatioHtml += '</div>';

            leftHtml += '<div>' + sourcePieSvg + sourceRatioHtml + '</div>';
          }

          // ===== 左パネル最下段: キーワード分類状況（総数・円グラフ・カテゴリ別棒グラフ） =====
          leftHtml += buildKwClassifyStatsHtml(kwAll, catSummary, catGroups);

          // ===== 右パネル: 日次折れ線（累計KW）+ 棒グラフ =====
          var cumKwByDay = {}, cumSum = 0;
          for (var i = 1; i <= daysInM; i++) {
            cumSum += (kwByDay[i] || 0);
            cumKwByDay[i] = cumSum;
          }
          var maxKw = Math.max(1, cumSum);
          var maxQ = 1;
          for (var i = 1; i <= daysInM; i++) {
            var tot = 0;
            if (modelsByDay[i]) { var ms = modelsByDay[i]; Object.keys(ms).forEach(function(mk) { tot += ms[mk]; }); }
            if (tot > maxQ) maxQ = tot;
          }

          var W = 380, ML = 26, MR = 4;
          var lineTop = 12, lineH = 80;
          var midGap = 24;
          var barTop = lineTop + lineH + midGap;
          var barH = 80;
          var xLbY = barTop + barH + 12;
          var svgH = xLbY + 4;
          var chartW = W - ML - MR;
          var slotW = chartW / daysInM;

          var svg = '<svg viewBox="0 0 ' + W + ' ' + svgH + '" width="100%" style="display:block;overflow:visible;">';
          svg += '<rect x="' + ML + '" y="' + lineTop + '" width="' + chartW + '" height="' + lineH + '" fill="var(--bg-secondary)" rx="2" opacity="0.5"/>';
          svg += '<rect x="' + ML + '" y="' + barTop + '" width="' + chartW + '" height="' + barH + '" fill="var(--bg-secondary)" rx="2" opacity="0.5"/>';
          svg += '<text x="' + (ML - 2) + '" y="' + (lineTop + 8) + '" font-size="7" fill="var(--text-muted)" text-anchor="end">KW</text>';
          svg += '<text x="' + (ML - 2) + '" y="' + (barTop + 8) + '" font-size="7" fill="var(--text-muted)" text-anchor="end">Q</text>';

          for (var gi = 0; gi <= 4; gi++) {
            var kwY = lineTop + lineH - Math.round(lineH * gi / 4);
            var kwV = Math.round(maxKw * gi / 4);
            svg += '<line x1="' + ML + '" y1="' + kwY + '" x2="' + (W - MR) + '" y2="' + kwY + '" stroke="var(--border-color)" stroke-width="0.5" stroke-dasharray="3,3"/>';
            if (gi > 0) svg += '<text x="' + (ML - 2) + '" y="' + (kwY + 3) + '" font-size="14" fill="var(--text-muted)" text-anchor="end">' + kwV + '</text>';
            var qY = barTop + barH - Math.round(barH * gi / 4);
            var qV = Math.round(maxQ * gi / 4);
            svg += '<line x1="' + ML + '" y1="' + qY + '" x2="' + (W - MR) + '" y2="' + qY + '" stroke="var(--border-color)" stroke-width="0.5" stroke-dasharray="3,3"/>';
            if (gi > 0) svg += '<text x="' + (ML - 2) + '" y="' + (qY + 3) + '" font-size="14" fill="var(--text-muted)" text-anchor="end">' + qV + '</text>';
          }

          var fillPts = ML.toFixed(1) + ',' + (lineTop + lineH).toFixed(1);
          var linePts = '';
          for (var i = 1; i <= daysInM; i++) {
            var cx = ML + (i - 0.5) * slotW;
            var kw = cumKwByDay[i] || 0;
            var cy = lineTop + lineH - (kw / maxKw) * lineH;
            fillPts += ' ' + cx.toFixed(1) + ',' + cy.toFixed(1);
            linePts += (i === 1 ? '' : ' ') + cx.toFixed(1) + ',' + cy.toFixed(1);
          }
          fillPts += ' ' + (ML + (daysInM - 0.5) * slotW).toFixed(1) + ',' + (lineTop + lineH).toFixed(1);
          svg += '<polygon points="' + fillPts + '" fill="#6366f1" opacity="0.15"/>';
          svg += '<polyline points="' + linePts + '" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>';
          for (var i = 1; i <= daysInM; i++) {
            var kw = cumKwByDay[i] || 0;
            if (kw > 0) {
              var cx = ML + (i - 0.5) * slotW;
              var cy = lineTop + lineH - (kw / maxKw) * lineH;
              svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="2" fill="#6366f1"/>';
            }
          }

          var barW = Math.max(1.5, slotW * 0.72);
          for (var i = 1; i <= daysInM; i++) {
            var mData = modelsByDay[i] || {};
            if (Object.keys(mData).length === 0) continue;
            var bx = ML + (i - 0.5) * slotW - barW / 2;
            var stackY = barTop + barH;
            sortedModels.forEach(function(m) {
              var cnt = mData[m] || 0;
              if (cnt <= 0) return;
              var bh = (cnt / maxQ) * barH;
              stackY -= bh;
              svg += '<rect x="' + bx.toFixed(1) + '" y="' + stackY.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + escHtml(mCol(m)) + '" rx="1" opacity="0.88"/>';
            });
          }

          for (var i = 1; i <= daysInM; i++) {
            if (i === 1 || i === 10 || i === 20 || i === daysInM || i % 10 === 0) {
              var lx = ML + (i - 0.5) * slotW;
              svg += '<text x="' + lx.toFixed(1) + '" y="' + xLbY + '" font-size="8" fill="var(--text-muted)" text-anchor="middle">' + i + '</text>';
            }
          }

          var midY = ((lineTop + lineH + barTop) / 2).toFixed(1);
          svg += '<line x1="' + ML + '" y1="' + midY + '" x2="' + (W - MR) + '" y2="' + midY + '" stroke="var(--border-color)" stroke-width="0.5"/>';
          svg += '</svg>';

          var embSectionHtml = buildEmbeddingModelRatioSectionHtml(kwAll.length, embModelCounts);

          dailyStatsBody.innerHTML = '<div style="display:grid;grid-template-columns:160px 1fr;gap:14px;align-items:start;">' +
            '<div>' + leftHtml + '</div>' +
            '<div>' + svg + '</div>' +
            '</div>' + embSectionHtml;
        })
        .catch(function() { dailyStatsBody.innerHTML = '<div style="color:var(--text-muted);padding:20px 0;">取得に失敗しました</div>'; });
    }

    document.getElementById('dailyStatsPrev').addEventListener('click', function() {
      var d = new Date(dailyStatsCurrentMonth + '-01');
      d.setMonth(d.getMonth() - 1);
      dailyStatsCurrentMonth = d.toISOString().slice(0, 7);
      renderDailyStatsChart();
    });
    document.getElementById('dailyStatsNext').addEventListener('click', function() {
      var d = new Date(dailyStatsCurrentMonth + '-01');
      d.setMonth(d.getMonth() + 1);
      dailyStatsCurrentMonth = d.toISOString().slice(0, 7);
      renderDailyStatsChart();
    });
    dailyStatsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      dailyStatsCurrentMonth = calCurrentMonth;
      dailyStatsModal.style.zIndex = String(getNextZ());
      dailyStatsModal.classList.add('open');
      dailyStatsModal.setAttribute('aria-hidden', 'false');
      renderDailyStatsChart();
    });
    dailyStatsClose.addEventListener('click', function() {
      dailyStatsModal.classList.remove('open');
      dailyStatsModal.setAttribute('aria-hidden', 'true');
    });
    dailyStatsModal.addEventListener('click', function(e) {
      if (e.target === dailyStatsModal) { dailyStatsModal.classList.remove('open'); dailyStatsModal.setAttribute('aria-hidden', 'true'); }
    });

    // ===== チャット =====
    var chatLog = document.getElementById('chatLog');
    var chatForm = document.getElementById('chatForm');
    var chatInput = document.getElementById('chatInput');
    var chatSendBtn = document.getElementById('chatSendBtn');
    var chatAttachBtn = document.getElementById('chatAttachBtn');
    var chatImageInput = document.getElementById('chatImageInput');
    var chatImagePreviewRow = document.getElementById('chatImagePreviewRow');
    var chatImagePreviewImg = document.getElementById('chatImagePreviewImg');
    var chatImagePreviewRemove = document.getElementById('chatImagePreviewRemove');
    var pendingImageDataUrl = null;
    // thread-trackerから開いた場合は既存の再質問IDを引き継ぐ。それ以外は
    // ページを開いている間に発行されたIDで後続ターンを束ねる。
    var trackerParams = new URLSearchParams(location.search);
    var requestedThreadId = trackerParams.get('threadId') || '';
    var currentThreadId = /^[0-9a-f]{32}$/i.test(requestedThreadId) ? requestedThreadId : null;
    var trackerDraft = trackerParams.get('draft');
    if (trackerDraft) chatInput.value = trackerDraft;

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

    // ===== 探索の境界線(未分類キーワード)パネル =====
    // ベクタ化済みの回答から抽出されたキーワードのうち、まだどのカテゴリにも
    // 分類されていないもの(aichat_keyword_category_map未登録=境界線の外側)を
    // 一覧表示する。「理解済みですか」という自己申告は根拠が曖昧なため置かず、
    // 既存のキーワード分類(実際に分類したかどうか)だけを根拠にする。
    // 各キーワードにはチェックボックスが付いており、テキスト部分をクリックすると
    // 「〇〇について説明してください」を入力欄に差し込んで単発の質問ができる
    // (従来通り)。チェックボックスは「自動探索」の対象を選ぶためのもので、
    // 一覧に出ているものを無差別に自動探索するのではなく、ユーザーが選んだ
    // ものだけを起点にする(「選択されたものだけを問い合わせろ」という
    // 指摘への対応)。分類はanswer-graph側で行うため、このパネル自体は
    // 一覧表示とテンプレート差し込みだけを担い、回答のベクタ化(✂️)後と
    // 初回表示時に一覧を読み直す。
    var keywordBoundaryPanel = document.getElementById('keywordBoundaryPanel');
    var keywordBoundaryChips = document.getElementById('keywordBoundaryChips');
    var keywordBoundarySelection = {};

    function fillChatInputWithBoundaryTemplate(keyword) {
      chatInput.value = keyword + 'について説明してください';
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
      chatInput.focus();
    }

    function renderKeywordBoundaryChips(keywords) {
      keywordBoundaryChips.innerHTML = '';
      var stillPresent = {};
      keywords.forEach(function(entry) {
        stillPresent[entry.keyword] = true;
        var wrap = document.createElement('span');
        wrap.className = 'kb-chip-wrap';

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'kb-chip-check';
        checkbox.checked = !!keywordBoundarySelection[entry.keyword];
        checkbox.setAttribute('aria-label', entry.keyword + 'を自動探索の対象に選ぶ');
        checkbox.addEventListener('change', function() {
          if (checkbox.checked) {
            keywordBoundarySelection[entry.keyword] = true;
          } else {
            delete keywordBoundarySelection[entry.keyword];
          }
        });
        wrap.appendChild(checkbox);

        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'kb-chip';
        chip.textContent = entry.keyword;
        chip.title = entry.keyword + 'について説明してください(クリックで入力欄へ)';
        chip.addEventListener('click', function() { fillChatInputWithBoundaryTemplate(entry.keyword); });
        wrap.appendChild(chip);

        keywordBoundaryChips.appendChild(wrap);
      });
      // 一覧から消えた(=分類済みになった等)キーワードの選択状態は残さない。
      Object.keys(keywordBoundarySelection).forEach(function(keyword) {
        if (!stillPresent[keyword]) delete keywordBoundarySelection[keyword];
      });
      // 未分類キーワードが0件でも、手入力での自動探索(autoExploreManualInput)は
      // 使えるようにしたいので、一覧が空でもパネル自体は常に表示する。
      keywordBoundaryPanel.classList.add('kb-panel-visible');
    }

    function loadUnknownKeywordBoundaryPanel() {
      fetch('/api/aichat/keyword-boundary/unknown?limit=20', { credentials: 'same-origin' })
        .then(function(r) { return r.ok ? r.json() : { keywords: [] }; })
        .then(function(data) { renderKeywordBoundaryChips(data.keywords || []); })
        .catch(function() {
          // 一覧取得の失敗はパネルを非表示のままにするだけで、チャット自体の
          // 利用は妨げない(探索の境界線はあくまで補助機能のため)。
        });
    }

    loadUnknownKeywordBoundaryPanel();

    // 「自動探索」: 入力待ちを挟まず、選んだキーワードを起点に最大3階層まで
    // 自動で問い合わせを進める。1階層目は「一覧を無差別に上から拾う」のでは
    // なく、ユーザーがチェックボックスで選んだキーワードだけを対象にする
    // (指摘への対応: 選択されたものだけを問い合わせる)。2階層目以降は、
    // そこから新しく抽出されたキーワードへ自然に掘り下げていく(抽出が
    // 新しい順に並ぶ一覧を取得し、まだこの回で処理していないものを拾う)。
    // 1件でもAI呼び出し/Jev処理/ベクタ化に失敗したら即座に打ち切り、
    // そこまでの結果を報告する(コストは気にしないが、エラーが出たら
    // 止める方針のため)。分類自体はこの機能では行わず、最後に
    // 「分類済み/未分類」の累計を表示するだけに留める。
    //
    // 各キーワードは必ず「AI問い合わせ→Jev処理→キー切り出し」の順で処理する
    // (✂️ボタンの既存フロー(createJevValuesWidget/onJevComplete)と同じく、
    // キー切り出し(vectorizeAnswerAndExtractKeywords)はJev処理が完了した
    // 回答に対してだけ行う設計を守る。Jev処理をすっ飛ばして先にキー切り出し
    // だけ行うことはしない)。
    var autoExploreBtn = document.getElementById('autoExploreBtn');
    var autoExploreManualInput = document.getElementById('autoExploreManualInput');
    var autoExploreProgressLog = document.getElementById('autoExploreProgressLog');
    var AUTO_EXPLORE_MAX_LEVELS = 3;
    var AUTO_EXPLORE_LEVEL_LIMIT = 20;
    var autoExploreRunning = false;
    var autoExploreCancelRequested = false;

    function autoExploreClock() {
      return new Date().toLocaleTimeString('ja-JP', { hour12: false });
    }

    function autoExploreLogLine(text) {
      var line = document.createElement('div');
      line.textContent = text;
      autoExploreProgressLog.appendChild(line);
      autoExploreProgressLog.scrollTop = autoExploreProgressLog.scrollHeight;
    }

    // 1段階ぶん(AI問い合わせ/Jev処理/キー切り出し)を実行し、開始・完了
    // (または失敗)をそれぞれ時刻・所要秒数つきでログへ出す共通ラッパー。
    function autoExploreRunStage(keyword, stageLabel, run) {
      var startedAt = Date.now();
      autoExploreLogLine('[' + keyword + '] ' + stageLabel + '開始 ' + autoExploreClock());
      return run().then(
        function(value) {
          var elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
          autoExploreLogLine('[' + keyword + '] ' + stageLabel + '完了 ' + autoExploreClock() + ' (' + elapsed + 's)');
          return value;
        },
        function(err) {
          var elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
          autoExploreLogLine('[' + keyword + '] ' + stageLabel + '失敗 ' + autoExploreClock() + ' (' + elapsed + 's)');
          throw err;
        }
      );
    }

    function autoExploreProcessKeyword(keyword) {
      return autoExploreRunStage(keyword, 'AI問い合わせ', function() {
        return fetch('/api/aichat', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: keyword + 'について説明してください', model: lastModel, systemPromptMode: langModeSelect.value, source: 'auto-explore' }),
        })
          .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
          .then(function(res) {
            if (res.status < 200 || res.status >= 300 || res.data.error || !res.data.shareId) {
              throw new Error((res.data && res.data.error) || keyword + 'への問い合わせに失敗しました');
            }
            return { shareId: res.data.shareId, model: res.data.usedModel || lastModel };
          });
      }).then(function(answer) {
        return autoExploreRunStage(keyword, 'Jev処理', function() {
          return fetch('/api/aichat/jev-score', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shareId: answer.shareId, model: answer.model }),
          })
            .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
            .then(function(result) {
              if (!result.ok || !result.data || result.data.verified !== true) {
                throw new Error((result.data && result.data.error) || keyword + 'のJev処理に失敗しました');
              }
              return answer;
            });
        });
      }).then(function(answer) {
        return autoExploreRunStage(keyword, 'キー切り出し', function() {
          return vectorizeAnswerAndExtractKeywords(answer.shareId, AICHAT_SCISSORS_EMBEDDING_MODEL, true).then(function(result) {
            if (result.status < 200 || result.status >= 300 || !result.data) {
              throw new Error((result.data && result.data.error) || keyword + 'のキー切り出しに失敗しました');
            }
            // POST /api/aichat/vectorize-answerは、ベクタ化自体が成功していれば
            // キーワード抽出(予備知識キーワード抽出)が失敗していても200を返し、
            // 理由を_keywordsWarningに入れるだけで済ませる(ベクタ化と抽出の
            // 失敗を独立に扱う仕様)。ここでHTTPステータスだけを見て「完了」と
            // 扱うと、実際には1件もキーワードが切り出せていないのに気付けない
            // (「キー切り出しが上手くいっていない」の原因)。_keywordsWarningが
            // 付いている場合は明示的に失敗として扱う。
            if (result.data._keywordsWarning) {
              throw new Error(keyword + 'のキー切り出しに失敗しました: ' + result.data._keywordsWarning);
            }
          });
        });
      });
    }

    function autoExploreRunCandidates(candidates, processedKeywords) {
      var chain = Promise.resolve();
      candidates.forEach(function(keyword) {
        if (processedKeywords[keyword]) return;
        chain = chain.then(function() {
          if (autoExploreCancelRequested) return;
          processedKeywords[keyword] = true;
          return autoExploreProcessKeyword(keyword);
        });
      });
      return chain;
    }

    function autoExploreNextLevelCandidates(processedKeywords) {
      return fetch('/api/aichat/keyword-boundary/unknown?limit=' + AUTO_EXPLORE_LEVEL_LIMIT, { credentials: 'same-origin' })
        .then(function(r) { return r.ok ? r.json() : { keywords: [] }; })
        .then(function(data) {
          return (data.keywords || [])
            .map(function(entry) { return entry.keyword; })
            .filter(function(keyword) { return !processedKeywords[keyword]; });
        });
    }

    function setAutoExploreButtonRunning() {
      autoExploreBtn.disabled = false;
      autoExploreBtn.classList.add('kb-running');
      autoExploreBtn.textContent = '⏹ 停止';
      autoExploreBtn.title = '自動探索を停止する(今の問い合わせが終わり次第止まります)';
      autoExploreManualInput.disabled = true;
    }

    function setAutoExploreButtonIdle() {
      autoExploreBtn.disabled = false;
      autoExploreBtn.classList.remove('kb-running');
      autoExploreBtn.textContent = '🧭 自動探索';
      autoExploreBtn.title = 'チェックした(または入力した)キーワードを起点に、入力待ちを挟まず最大3階層まで自動で問い合わせる';
      autoExploreManualInput.disabled = false;
    }

    function runAutoExplore() {
      // 起点は「チェックボックスで選んだキーワード」と「手入力欄
      // (autoExploreManualInput)に入力したキーワード」の両方を合わせる。
      // 手入力は一覧に出ていない(=まだベクタ化すらされていない)キーワードも
      // 探索の起点にできるようにするためのもので、カンマ・読点区切りで
      // 複数指定できる。
      var seedSet = {};
      Object.keys(keywordBoundarySelection).forEach(function(keyword) { seedSet[keyword] = true; });
      var manualRaw = (autoExploreManualInput.value || '').trim();
      var manualKeywords = manualRaw.length > 0
        ? manualRaw.split(/[,、]/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; })
        : [];
      manualKeywords.forEach(function(keyword) { seedSet[keyword] = true; });
      var seedKeywords = Object.keys(seedSet);

      if (seedKeywords.length === 0) {
        showAichatToast('自動探索するキーワードをチェックするか、入力してください', 'aichat-scissors-toast-neutral');
        return;
      }

      autoExploreRunning = true;
      autoExploreCancelRequested = false;
      setAutoExploreButtonRunning();
      autoExploreManualInput.value = '';
      autoExploreProgressLog.innerHTML = '';
      autoExploreProgressLog.classList.add('kb-progress-log-visible');
      showAichatToast('自動探索を開始します(選択' + seedKeywords.length + '件・最大' + AUTO_EXPLORE_MAX_LEVELS + '階層)', 'aichat-scissors-toast-neutral');

      var processedKeywords = {};
      var stoppedByError = null;

      // 1階層目: 選択されたキーワードのみ。
      var chain = autoExploreRunCandidates(seedKeywords, processedKeywords).catch(function(err) {
        stoppedByError = err instanceof Error ? err.message : String(err);
      });

      // 2階層目以降: 1階層目で新たに抽出されたキーワードへ自然に掘り下げる。
      for (var level = 1; level < AUTO_EXPLORE_MAX_LEVELS; level++) {
        chain = chain.then(function() {
          if (stoppedByError || autoExploreCancelRequested) return;
          return autoExploreNextLevelCandidates(processedKeywords).then(function(candidates) {
            return autoExploreRunCandidates(candidates, processedKeywords);
          });
        }).catch(function(err) {
          stoppedByError = err instanceof Error ? err.message : String(err);
        });
      }

      chain
        .then(function() {
          keywordBoundarySelection = {};
          loadUnknownKeywordBoundaryPanel();
          return fetch('/api/aichat/keyword-boundary/stats', { credentials: 'same-origin' })
            .then(function(r) { return r.ok ? r.json() : null; })
            .catch(function() { return null; });
        })
        .then(function(stats) {
          var summary = stats ? ('分類済み' + stats.classifiedCount + '件 / 未分類' + stats.unclassifiedCount + '件') : '';
          if (stoppedByError) {
            showAichatToast('自動探索を途中で停止しました(' + stoppedByError + ') ' + summary, 'aichat-scissors-toast-neutral');
          } else if (autoExploreCancelRequested) {
            showAichatToast('自動探索を停止しました ' + summary, 'aichat-scissors-toast-neutral');
          } else {
            showAichatToast('自動探索完了 ' + summary, 'aichat-send-toast-ok');
          }
        })
        .finally(function() {
          autoExploreRunning = false;
          autoExploreCancelRequested = false;
          setAutoExploreButtonIdle();
        });
    }

    autoExploreBtn.addEventListener('click', function() {
      if (autoExploreRunning) {
        autoExploreCancelRequested = true;
        autoExploreBtn.disabled = true;
        autoExploreBtn.textContent = '⏹ 停止中...';
        return;
      }
      runAutoExplore();
    });

    // ===== 写真添付(＋ボタン) =====
    var MAX_IMAGE_FILE_BYTES = 6 * 1024 * 1024;
    var ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    function validateAttachedImageFile(file) {
      if (!file) return '画像が選択されていません';
      if (ALLOWED_IMAGE_TYPES.indexOf(file.type) === -1) return '対応していない画像形式です(png/jpeg/webp/gifのみ)';
      if (file.size > MAX_IMAGE_FILE_BYTES) return '画像サイズが大きすぎます(上限6MB)';
      return null;
    }
    function clearAttachedImage() {
      pendingImageDataUrl = null;
      chatImageInput.value = '';
      chatImagePreviewImg.src = '';
      chatImagePreviewRow.style.display = 'none';
    }
    chatAttachBtn.addEventListener('click', function() { chatImageInput.click(); });
    chatImageInput.addEventListener('change', function() {
      var file = this.files && this.files[0];
      if (!file) return;
      var err = validateAttachedImageFile(file);
      if (err) {
        appendBubble(err, 'error');
        chatImageInput.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function(e) {
        pendingImageDataUrl = e.target.result;
        chatImagePreviewImg.src = pendingImageDataUrl;
        chatImagePreviewRow.style.display = 'flex';
      };
      reader.onerror = function() {
        appendBubble('画像の読み込みに失敗しました', 'error');
        chatImageInput.value = '';
      };
      reader.readAsDataURL(file);
    });
    chatImagePreviewRemove.addEventListener('click', function() { clearAttachedImage(); });

    function extractRespUsage(data) {
      return {
        input_tokens: (data && data.input_tokens) ?? null,
        output_tokens: (data && data.output_tokens) ?? null,
        total_tokens: (data && data.total_tokens) ?? null
      };
    }

    // 対象: /neko cal の出力バブルのみ。APIキー経由のプレーンテキスト応答には
    // 影響しない、ブラウザUI限定の見た目調整(今日のマスの背景色)。
    // タイトル行が「| YYYY年M月 |」+「|:---:|」の中央寄せ1列テーブルという
    // /neko calの出力形状(formatJstMonthCalendar)でのみ発火させ、他の
    // /nekoサブコマンドやAI生成テーブルには影響させない。
    function highlightNekoCalToday(el, text) {
      var lines = String(text).split('\\n');
      if (lines.length < 2) return;
      if (!/^\\|\\s*\\d{4}年\\d{1,2}月\\s*\\|$/.test(lines[0])) return;
      if (lines[1].trim() !== '|:---:|') return;
      var strongEls = el.querySelectorAll('table strong');
      for (var i = 0; i < strongEls.length; i++) {
        var td = strongEls[i].closest('td');
        if (td) td.style.backgroundColor = '#d4f5d4';
      }
    }

    // 対象: /neko tlist の出力バブルのみ。次の予定が1件も無い場合に「次の予定一覧」
    // 見出しの行末へ「登録」ボタンを追加し、押すとカウントダウンページと同じ
    // 登録機能一式(openCountdownQuickAddModal、src/utils/countdownQuickAdd.ts)を
    // 呼び出してその場で予定登録できるようにする。
    /**
     * /neko gh pr list の応答バブル向け。gh-wasm(Rust)が返すMarkdownテーブルの
     * 見出し(「## Pulls 一覧(Draft : ◯/Open : △)」)を含む場合のみ適用する。
     * No./作成者/コンフリクト列の中央寄せ・6桁ゼロ埋めはRust側(format_pr_list)で
     * Markdownの列揃え記法とゼロ埋めとして既に出力済みなので、ここでは
     * markdownRenderer.tsのparseMd()がHTMLをエスケープする都合上Markdown単体
     * では表現できない「状態(open/draft)列をGitHub準拠の色バッジに置き換える」
     * 処理と、応答バブル右端の余白ゼロ化(CSSクラス付与)のみを担う。
     */
    function styleGhPrListBubble(el, text) {
      var body = String(text);
      if (body.indexOf('Pulls 一覧') === -1) return;
      el.classList.add('gh-pr-list-bubble');
      var heading = el.querySelector('h2');
      if (heading) {
        var headingMatch = /Draft\\s*:\\s*(\\d+)\\s*\\/\\s*Open\\s*:\\s*(\\d+)/.exec(heading.textContent || '');
        if (headingMatch) {
          heading.textContent = '';
          heading.classList.add('gh-pr-list-heading');
          var titleSpan = document.createElement('span');
          titleSpan.className = 'gh-pr-list-heading-title';
          titleSpan.textContent = 'Pulls 一覧';
          heading.appendChild(titleSpan);
          var badgesWrap = document.createElement('span');
          badgesWrap.className = 'gh-pr-list-heading-badges';
          var draftBadge = document.createElement('span');
          draftBadge.className = 'gh-pr-state-badge gh-pr-state-draft';
          draftBadge.textContent = 'Draft : ' + headingMatch[1];
          badgesWrap.appendChild(draftBadge);
          var openBadge = document.createElement('span');
          openBadge.className = 'gh-pr-state-badge gh-pr-state-open';
          openBadge.textContent = 'Open : ' + headingMatch[2];
          badgesWrap.appendChild(openBadge);
          heading.appendChild(badgesWrap);
        }
      }
      var table = el.querySelector('table');
      if (!table) return;
      var rows = table.querySelectorAll('tbody tr');
      for (var i = 0; i < rows.length; i++) {
        var cells = rows[i].querySelectorAll('td');
        var stateCell = cells[3];
        if (!stateCell) continue;
        var raw = stateCell.textContent.trim().toLowerCase();
        var cls = raw === 'draft' ? 'gh-pr-state-draft' : (raw === 'closed' ? 'gh-pr-state-closed' : 'gh-pr-state-open');
        var label = raw === 'draft' ? 'Draft' : (raw === 'closed' ? 'Closed' : 'Open');
        stateCell.textContent = '';
        var badge = document.createElement('span');
        badge.className = 'gh-pr-state-badge ' + cls;
        badge.textContent = label;
        stateCell.appendChild(badge);

        var conflictCell = cells[4];
        if (!conflictCell) continue;
        var conflictRaw = conflictCell.textContent.trim();
        var conflictCls = conflictRaw === 'あり' ? 'gh-pr-conflict-yes' : (conflictRaw === '確認中' ? 'gh-pr-conflict-unknown' : 'gh-pr-conflict-no');
        conflictCell.textContent = '';
        var conflictBadge = document.createElement('span');
        conflictBadge.className = 'gh-pr-state-badge ' + conflictCls;
        conflictBadge.textContent = conflictRaw;
        conflictCell.appendChild(conflictBadge);
      }
    }

    function addTlistRegisterButton(el, text) {
      var body = String(text);
      if (body.indexOf('## 次の予定一覧') !== 0) return;
      if (body.indexOf('登録されている予定はありません') === -1) return;
      var heading = el.querySelector('h2');
      if (!heading || typeof window.openCountdownQuickAddModal !== 'function') return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tlist-register-btn';
      btn.textContent = '登録';
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        window.openCountdownQuickAddModal();
      });
      heading.appendChild(btn);
    }

    // ✂️(切り取り)ボタンが呼ぶvectorizeAnswerAndExtractKeywordsへ渡す埋め込み
    // モデル名。buildAssistantBubbleの引数modelはAIチャットの応答生成に
    // 使われたモデル(例: @cf/meta/llama-3.3-70b-instruct-fp8-fast)であり、
    // サーバー側のKEYWORD_EMBEDDING_MODELS一覧に含まれない埋め込み非対応の
    // モデル名なので、誤ってこれをそのまま渡すと
    // 「不明な埋め込みモデルです」という400エラーになりベクタ化が常に
    // 失敗していた(✂️ボタンが手動でも自動でも一切動かない不具合の原因)。
    // ✂️は常にPlaMo埋め込みモデルで実行する仕様のため、チャットモデル名とは
    // 独立した固定のモデル名を使い、空欄にもならないようにする。
    // さらに、vectorizeAnswerAndExtractKeywordsの第3引数にforcePlamo=trueを
    // 渡すことで、サーバー側(/api/aichat/vectorize-answer)にもここで送る
    // モデル名を問答無用でPLAMO_EMBEDDING_MODELへ上書きさせる。クライアント側の
    // 修正が未デプロイのまま旧フロントエンドがチャットモデル名を送ってきても
    // サーバー側だけで確実にPlaMo固定になる二重の安全策(answer-graph側の
    // モデル選択ボタンはforcePlamoを渡さないため、この上書きの影響を受けない)。
    var AICHAT_SCISSORS_EMBEDDING_MODEL = '@cf/pfnet/plamo-embedding-1b';

    function buildAssistantBubble(text, model, isFallback, usage, isLocalCommand, nekoResults, svg, nekoCursorResults, shareId) {
      var el = document.createElement('div');
      el.className = 'chat-bubble assistant preview-area';
      el.innerHTML = parseMd(text);
      if (isLocalCommand) highlightNekoCalToday(el, text);
      if (isLocalCommand) addTlistRegisterButton(el, text);
      if (isLocalCommand) styleGhPrListBubble(el, text);
      if (isLocalCommand && svg) {
        // svgはサーバー(aichatSlashCommand.ts)側で固定パレット+数値のみから
        // 組み立てた自前生成のマークアップで、AI応答等の非信頼入力を含まない
        // ためparseMd()を経由させずそのままinnerHTMLする(型定義側のコメント参照)。
        var svgWrap = document.createElement('div');
        svgWrap.className = 'neko-svg-chart';
        svgWrap.innerHTML = svg;
        el.appendChild(svgWrap);
      }
      if (isLocalCommand && nekoResults && nekoResults.length > 0) {
        var resultsRow = document.createElement('div');
        resultsRow.className = 'neko-results-link-row';
        var resultsLink = document.createElement('a');
        resultsLink.href = '#';
        resultsLink.className = 'neko-results-link';
        resultsLink.textContent = '📋 ヒット結果一覧を表示（' + nekoResults.length + '件）';
        resultsLink.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          openNekoResultsModal(nekoResults);
        });
        resultsRow.appendChild(resultsLink);
        el.appendChild(resultsRow);
      }
      if (!isLocalCommand) {
        var copyBtn = document.createElement('button');
        copyBtn.className = 'bubble-copy-btn';
        copyBtn.title = '回答をコピー';
        copyBtn.textContent = '📋';
        copyBtn.onclick = function(e) {
          e.stopPropagation();
          navigator.clipboard.writeText(text).then(function() {
            copyBtn.textContent = '✓';
            copyBtn.classList.add('copied');
            setTimeout(function() { copyBtn.textContent = '📋'; copyBtn.classList.remove('copied'); }, 2000);
          }).catch(function() {});
        };
        el.appendChild(copyBtn);
      }
      if (isFallback) {
        var notice = document.createElement('div');
        notice.className = 'bubble-fallback-notice';
        notice.textContent = 'この言語モデル（' + shortModelName(model) + '）は応答に問題があったためデフォルトの言語モデルにフォールバックされました';
        el.appendChild(notice);
      }
      if (usage && (usage.input_tokens != null || usage.total_tokens != null)) {
        var tokRow = document.createElement('div');
        tokRow.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:6px;';
        if (shareId) {
          // 「切り取り」(ベクタ化+予備知識キーワード抽出+未登録キーワード一括登録)を
          // トークン表示の左に置く。埋め込みテーブル(aichat_answer_vectors)に
          // まだ登録されていない場合は背景を黄色にし、隣のチェックボックスがONの
          // 状態でJev判定が完了したタイミング(runJevScoreAndShow成功時)に
          // 自動でこの処理一式を実行する。
          var scissorsBtn = document.createElement('button');
          scissorsBtn.type = 'button';
          scissorsBtn.className = 'search-hist-btn';
          scissorsBtn.style.cssText = 'padding:2px 5px;font-size:11px;line-height:1;';
          scissorsBtn.textContent = '✂️';
          scissorsBtn.title = 'この回答をベクタ化してキーワードを一括登録する';
          tokRow.appendChild(scissorsBtn);

          var autoVectorizeLabel = document.createElement('label');
          autoVectorizeLabel.style.cssText = 'display:inline-flex;align-items:center;gap:2px;font-size:10px;color:var(--text-muted);cursor:pointer;';
          var autoVectorizeCheckbox = document.createElement('input');
          autoVectorizeCheckbox.type = 'checkbox';
          autoVectorizeCheckbox.style.cssText = 'width:12px;height:12px;margin:0;';
          var AUTO_VECTORIZE_COOKIE = 'aichat_auto_vectorize_after_jev';
          var autoVectorizeCookieMatch = document.cookie.match(/(?:^|;\s*)aichat_auto_vectorize_after_jev=([^;]*)/);
          autoVectorizeCheckbox.checked = !!(autoVectorizeCookieMatch && autoVectorizeCookieMatch[1] === 'on');
          autoVectorizeCheckbox.addEventListener('change', function() {
            document.cookie = AUTO_VECTORIZE_COOKIE + '=' + (autoVectorizeCheckbox.checked ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
          });
          autoVectorizeLabel.appendChild(autoVectorizeCheckbox);
          tokRow.appendChild(autoVectorizeLabel);

          var isAnswerVectorizedForScissors = false;
          function applyScissorsState() {
            scissorsBtn.style.background = isAnswerVectorizedForScissors ? '' : '#fff8c5';
          }
          applyScissorsState();
          fetch('/api/aichat/shares/' + encodeURIComponent(String(shareId)), { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              isAnswerVectorizedForScissors = !!(data && data.vectorized);
              applyScissorsState();
            })
            .catch(function() {});

          function runVectorizeAndBulkRegisterChain() {
            scissorsBtn.disabled = true;
            scissorsBtn.title = '処理中...';
            scissorsBtn.classList.add('scissors-btn-spinning');
            vectorizeAnswerAndExtractKeywords(shareId, AICHAT_SCISSORS_EMBEDDING_MODEL, true)
              .then(function(result) {
                if (result.status < 200 || result.status >= 300 || !result.data) {
                  throw new Error((result.data && result.data.error) || 'ベクタ化に失敗しました');
                }
                isAnswerVectorizedForScissors = true;
                applyScissorsState();
                showAichatToast('✂️切り出し完了', 'aichat-scissors-toast-cyan');
                // 新たに抽出されたキーワードのぶん、「探索の境界線」パネル
                // (未分類キーワード一覧)を最新化する。
                loadUnknownKeywordBoundaryPanel();
                var keywords = result.data.keywords || [];
                if (!keywords.length) {
                  showAichatToast('ベクタ化終了', 'aichat-send-toast-ok');
                  return;
                }
                return bulkRegisterUnregisteredKeywords(shareId, keywords, {})
                  .then(function() {
                    showAichatToast('新規キーワード切り出し完了', 'aichat-scissors-toast-neutral');
                    showAichatToast('ベクタ化終了', 'aichat-send-toast-ok');
                  });
              })
              .catch(function() {})
              .then(function() {
                scissorsBtn.disabled = false;
                scissorsBtn.title = 'この回答をベクタ化してキーワードを一括登録する';
                scissorsBtn.classList.remove('scissors-btn-spinning');
              });
          }
          scissorsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            runVectorizeAndBulkRegisterChain();
          });

          // Jev評価値ボタンの左に「jev評価の自動化」チェックボックスを置く。
          // ONの時だけ、まだJev評価データが無い(pink/yellow)場合に
          // runJevScoreAndShowを自動で呼び出しJev評価まで自動化する。
          var autoJevLabel = document.createElement('label');
          autoJevLabel.style.cssText = 'display:inline-flex;align-items:center;gap:2px;font-size:10px;color:var(--text-muted);cursor:pointer;';
          var autoJevCheckbox = document.createElement('input');
          autoJevCheckbox.type = 'checkbox';
          autoJevCheckbox.style.cssText = 'width:12px;height:12px;margin:0;';
          var AUTO_JEV_COOKIE = 'aichat_auto_jev_score';
          var autoJevCookieMatch = document.cookie.match(/(?:^|;\s*)aichat_auto_jev_score=([^;]*)/);
          autoJevCheckbox.checked = !!(autoJevCookieMatch && autoJevCookieMatch[1] === 'on');
          autoJevCheckbox.addEventListener('change', function() {
            document.cookie = AUTO_JEV_COOKIE + '=' + (autoJevCheckbox.checked ? 'on' : 'off') + '; Path=/; Secure; SameSite=Lax; Max-Age=31536000';
          });
          autoJevLabel.appendChild(autoJevCheckbox);
          tokRow.appendChild(autoJevLabel);

          // トークン出力の左側にJev評価値ボタンを置く(通常のAI応答バブル画面での動作確認用)。
          // historyModal専用ではなく、createJevValuesWidgetをここでも呼び出して
          // 同じ挙動(状態色・確認モーダル・Jev問い合わせ・DB登録)を再現する。
          var bubbleJevBtn = document.createElement('button');
          bubbleJevBtn.type = 'button';
          bubbleJevBtn.className = 'search-hist-btn';
          bubbleJevBtn.style.cssText = 'padding:2px 5px;font-size:11px;line-height:1;';
          bubbleJevBtn.textContent = '📔';
          tokRow.appendChild(bubbleJevBtn);
          var bubbleJevWidget = createJevValuesWidget({
            button: bubbleJevBtn,
            modal: jevValuesModal,
            body: jevValuesBody,
            closeBtn: jevValuesClose,
            getContext: function() { return { shareId: shareId, model: model }; },
            onStateLoaded: function(state) {
              // 両方のチェックボックスがONの場合に限り、Jev評価から
              // 「切り取り」(ベクタ化+キーワード抽出+一括登録)までを
              // すべて自動で行う。jev自動化のみONの場合はJev評価だけを
              // 自動化し、✂️側の自動実行はしない(onJevComplete側で判定)。
              if (autoJevCheckbox.checked && (state === 'pink' || state === 'yellow')) {
                bubbleJevWidget.runJevScoreAndShow();
                return;
              }
              // 根本原因: onJevCompleteはrunJevScoreAndShow(Jevへの新規問い合わせ)
              // が成功した時にしか発火しない。そのため、このバブルの回答が
              // 過去に既にJev評価済み(state==='green')だった場合は
              // runJevScoreAndShowが一度も呼ばれず、✂️チェックボックスと
              // jev自動化チェックボックスを両方ONにしていても✂️の自動連携が
              // 永久に発火しない不具合になっていた。既に評価済みの場合は
              // ここで直接同じ条件判定を行い、その場で切り取りチェーンを
              // 自動実行する。
              if (autoJevCheckbox.checked && autoVectorizeCheckbox.checked && state === 'green' && !isAnswerVectorizedForScissors) {
                runVectorizeAndBulkRegisterChain();
              }
            },
            onJevComplete: function() {
              if (autoJevCheckbox.checked && autoVectorizeCheckbox.checked && !isAnswerVectorizedForScissors) {
                runVectorizeAndBulkRegisterChain();
              }
            }
          });
          bubbleJevWidget.refresh();
        }
        var tokEl = document.createElement('span');
        tokEl.style.cssText = 'font-size:10px;color:var(--text-muted);letter-spacing:0.02em;';
        var parts = [];
        if (usage.input_tokens != null) parts.push('in:' + usage.input_tokens.toLocaleString());
        if (usage.output_tokens != null) parts.push('out:' + usage.output_tokens.toLocaleString());
        if (usage.total_tokens != null) parts.push('total:' + usage.total_tokens.toLocaleString());
        tokEl.textContent = parts.join(' / ') + ' tokens';
        tokRow.appendChild(tokEl);
        el.appendChild(tokRow);
      }
      if (isLocalCommand) {
        wireCsearchAnswerLinks(el, nekoCursorResults || []);
        wireQsearchIdLinks(el);
      }
      return el;
    }

    function appendBubble(text, role, model, isFallback, usage, imageDataUrl, isLocalCommand, nekoResults, svg, nekoCursorResults, shareId) {
      var el;
      if (role === 'assistant') {
        el = buildAssistantBubble(text, model, isFallback, usage, isLocalCommand, nekoResults, svg, nekoCursorResults, shareId);
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
        el = document.createElement('div');
        // ユーザー入力はMarkdownとして描画する(parseMdは内部でesc()により
        // HTMLエスケープしてからMarkdown記法を適用するため、そのままinnerHTMLに
        // 渡してもXSSにならない。'考え中...'等のthinking/errorバブルは
        // システム生成の定型文なのでMarkdown解釈せずtextContentのままにする)。
        el.className = 'chat-bubble ' + role + (role === 'user' ? ' preview-area' : '');
        if (imageDataUrl) {
          var bubbleImg = document.createElement('img');
          bubbleImg.className = 'chat-bubble-image';
          bubbleImg.src = imageDataUrl;
          el.appendChild(bubbleImg);
        }
        if (text) {
          var textEl = document.createElement('div');
          if (role === 'user') {
            textEl.innerHTML = parseMd(text);
          } else {
            textEl.textContent = text;
          }
          el.appendChild(textEl);
        }
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
      addBtn.onclick = function(e) {
        e.stopPropagation();
        currentHistoryQuestion = question;
        var p = container;
        var parentZ = 0;
        while (p && p !== document.body) {
          if (p.getAttribute && p.getAttribute('data-overlay')) {
            parentZ = parseInt(p.style.zIndex) || 0;
            break;
          }
          p = p.parentNode;
        }
        openAddSubqueryModal(parentZ || undefined);
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
    var MODEL_LIST = ${modelListJson};
    // テキストプロンプトに添付画像がある場合、選択中のモデルより優先して
    // moondream(/api/moondream-analyzeと同じ内部モデル)へ問い合わせるかどうか。
    // /settingsページのトグルで変更され、Cookie(aichat_prefer_moondream)に
    // 保存される。ページ読み込み時はサーバー側でCookieを読んで埋め込んだ
    // この初期値をそのまま使う(クライアント側でのCookie再読み込みは不要)。
    var aichatPreferMoondream = ${aichatPreferMoondreamInit};
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

    var modelDotDropdown = document.getElementById('modelDotDropdown');

    function buildModelDotDropdown() {
      modelDotDropdown.innerHTML = '';
      MODEL_LIST.forEach(function(m) {
        var item = document.createElement('div');
        item.className = 'model-dot-dropdown-item' + (m.value === lastModel ? ' selected' : '');
        var dot = document.createElement('span');
        dot.className = 'model-dot-dropdown-dot';
        dot.style.background = MODEL_COLORS[m.value] || 'var(--border-color)';
        var lbl = document.createElement('span');
        lbl.textContent = m.label;
        item.appendChild(dot);
        item.appendChild(lbl);
        item.addEventListener('click', function() {
          lastModel = m.value;
          modelSelect.value = m.value;
          applyModelColor(lastModel);
          closeModelDotDropdown();
        });
        modelDotDropdown.appendChild(item);
      });
    }

    function openModelDotDropdown() {
      buildModelDotDropdown();
      var rect = modelColorDot.getBoundingClientRect();
      modelDotDropdown.style.top = (rect.bottom + 4) + 'px';
      modelDotDropdown.style.left = rect.left + 'px';
      modelDotDropdown.style.zIndex = String(getNextZ());
      modelDotDropdown.classList.add('open');
    }

    function closeModelDotDropdown() {
      modelDotDropdown.classList.remove('open');
    }

    modelColorDot.addEventListener('click', function(e) {
      e.stopPropagation();
      if (modelDotDropdown.classList.contains('open')) {
        closeModelDotDropdown();
      } else {
        openModelDotDropdown();
      }
    });
    document.addEventListener('click', function() { closeModelDotDropdown(); });
    modelDotDropdown.addEventListener('click', function(e) { e.stopPropagation(); });

    var langModeSelect = document.getElementById('langModeSelect');

    // ナビバー表示設定: langModeSelect と modelSelect のCookie制御
    (function() {
      var mLang = document.cookie.match('(^|;)\\s*aichat_show_lang_mode=([^;]*)');
      var showLang = mLang ? decodeURIComponent(mLang[2]) === 'on' : false;
      if (!showLang) langModeSelect.style.display = 'none';

      var mModel = document.cookie.match('(^|;)\\s*aichat_show_model_name=([^;]*)');
      var showModel = mModel ? decodeURIComponent(mModel[2]) === 'on' : false;
      if (!showModel) modelSelect.style.display = 'none';
    })();

    // 画像添付時、Moondream(画像分析VLM)の分析結果を応答バブル内に追記する。
    // /api/aichat と /api/moondream-analyze は並行に呼び、どちらが先に
    // 終わっても取りこぼさないよう、バブル生成と分析結果の到着を
    // それぞれ独立に待ち合わせる(assistantBubbleEl/moondreamAnalysisText)。
    function appendMoondreamAnalysis(bubbleEl, analysisText) {
      var panel = document.createElement('div');
      panel.className = 'moondream-analysis';
      var label = document.createElement('div');
      label.className = 'moondream-analysis-label';
      label.textContent = '🖼️ 画像分析(Moondream)';
      var body = document.createElement('div');
      body.className = 'moondream-analysis-body preview-area';
      // AIチャット本体と同じ、安全な共有Markdownパーサーで画像分析も描画する。
      body.innerHTML = parseMd(analysisText);
      panel.appendChild(label);
      panel.appendChild(body);
      bubbleEl.appendChild(panel);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    var aichatRubyVM = null;
    var aichatRubyVMLoading = null;

${getRubyWasmLoaderScript()}
    function getAichatRubyVM() {
      if (aichatRubyVM) return Promise.resolve(aichatRubyVM);
      if (aichatRubyVMLoading) return aichatRubyVMLoading;
      aichatRubyVMLoading = new Promise(function(resolve, reject) {
        loadRubyWasmVm('${RUBY_WASM_JS_URL}', '${RUBY_WASM_BINARY_URL}', '${rubyCacheName}', {
          expectedBuildLine: '${rubyVersion.rubyBuildLine}',
          onReady: function(vm) { aichatRubyVM = vm; resolve(vm); },
          onError: reject
        });
      }).catch(function(err) { aichatRubyVMLoading = null; throw err; });
      return aichatRubyVMLoading;
    }

    function runAichatRuby(code) {
      return getAichatRubyVM().then(function(vm) {
        var wrapped = "require 'stringio'\\n__out = StringIO.new\\n__old = $stdout\\n$stdout = __out\\nbegin\\n" + code + "\\nensure\\n  $stdout = __old\\nend\\n__out.string";
        return vm.eval(wrapped).toString() || '(出力なし)';
      });
    }

    function prepareAichatRubyResponse(data) {
      if (typeof data.rubyCode !== 'string') return data;
      return runAichatRuby(data.rubyCode).then(function(rubyOutput) {
        var fence = String.fromCharCode(96, 96, 96);
        data.response = '## Ruby: ' + (data.rubyFilename || 'saved code') + '\\n\\n' + fence + 'text\\n' + rubyOutput.split(fence).join(String.fromCharCode(96, 32, 96, 32, 96)) + '\\n' + fence;
        return data;
      }, function(err) {
        data.response = '❌ Ruby/WASMの実行に失敗しました: ' + (err && err.message ? err.message : String(err));
        return data;
      });
    }

    chatForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var msg = chatInput.value.trim();
      var attachedImage = pendingImageDataUrl;
      if (!msg && !attachedImage) return;
      appendBubble(msg, 'user', null, null, null, attachedImage);
      chatInput.value = '';
      chatInput.style.height = 'auto';
      clearAttachedImage();
      chatSendBtn.disabled = true;
      var currentMsg = msg;
      var thinking = appendBubble('考え中...', 'thinking');
      var payload = { message: msg, model: lastModel, systemPromptMode: langModeSelect.value, source: 'textbox', threadId: currentThreadId };
      if (attachedImage) {
        payload.image = attachedImage;
        payload.preferMoondream = aichatPreferMoondream;
      }

      var assistantBubbleEl = null;
      var moondreamAnalysisText = null;
      var pendingShareIdForMoondream = null;
      var moondreamAnalysisSaved = false;
      function tryAppendMoondream() {
        if (assistantBubbleEl && moondreamAnalysisText) {
          appendMoondreamAnalysis(assistantBubbleEl, moondreamAnalysisText);
        }
        // /api/aichat(回答本体・shareId)と/api/moondream-analyze(画像分析)は
        // 並行に呼ばれ、どちらが先に終わるか分からない。両方が出揃った時点で
        // 一度だけ保存APIを呼ぶ(moondreamAnalysisSavedで二重送信を防ぐ)。
        if (!moondreamAnalysisSaved && moondreamAnalysisText && pendingShareIdForMoondream) {
          moondreamAnalysisSaved = true;
          fetch('/api/aichat/moondream-analysis', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shareId: pendingShareIdForMoondream, analysisText: moondreamAnalysisText })
          }).catch(function() {});
        }
      }
      if (attachedImage) {
        fetch('/api/moondream-analyze', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: attachedImage, prompt: currentMsg })
        })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (data && data.analysis) {
              moondreamAnalysisText = data.analysis;
              tryAppendMoondream();
            }
          })
          .catch(function() {});
      }

      fetch('/api/aichat', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function(res) { return res.json(); })
        .then(prepareAichatRubyResponse)
        .then(function(data) {
          thinking.remove();
          if (data.error) {
            appendBubble('エラー: ' + data.error, 'error');
          } else {
            var responseText = data.response || '(応答なし)';
            var usedModel = data.usedModel || lastModel;
            var isLocalCommand = usedModel === 'local/neko';
            var respUsage = extractRespUsage(data);
            if (!isLocalCommand) {
              showAichatSendToast(!data.fallbackUsed, MODEL_COLORS[usedModel]);
            }
            assistantBubbleEl = appendBubble(responseText, 'assistant', isLocalCommand ? null : lastModel, data.fallbackUsed, respUsage, undefined, isLocalCommand, data.nekoResults, data.svg, data.nekoCursorResults, data.shareId);
            if (attachedImage && data.shareId) pendingShareIdForMoondream = data.shareId;
            tryAppendMoondream();
            if (!isLocalCommand) {
              appendShareBtn(currentMsg, responseText, usedModel, data.shareId, data.userHash);
            }
            if (data.threadId) currentThreadId = data.threadId;
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
