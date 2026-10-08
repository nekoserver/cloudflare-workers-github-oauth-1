import { getThemeCSS, getThemeInitScript } from '../utils/theme';
import { getMarkdownParserScript, getMarkdownPreviewCSS } from '../utils/markdownRenderer';
import { TASKMINE_REDMINE_ORIGIN } from '../utils/taskmineRedmine';

/** TaskMineの主要操作をブラウザで再現。APIキーはメモリ内のみで保持する。 */
export function getTaskminePage(): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TaskMine · Redmine Workspace</title>
${getThemeInitScript()}<style>${getThemeCSS()}${getMarkdownPreviewCSS()}
*{box-sizing:border-box}body{margin:0;background:var(--bg-secondary);color:var(--text-primary);font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}button,input,select,textarea{font:inherit;color:var(--text-primary);background:var(--input-bg);border:1px solid var(--input-border);border-radius:9px;padding:9px 12px}button{cursor:pointer}button:hover{border-color:var(--accent-color)}button:disabled{opacity:.5;cursor:wait}a{color:var(--accent-color)}header{position:sticky;top:0;height:44px;z-index:10;background:var(--card-bg);border-bottom:1px solid var(--border-color);display:flex;align-items:center;padding:0 20px;gap:12px}header strong{margin-right:auto}.primary{background:var(--accent-color);color:var(--card-bg);font-weight:600}main{max-width:1320px;margin:28px auto;padding:0 24px}.hero{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px}h1{font-size:30px;line-height:1.25;margin:6px 0}h2{font-size:19px;margin:0 0 16px}h3{font-size:15px}.eyebrow,.muted,small{color:var(--text-secondary)}.eyebrow{letter-spacing:.13em;font-size:11px}.layout{display:grid;grid-template-columns:230px minmax(280px,1fr) minmax(300px,1.05fr);gap:18px;align-items:start}.panel{background:var(--card-bg);border:1px solid var(--border-color);border-radius:16px;padding:20px}.side button{width:100%;text-align:left;margin:3px 0}.side .active,.issue.active{border-color:var(--accent-color);background:var(--bg-secondary)}.filters{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.filters input{width:100%}.filters select{flex:1;min-width:100px}.issue{display:block;width:100%;text-align:left;background:var(--card-bg);padding:16px;margin:8px 0;border:1px solid var(--border-color);border-radius:12px}.issue strong{display:block;margin:5px 0}.meta{display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--text-secondary)}progress{width:100%;height:5px;accent-color:var(--accent-color)}.heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.badge{border-radius:20px;background:var(--bg-secondary);padding:3px 9px;font-size:12px}.description{white-space:pre-wrap;overflow-wrap:anywhere}.facts{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}.fact{background:var(--bg-secondary);border-radius:10px;padding:10px}.fact small{display:block}.history{border-left:2px solid var(--border-color);padding:0 0 12px 14px;margin-top:15px;overflow-wrap:anywhere}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}label{display:flex;flex-direction:column;gap:4px;font-size:12px}label.full{grid-column:1/-1}textarea{min-height:120px;resize:vertical}.actions{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}.empty{padding:38px 10px;text-align:center;color:var(--text-secondary)}#message{white-space:pre-wrap;background:var(--card-bg);border:1px solid var(--accent-color);padding:12px;border-radius:10px;margin-bottom:14px}#message:empty{display:none}details{margin-top:22px}summary{cursor:pointer}#connection{display:grid;gap:10px;margin-top:16px}footer{color:var(--text-secondary);font-size:12px;padding:24px 0}#preview{padding:12px;background:var(--bg-secondary);border-radius:10px}#preview:empty{display:none}[hidden]{display:none!important}#account{max-width:180px;padding:3px 8px}#theme{padding:3px 9px}#detail{min-height:330px;scroll-margin-top:60px}.pager{display:flex;justify-content:space-between;align-items:center;margin-top:16px}
@media(max-width:1050px){.layout{grid-template-columns:200px 1fr}#detail{grid-column:2}}@media(max-width:680px){main{padding:0 12px;margin-top:18px}.hero{align-items:flex-start;flex-wrap:wrap}.hero>.primary{white-space:nowrap}h1{font-size:25px}.layout{display:flex;flex-direction:column}.panel{width:100%;padding:16px}.side{order:0}.side #projects{display:flex;overflow:auto;gap:6px}.side button{width:auto;white-space:nowrap}.side h3{margin:10px 0}.form-grid{grid-template-columns:1fr}label.full{grid-column:auto}header{padding:0 12px}.facts{gap:8px}}
</style></head><body>
<header><strong>▣ TaskMine</strong><select id="account" aria-label="アカウント"><option value="demo">デモアカウント</option></select><button id="theme" aria-label="テーマ切替">◐</button></header>
<main><div class="hero"><div><div class="eyebrow">REDMINE WORKSPACE</div><h1>今日の仕事を、ひと目で。</h1><div class="muted" id="mode">デモモード · 接続せずに操作を試せます</div></div><button class="primary" id="newIssue">＋ 課題を作成</button></div>
<div id="message" role="status" aria-live="polite"></div>
<div class="layout"><aside class="panel side"><h2>ワークスペース</h2><button id="all" class="active">すべての課題</button><button id="mine">自分の担当課題</button><h3>プロジェクト</h3><div id="projects"></div>
<details id="settings"><summary>Redmineに接続</summary><form id="connection"><label>アカウント名<input id="serverName" maxlength="80" placeholder="仕事用 Redmine"></label><label>Redmine URL<input id="serverUrl" type="url" value="${TASKMINE_REDMINE_ORIGIN}" required></label><label>APIキー<input id="apiKey" type="password" autocomplete="off" required></label><button class="primary">接続・追加</button><small>${TASKMINE_REDMINE_ORIGIN} にWorker経由で接続します。REST APIを有効にしてください。APIキーは通信時だけWorkerへ渡し、保存しません。</small></form></details></aside>
<section class="panel"><div class="heading"><h2 id="listTitle">すべての課題</h2><button id="refresh" aria-label="再読み込み">↻</button></div><div class="filters"><input id="search" type="search" aria-label="課題を検索" placeholder="課題名・番号で検索"><select id="status" aria-label="ステータス"></select><select id="priority" aria-label="優先度"></select><select id="due" aria-label="期限"><option value="">すべての期限</option><option value="late">期限超過</option><option value="week">7日以内</option><option value="none">期限なし</option></select></div><small id="count"></small><div id="issues"></div><div class="pager"><button id="prev">前へ</button><small id="pageInfo"></small><button id="next">次へ</button></div></section>
<section class="panel" id="detail"><div class="empty">課題を選択すると、詳細と変更履歴を表示します。</div></section></div>
<footer>TaskMineの主要操作を再現した独立したWebページです。<a href="https://taskmine.megawave.app/" target="_blank" rel="noopener noreferrer">機能の参考：TaskMine公式サイト</a> · <a href="/">ホーム</a><br>iOSホーム画面ウィジェット・45言語へのUI翻訳は対象外です。Markdown表示に対応しています（Textile形式は原文表示）。</footer></main>
<script>
(function() {
  ${getMarkdownParserScript()}
  const $ = (id) => document.getElementById(id);
  const state = { accounts: [], account: null, project: "", mine: false, issues: [], projects: [], statuses: [], priorities: [], trackers: [], members: [], selected: null, offset: 0, total: 0, busy: false, generation: 0 };
  const demoStatuses = [{ id: 1, name: "新規" }, { id: 2, name: "進行中" }, { id: 3, name: "完了", is_closed: true }];
  const demoPriorities = [{ id: 1, name: "低" }, { id: 2, name: "通常" }, { id: 3, name: "高" }];
  const demoProjects = [{ id: 1, name: "プロダクト開発" }, { id: 2, name: "Webサイト改善" }];
  const demoIssues = [["ログイン画面のエラー表示を改善", 1, 2, 3, 60, 1], ["モバイルのナビゲーションを整理", 2, 1, 2, 0, 1], ["APIドキュメントを更新", 1, 2, 2, 30, 2], ["トップページの表示速度を改善", 2, 3, 1, 100, 2]].map((v, n) => ({ id: 104 + n, subject: v[0], project: demoProjects.find((p) => p.id === v[1]), status: demoStatuses.find((p) => p.id === v[2]), priority: demoPriorities.find((p) => p.id === v[3]), done_ratio: v[4], assigned_to: { id: v[5], name: v[5] === 1 ? "自分" : "佐藤" }, tracker: { id: 1, name: "タスク" }, due_date: new Date(Date.now() + (n - 1) * 864e5).toISOString().slice(0, 10), description: "現状の確認と改善を進めます。" + String.fromCharCode(10) + "受け入れ条件：モバイル端末でも快適に操作できること。", journals: [{ user: { name: "佐藤" }, created_on: "2026-10-01T09:00:00Z", notes: "対応内容を確認しました。", details: [] }], attachments: [] }));
  function message(s) {
    $("message").textContent = s;
  }
  function element(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== void 0)
      e.textContent = text;
    if (cls)
      e.className = cls;
    return e;
  }
  function options(id, items, first) {
    const s = $(id);
    s.replaceChildren();
    if (first !== void 0) {
      const o = element("option", first);
      o.value = "";
      s.append(o);
    }
    items.forEach((p) => {
      const o = element("option", p.name);
      o.value = String(p.id);
      s.append(o);
    });
  }
  function showDemo() {
    state.account = null;
    state.busy = false;
    state.generation++;
    message("");
    state.projects = demoProjects;
    state.statuses = demoStatuses;
    state.priorities = demoPriorities;
    state.trackers = [{ id: 1, name: "タスク" }];
    state.members = [{ id: 1, name: "自分" }, { id: 2, name: "佐藤" }];
    state.issues = demoIssues;
    state.offset = 0;
    state.total = demoIssues.length;
    state.selected = null;
    state.project = "";
    state.mine = false;
    $("mode").textContent = "デモモード · 接続せずに操作を試せます";
    setup();
    render();
  }
  function setup() {
    options("status", state.statuses, "全ステータス");
    options("priority", state.priorities, "全優先度");
    $("projects").replaceChildren();
    state.projects.forEach((p) => {
      const b = element("button", p.name);
      b.onclick = () => {
        state.project = p.id;
        state.mine = false;
        state.offset = 0;
        load();
      };
      $("projects").append(b);
    });
  }
  let queue = Promise.resolve(), lastRequest = 0;
  async function redmineRequest(account, path, method = "GET", body, raw = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      return await fetch("/api/taskmine/redmine", {
        method: "POST", credentials: "same-origin", signal: controller.signal,
        headers: {
          "X-Redmine-URL": account.url, "X-Redmine-API-Key": account.key,
          "X-Redmine-Path": path, "X-Redmine-Method": method,
          "Content-Type": raw ? "application/octet-stream" : "application/json"
        },
        body: body === undefined ? undefined : raw ? body : JSON.stringify(body)
      });
    } catch {
      throw new Error("このページとの通信に失敗しました。ネットワークを確認して再接続してください。");
    } finally {
      clearTimeout(timer);
    }
  }
  function api(account, path, method = "GET", body, raw = false) {
    const run = async () => {
      const wait = Math.max(0, 1000 - (Date.now() - lastRequest));
      if (wait) await new Promise(r => setTimeout(r, wait));
      lastRequest = Date.now();
      const response = await redmineRequest(account, path, method, body, raw);
      if (response.status === 204) return {};
      let data;
      try { data = await response.json(); }
      catch { throw new Error("接続先がJSONを返しませんでした。ページへのログイン状態とRedmineのURLを確認してください。"); }
      if (!response.ok) {
        throw new Error(data.error || "Redmine HTTP " + response.status + ": " + (data.errors || ["API設定を確認してください"]).join(" / "));
      }
      return data;
    };
    const result = queue.then(run);
    // The caller receives the original rejection; recover only the scheduling queue.
    queue = result.catch(() => {});
    return result;
  }
  async function collection(account, path, key) {
    let rows = [], offset = 0;
    while (true) {
      const data = await api(account, path + (path.includes("?") ? "&" : "?") + "limit=100&offset=" + offset);
      const page = data[key];
      if (!Array.isArray(page))
        throw new Error("Redmineのレスポンス形式が不正です: " + key);
      rows = rows.concat(page);
      offset += page.length;
      if (!page.length || offset >= (data.total_count ?? offset))
        return rows;
    }
  }
  function filtered() {
    const q = $("search").value.toLowerCase().trim(), today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    return state.issues.filter((i) => (!state.project || i.project.id === Number(state.project)) && (!state.mine || state.account || i.assigned_to?.id === 1) && (!$("status").value || i.status.id === Number($("status").value)) && (!$("priority").value || i.priority.id === Number($("priority").value)) && (!q || i.subject.toLowerCase().includes(q) || String(i.id) === q) && (!$("due").value || ($("due").value === "none" ? !i.due_date : $("due").value === "late" ? i.due_date && i.due_date < today : i.due_date && i.due_date >= today && i.due_date <= week)));
  }
  function render() {
    const items = filtered();
    $("issues").replaceChildren();
    $("listTitle").textContent = state.project ? state.projects.find((p) => p.id === Number(state.project))?.name : state.mine ? "自分の担当課題" : "すべての課題";
    $("all").classList.toggle("active", !state.project && !state.mine);
    $("mine").classList.toggle("active", state.mine);
    $("count").textContent = items.length + " 件表示 / " + state.total + " 件" + (state.account ? "（検索・期限は現在のページ内）" : "");
    items.forEach((i) => {
      const b = element("button", void 0, "issue" + (state.selected?.id === i.id ? " active" : ""));
      b.append(element("div", "#" + i.id + " · " + i.project.name, "meta"), element("strong", i.subject), element("div", i.status.name + " · " + i.priority.name + " · " + (i.assigned_to?.name || "未割当"), "meta"));
      const pr = element("progress");
      pr.max = 100;
      pr.value = i.done_ratio || 0;
      pr.setAttribute("aria-label", "進捗 " + pr.value + "%");
      b.append(pr, element("div", (i.due_date ? "期限 " + i.due_date : "期限なし") + " · " + (i.done_ratio || 0) + "%", "meta"));
      b.onclick = () => openIssue(i);
      $("issues").append(b);
    });
    if (!items.length)
      $("issues").append(element("div", "条件に一致する課題はありません。", "empty"));
    $("prev").disabled = !state.account || !state.offset || state.busy;
    $("next").disabled = !state.account || state.offset + 50 >= state.total || state.busy;
    $("pageInfo").textContent = state.account ? state.offset + 1 + "–" + Math.min(state.offset + 50, state.total) : "デモ";
  }
  async function load() {
    if (!state.account) {
      state.total = demoIssues.length;
      render();
      return;
    }
    const a = state.account, g = ++state.generation;
    state.busy = true;
    state.issues = [];
    state.total = 0;
    $("prev").disabled = true;
    $("next").disabled = true;
    $("issues").replaceChildren(element("div", "読み込み中…", "empty"));
    try {
      const p = new URLSearchParams({ limit: "50", offset: String(state.offset), status_id: $("status").value || "*", sort: "updated_on:desc" });
      if (state.project)
        p.set("project_id", state.project);
      if (state.mine)
        p.set("assigned_to_id", "me");
      if ($("priority").value)
        p.set("priority_id", $("priority").value);
      const d = await api(a, "issues.json?" + p);
      if (g !== state.generation)
        return;
      if (!Array.isArray(d.issues) || !Number.isInteger(d.total_count)) throw new Error("Redmineの課題一覧の形式が不正です。");
      state.issues = d.issues;
      state.total = d.total_count;
      message("");
    } catch (e) {
      if (g === state.generation)
        message(e.message);
    } finally {
      if (g === state.generation) {
        state.busy = false;
        render();
      }
    }
  }
  async function openIssue(i) {
    const a = state.account, g = state.generation, id = i.id;
    state.selected = i;
    render();
    $("detail").textContent = "詳細を読み込み中…";
    try {
      if (a)
        i = (await api(a, "issues/" + i.id + ".json?include=journals,attachments,allowed_statuses")).issue;
      if (g !== state.generation || state.selected?.id !== id)
        return;
      if (!i || !i.project || !i.status || !i.priority || !i.tracker) throw new Error("Redmineの課題詳細の形式が不正です。");
      state.selected = i;
      detail(i);
      if (window.innerWidth <= 680)
        $("detail").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      if (g === state.generation && state.selected?.id === id) {
        message(e.message);
        $("detail").textContent = "詳細を取得できませんでした。もう一度課題を選択してください。";
      }
    }
  }
  function detail(i) {
    const d = $("detail");
    d.replaceChildren();
    const top = element("div", void 0, "heading");
    top.append(element("span", "#" + i.id + " · " + i.tracker.name, "muted"));
    const edit = element("button", "編集");
    edit.id = "editIssue";
    edit.onclick = () => editor(i);
    top.append(edit);
    d.append(top, element("h2", i.subject));
    const facts = element("div", void 0, "facts");
    [["ステータス", i.status.name], ["優先度", i.priority.name], ["担当者", i.assigned_to?.name || "未割当"], ["期限", i.due_date || "未設定"], ["進捗", (i.done_ratio || 0) + "%"], ["プロジェクト", i.project.name]].forEach(([label, value]) => {
      const f = element("div", void 0, "fact");
      f.append(element("small", label), element("strong", value));
      facts.append(f);
    });
    const body = element("div", void 0, "preview-area");
    body.innerHTML = parseMd(i.description || "説明なし");
    d.append(facts, element("h3", "説明"), body);
    if (i.attachments?.length) {
      d.append(element("h3", "添付ファイル"));
      i.attachments.forEach((f) => {
        const row = element("div", f.filename + " · " + (f.filesize || 0) + " bytes");
        if (state.account) {
          const b = element("button", "ダウンロード");
          b.onclick = () => download(f);
          row.append(b);
        }
        d.append(row);
      });
    }
    d.append(element("h3", "変更履歴"));
    if (!i.journals?.length)
      d.append(element("div", "変更履歴はありません。", "muted"));
    (i.journals || []).forEach((j) => {
      const h = element("div", void 0, "history");
      h.append(element("small", (j.user?.name || "") + " · " + new Date(j.created_on).toLocaleString()), element("div", j.notes || "属性を更新", "description"));
      (j.details || []).forEach((v) => h.append(element("div", v.name + ": " + (v.old_value ?? "未設定") + " → " + (v.new_value ?? "未設定"), "muted")));
      d.append(h);
    });
  }
  async function download(file) {
    const a = state.account;
    try {
      const url = new URL(file.content_url);
      if (!a || url.origin !== new URL(a.url).origin)
        throw new Error("別のサーバーの添付URLは開けません。");
      const base = new URL(a.url + "/");
      if (!url.pathname.startsWith(base.pathname)) throw new Error("添付URLがRedmineのパスと一致しません。");
      const response = await redmineRequest(a, url.pathname.slice(base.pathname.length) + url.search);
      if (!response.ok)
        { const error = await response.json(); throw new Error(error.error || "添付ファイルを取得できません: HTTP " + response.status); }
      const href = URL.createObjectURL(await response.blob());
      const link = element("a");
      link.href = href;
      link.download = file.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1e3);
    } catch (e) {
      message(e.message);
    }
  }
  async function members(project) {
    if (!state.account)
      return;
    const a = state.account, form = $("editor");
    const rows = await collection(a, "projects/" + project + "/memberships.json", "memberships");
    if (a !== state.account || form !== $("editor") || !$("editProject") || $("editProject").value !== String(project))
      return;
    state.members = rows.map((m) => m.user || m.group).filter(Boolean);
    options("assignee", state.members, "未割当");
  }
  function editor(i) {
    const d = $("detail");
    d.innerHTML = "<h2>" + (i ? "課題を編集" : "新しい課題") + '</h2><form id="editor"><div class="form-grid"><label class="full">題名<input id="subject" required maxlength="255"></label><label>プロジェクト<select id="editProject" required></select></label><label>トラッカー<select id="tracker" required></select></label><label>ステータス<select id="editStatus"></select></label><label>優先度<select id="editPriority"></select></label><label>担当者<select id="assignee"></select></label><label>期限<input type="date" id="dueDate"></label><label>進捗（%）<input id="ratio" type="number" min="0" max="100" step="10"></label><label class="full">説明<textarea id="description"></textarea></label><label class="full">説明のプレビュー<div id="preview" class="preview-area"></div><small>Markdownをプレビューします。本文形式は接続先のRedmine設定に従います。</small></label><label class="full">コメント<textarea id="notes"></textarea></label><label class="full">添付ファイル<input type="file" id="files" multiple><small>デモではファイル名のみ記録します。</small></label></div><div class="actions"><button type="button" id="cancel">キャンセル</button><button class="primary" id="saveIssue">保存</button></div></form>';
    options("editProject", state.projects);
    options("tracker", state.trackers);
    options("editStatus", i?.allowed_statuses?.length ? i.allowed_statuses : state.statuses);
    options("editPriority", state.priorities);
    options("assignee", state.members, "未割当");
    if (i) {
      $("subject").value = i.subject;
      $("editProject").value = i.project.id;
      $("tracker").value = i.tracker.id;
      $("editStatus").value = i.status.id;
      $("editPriority").value = i.priority.id;
      $("dueDate").value = i.due_date || "";
      $("description").value = i.description || "";
      $("ratio").value = i.done_ratio || 0;
      const assigned = i.assigned_to;
      if (assigned && !state.members.some((m) => m.id === assigned.id)) {
        const o = element("option", assigned.name);
        o.value = assigned.id;
        $("assignee").append(o);
      }
      $("assignee").value = assigned?.id || "";
    } else {
      $("ratio").value = 0;
      if (state.project)
        $("editProject").value = state.project;
    }
    $("preview").innerHTML = parseMd($("description").value);
    $("description").oninput = () => {
      $("preview").innerHTML = parseMd($("description").value);
    };
    $("editProject").onchange = () => members($("editProject").value).catch((e) => message(e.message));
    $("cancel").onclick = () => {
      if (state.selected)
        detail(state.selected);
      else
        d.replaceChildren(element("div", "課題を選択してください。", "empty"));
    };
    $("editor").onsubmit = (e) => {
      e.preventDefault();
      save(i);
    };
    if (state.account)
      members($("editProject").value).then(() => {
        if ($("assignee"))
          $("assignee").value = i?.assigned_to?.id || "";
      }).catch((e) => message(e.message));
  }
  async function save(existing) {
    const a = state.account, g = state.generation;
    const fields = { project_id: Number($("editProject").value), tracker_id: Number($("tracker").value), subject: $("subject").value.trim(), status_id: Number($("editStatus").value), priority_id: Number($("editPriority").value), assigned_to_id: $("assignee").value ? Number($("assignee").value) : "", due_date: $("dueDate").value, description: $("description").value, done_ratio: Number($("ratio").value), notes: $("notes").value };
    if (!fields.subject) {
      message("題名を入力してください。");
      return;
    }
    const files = Array.from($("files").files);
    $("saveIssue").disabled = true;
    try {
      if (a) {
        const uploads = [];
        for (const f of files) {
          const result = await api(a, "uploads.json?filename=" + encodeURIComponent(f.name), "POST", f, true);
          uploads.push({ token: result.upload.token, filename: f.name, content_type: f.type || "application/octet-stream" });
        }
        if (uploads.length)
          fields.uploads = uploads;
        const r = await api(a, existing ? "issues/" + existing.id + ".json" : "issues.json", existing ? "PUT" : "POST", { issue: fields });
        if (a !== state.account || g !== state.generation)
          return;
        const id = existing ? existing.id : r.issue.id;
        state.selected = null;
        await load();
        await openIssue({ id });
        message("課題を保存しました。");
      } else {
        const issue = { id: existing?.id || Math.max(...demoIssues.map((i) => i.id)) + 1, subject: fields.subject, project: state.projects.find((p) => p.id === fields.project_id), tracker: state.trackers.find((p) => p.id === fields.tracker_id), status: state.statuses.find((p) => p.id === fields.status_id), priority: state.priorities.find((p) => p.id === fields.priority_id), assigned_to: state.members.find((p) => p.id === fields.assigned_to_id), due_date: fields.due_date, done_ratio: fields.done_ratio, description: fields.description, journals: [...existing?.journals || [], { user: { name: "自分" }, created_on: (/* @__PURE__ */ new Date()).toISOString(), notes: fields.notes || (existing ? "課題を更新しました。" : "課題を作成しました。"), details: existing ? [{ name: "status", old_value: existing.status.name, new_value: state.statuses.find((p) => p.id === fields.status_id).name }] : [] }], attachments: [...existing?.attachments || [], ...files.map((f) => ({ filename: f.name, filesize: f.size }))] };
        if (existing)
          demoIssues.splice(demoIssues.findIndex((i) => i.id === existing.id), 1, issue);
        else
          demoIssues.unshift(issue);
        state.selected = issue;
        state.total = demoIssues.length;
        render();
        detail(issue);
        message("デモの課題を保存しました（再読み込みするとリセットされます）。");
      }
    } catch (e) {
      message(e.message);
    } finally {
      if ($("saveIssue"))
        $("saveIssue").disabled = false;
    }
  }
  $("connection").onsubmit = async (e) => {
    e.preventDefault();
    const button = $("connection").querySelector("button");
    button.disabled = true;
    try {
      const url = new URL($("serverUrl").value);
      if (url.origin !== "${TASKMINE_REDMINE_ORIGIN}" || url.username || url.password || url.search || url.hash)
        throw new Error("接続先は ${TASKMINE_REDMINE_ORIGIN} のHTTPS URLを入力してください。");
      let base = url.href;
      while (base.endsWith("/"))
        base = base.slice(0, -1);
      const a = { id: String(Date.now()), name: $("serverName").value.trim() || url.hostname, url: base, key: $("apiKey").value.trim() };
      if (!a.key)
        throw new Error("APIキーを入力してください。");
      message("接続情報を確認中…");
      a.user = (await api(a, "users/current.json")).user;
      if (!a.user || !Number.isInteger(a.user.id)) throw new Error("APIキーでRedmineのユーザー情報を取得できませんでした。REST API設定を確認してください。");
      a.projects = await collection(a, "projects.json", "projects");
      a.statuses = (await api(a, "issue_statuses.json")).issue_statuses;
      a.priorities = (await api(a, "enumerations/issue_priorities.json")).issue_priorities;
      a.trackers = (await api(a, "trackers.json")).trackers;
      if (!a.projects.length)
        throw new Error("閲覧できるプロジェクトがありません。");
      state.accounts.push(a);
      const o = element("option", a.name);
      o.value = a.id;
      $("account").append(o);
      $("account").value = a.id;
      $("apiKey").value = "";
      await activate(a);
      $("settings").open = false;
    } catch (e2) {
      message(e2.message);
    } finally {
      button.disabled = false;
    }
  };
  async function activate(a) {
    state.account = a;
    state.busy = false;
    state.generation++;
    state.selected = null;
    state.project = "";
    state.mine = false;
    state.offset = 0;
    state.issues = [];
    state.total = 0;
    state.members = [];
    state.projects = a.projects;
    state.statuses = a.statuses;
    state.priorities = a.priorities;
    state.trackers = a.trackers;
    $("detail").textContent = "課題を選択してください。";
    $("mode").textContent = a.name + " · " + a.url;
    setup();
    await load();
  }
  $("account").onchange = () => {
    if ($("account").value === "demo") {
      showDemo();
      $("detail").textContent = "課題を選択してください。";
    } else
      activate(state.accounts.find((a) => a.id === $("account").value));
  };
  $("all").onclick = () => {
    state.project = "";
    state.mine = false;
    state.offset = 0;
    load();
  };
  $("mine").onclick = () => {
    state.project = "";
    state.mine = true;
    state.offset = 0;
    load();
  };
  $("search").oninput = render;
  $("due").onchange = render;
  ["status", "priority"].forEach((id) => $(id).onchange = () => {
    state.offset = 0;
    load();
  });
  $("newIssue").onclick = () => {
    editor(null);
    if (window.innerWidth <= 680)
      $("detail").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  $("refresh").onclick = load;
  $("prev").onclick = () => {
    state.offset = Math.max(0, state.offset - 50);
    load();
  };
  $("next").onclick = () => {
    state.offset += 50;
    load();
  };
  $("theme").onclick = () => {
    const html = document.documentElement;
    const theme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", theme);
    document.cookie = "user_theme=" + theme + "; path=/; max-age=31536000; SameSite=Lax";
  };
  showDemo();
})();
</script></body></html>`;
}
