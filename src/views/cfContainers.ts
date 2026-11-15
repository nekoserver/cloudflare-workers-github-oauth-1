/**
 * /cf-containers（Cloudflare Containersのデモ用管理ページ、管理者限定）の
 * HTML。コンテナの状態参照・起動/停止/再起動・プロキシへの導線を持つ。
 */
import { CONFIGURED_INSTANCE_TYPE, CONFIGURED_INSTANCE_SPEC, computeHourlyRate } from '../utils/cfContainerCost';
import { APACHE_MANUAL_BASE } from '../data/apacheManual';

export function getCfContainersPage(): string {
  const instancePrices = [
    { name: CONFIGURED_INSTANCE_TYPE, spec: CONFIGURED_INSTANCE_SPEC },
    { name: 'standard-2', spec: { vcpu: 1, memoryGiB: 6, diskGB: 12 } },
  ].map(({ name, spec }) => {
    const rate = computeHourlyRate(spec);
    const selected = name === CONFIGURED_INSTANCE_TYPE;
    return `<tr data-applied="${selected}" ${selected ? '' : 'hidden'}>
      <th scope="row"><span class="instance-model" data-selected="${selected}">${name}</span>${selected ? '（選択中）' : ''}</th>
      <td>${spec.vcpu} vCPU<br>$${rate.vcpuUsdPerHour.toFixed(5)}</td>
      <td>${spec.memoryGiB} GiB<br>$${rate.memoryUsdPerHour.toFixed(5)}</td>
      <td>${spec.diskGB} GB<br>$${rate.diskUsdPerHour.toFixed(5)}</td>
      <td>$${rate.totalUsdPerHour.toFixed(5)}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cloudflare Containers（デモ）</title>
<style>
:root {
  --bg: #f6f8fa; --surface: #fff; --border: #d0d7de;
  --text: #1f2328; --muted: #656d76; --link: #0969da;
  --accent: #0969da; --accent-bg: #ddf4ff;
  --ok: #1a7f37; --ok-bg: #dafbe1;
  --err: #cf222e; --err-bg: #ffebe9;
  --warn: #9a6700; --warn-bg: #fff8c5;
  --radius: 8px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --muted: #8b949e; --link: #58a6ff;
    --accent: #58a6ff; --accent-bg: #0c2d6b;
    --ok: #3fb950; --ok-bg: #0f2b18;
    --err: #f85149; --err-bg: #300a0a;
    --warn: #e3b341; --warn-bg: #2d1f00;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, sans-serif; padding: 12px; max-width: 1040px; margin: 0 auto; }
.page-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 16px; align-items: start; }
.section-sidebar { position: sticky; top: 12px; max-height: calc(100dvh - 24px); overflow-y: auto; }
.section-sidebar summary { cursor: pointer; font-weight: 600; padding: 8px 12px; }
.section-sidebar details { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
.section-sidebar a { display: flex; align-items: center; min-height: 44px; padding: 8px 12px; color: var(--link); text-decoration: none; }
.section-sidebar a:hover, .section-sidebar a:focus-visible { background: var(--accent-bg); }
/* リンクには下線を付けない(マウスを乗せたときも)。ユーザー指定 2026-11-15 */
a, a:hover, a:focus-visible { text-decoration: none; }
main { min-width: 0; }
main details[data-section] { scroll-margin-top: 12px; }
main details[data-section]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 700px) {
  .page-layout { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .section-sidebar { position: static; max-height: none; }
}
/* コンテナの状態の帯(ページ最上部と左サイドパネルの最上位)。色はCSS変数だけを使う。 */
.status-banner, .sidebar-status {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px;
  min-height: 44px; padding: 8px 12px; margin-bottom: 8px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
}
.status-label { font-weight: 700; font-size: 16px; }
.status-detail { color: var(--muted); font-size: 13px; }
[data-kind="loading"] .status-label, [data-kind="unknown"] .status-label { color: var(--muted); }
[data-kind="building"] .status-label { color: var(--err); animation: status-blink 1s steps(2, start) infinite; }
[data-kind="building"] .status-detail { color: var(--err); }
[data-kind="standby"] .status-label { color: var(--ok); background: var(--ok-bg); border: 1px solid var(--ok); border-radius: 999px; padding: 2px 12px; }
[data-kind="stopped"] .status-label { color: var(--muted); background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 2px 12px; }
[data-kind="build_failed"] .status-label { color: var(--err); background: var(--err-bg); border: 1px solid var(--err); border-radius: 999px; padding: 2px 12px; }
[data-kind="build_failed"] .status-detail { color: var(--err); }
@keyframes status-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) {
  [data-kind="building"] .status-label { animation: none; }
}
.sidebar-status { margin-bottom: 8px; }
h1 { font-size: 20px; margin-bottom: 4px; }
.subtitle { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
.notice {
  background: var(--warn-bg); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 8px 12px; margin-bottom: 8px; font-size: 13px; line-height: 1.5; color: var(--text);
}
.card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 8px 12px; margin-bottom: 8px;
}
.status-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;
  background: var(--accent-bg); color: var(--accent);
}
.chip[data-running="true"] { background: var(--ok-bg); color: var(--ok); }
.chip[data-running="false"] { background: var(--border); color: var(--muted); }
button {
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
  border-radius: var(--radius); padding: 7px 14px; font-size: 13px; cursor: pointer; margin-right: 8px;
}
button:hover { background: var(--bg); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
#log { margin-top: 6px; font-size: 12px; color: var(--muted); white-space: pre-wrap; }
details.card > summary { cursor: pointer; font-weight: 600; color: var(--text); padding: 2px 0; }
details.card[open] > summary { margin-bottom: 6px; }
/* 前回表示時との差分: 増えた・変わった=黄、同じ=淡色 */
.diff-up { color: var(--warn); font-weight: 600; }
.diff-ok { color: var(--ok); font-weight: 600; }
.module-active { color: var(--ok); font-weight: 600; }
.module-inactive { color: var(--muted); }
.module-unlocked td:not(.module-active):not(.module-first) { opacity: 0.45; }
/* グレーアウト中も緑の表記は薄くせず、モジュール名は通常の文字色(ダークテーマでは白)にする。ユーザー指定 2026-11-15 */
.module-unlocked .module-lock-cell { opacity: 0.45; }
.module-unlocked .module-name.module-inactive { color: var(--text); }
button.module-name { background: none; border: 0; padding: 0; margin: 0; font: inherit; cursor: pointer; text-decoration: none; }
.apache-module-panel { width: min(640px, 100%); max-height: calc(100dvh - 80px); overflow-y: auto; }
.apache-module-panel h4 { font-size: 13px; margin: 10px 0 4px; }
.apache-module-panel dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 2px 10px; font-size: 12px; }
.apache-module-panel dt { color: var(--muted); }
.apache-directives { width: 100%; border-collapse: collapse; font-size: 12px; }
.apache-directives th, .apache-directives td { border-top: 1px solid var(--border); padding: 3px 4px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
.apache-directives code { font-size: 11px; }
.apache-help-link { display: inline-block; margin: 8px 0 2px; color: var(--link); }
.apache-help-panel { width: min(960px, 100%); height: calc(100dvh - 80px); display: flex; flex-direction: column; gap: 6px; }
.apache-help-panel iframe { flex: 1; width: 100%; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
.module-toggle, .module-lock { padding: 0 6px; margin-right: 6px; font-size: 12px; }
.module-check { margin: 0 6px 0 0; vertical-align: middle; }
.apache-main-row td { font-weight: 600; }
.menu-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px 0; font-size: 13px; }
.menu-toggle { padding: 0 8px; font-size: 12px; }
.menu-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: flex-start; justify-content: center; padding: 16px; }
.menu-modal[hidden] { display: none; }
.menu-panel { background: var(--card-bg, var(--surface)); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; width: min(420px, 100%); margin-top: 40px; }

.diff-same { color: var(--muted); }
details.sub > summary { cursor: pointer; font-weight: 600; color: var(--text); margin: 6px 0 4px; }
a.proxy-link { color: var(--link); font-size: 13px; }
table.health-table, table.tunnel-table { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 10px; }
table.health-table th, table.health-table td, table.tunnel-table th, table.tunnel-table td {
  border: 1px solid var(--border); padding: 6px 10px; text-align: left;
}
.instance-model[data-selected="true"] { color: var(--ok); font-weight: 700; }
.pricing-scroll { overflow-x: auto; }
.pricing-table { min-width: 540px; }
.badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.badge[data-ok="true"] { background: var(--ok-bg); color: var(--ok); }
.badge[data-ok="false"] { background: var(--err-bg); color: var(--err); }
.badge[data-level="ok"] { background: var(--ok-bg); color: var(--ok); }
.badge[data-level="warn"] { background: var(--warn-bg); color: var(--warn); }
.badge[data-level="ng"] { background: var(--err-bg); color: var(--err); }
</style>
</head>
<body>
<div class="page-layout">
<aside class="section-sidebar" aria-label="セクション移動">
  <div id="sidebar-status" class="sidebar-status" data-kind="loading" role="status" aria-live="polite">
    <span class="status-label">確認中…</span><span class="status-detail"></span>
  </div>
  <details open>
    <summary>ページ内メニュー</summary>
    <a href="/cf-containers/planner">コンテナ構成プランナー</a>
    <nav aria-label="コンテナ管理の各セクション">
      <div class="menu-row"><a href="#section-secrets">トークン設定</a><button type="button" class="menu-toggle" data-section="secrets" aria-expanded="false" aria-label="トークン設定 の設定状況">&#9660;</button></div>
      <div class="menu-row"><a href="#section-authorized-keys">SSH公開鍵の追加</a><button type="button" class="menu-toggle" data-section="authorized-keys" aria-expanded="false" aria-label="SSH公開鍵の追加 の設定状況">&#9660;</button></div>
      <div class="menu-row"><a href="#section-control">コンテナの操作</a><button type="button" class="menu-toggle" data-section="control" aria-expanded="false" aria-label="コンテナの操作 の設定状況">&#9660;</button></div>
      <div class="menu-row"><a href="#section-pricing">単価表</a><button type="button" class="menu-toggle" data-section="pricing" aria-expanded="false" aria-label="単価表 の設定状況">&#9660;</button></div>
      <div class="menu-row"><a href="#section-links">リンク・プロキシ</a><button type="button" class="menu-toggle" data-section="links" aria-expanded="false" aria-label="リンク・プロキシ の設定状況">&#9660;</button></div>
      <div class="menu-row"><a href="#section-health">ヘルスチェック</a><button type="button" class="menu-toggle" data-section="health" aria-expanded="false" aria-label="ヘルスチェック の設定状況">&#9660;</button></div>
      <div class="menu-row"><a href="#section-t3">T3・Codex・Tailscale</a><button type="button" class="menu-toggle" data-section="t3" aria-expanded="false" aria-label="T3・Codex・Tailscale の設定状況">&#9660;</button></div>
      <div class="menu-row"><a href="#section-report">6時間レポート</a><button type="button" class="menu-toggle" data-section="report" aria-expanded="false" aria-label="6時間レポート の設定状況">&#9660;</button></div>
      <div class="menu-row"><a href="#section-net">ネットワーク情報</a><button type="button" class="menu-toggle" data-section="net" aria-expanded="false" aria-label="ネットワーク情報 の設定状況">&#9660;</button></div>
      <div class="menu-row"><a href="#section-buildlog">本番ビルドのログ</a><button type="button" class="menu-toggle" data-section="buildlog" aria-expanded="false" aria-label="本番ビルドのログ の設定状況">&#9660;</button></div>
      <div class="menu-row"><a href="#section-container-list">Container一覧</a><button type="button" class="menu-toggle" data-section="container-list" aria-expanded="false" aria-label="Container一覧 の設定状況">&#9660;</button></div>
      <div class="menu-row"><a href="#section-tunnels">Tunnel一覧</a><button type="button" class="menu-toggle" data-section="tunnels" aria-expanded="false" aria-label="Tunnel一覧 の設定状況">&#9660;</button></div>
    </nav>
  </details>
</aside>
<main>
<div id="status-banner" class="status-banner" data-kind="loading" role="status" aria-live="polite">
  <span class="status-label">確認中…</span><span class="status-detail">コンテナの状態を確認しています</span>
</div>
<p><a href="/container-monitor">全コンテナ・Tailscale監視</a></p>
<h1>Cloudflare Containers（デモ）</h1>
<p class="subtitle">Durable Objects上で動くコンテナの起動・停止・状態確認・プロキシのデモページ。</p>
<div class="notice">
  自動停止はしません(停止ボタンで止めるまで動き続け、課金も続きます)。単価・累計接続時間・予定支出は下の表を参照してください。
</div>
  </details>
<details class="card" id="section-secrets" tabindex="-1" data-section="secrets">
  <summary>トークン設定（CLI不要）</summary>
  <p class="subtitle" style="margin:0 0 6px;">CF API・nekorootトンネル・Tailscaleのトークンを設定・更新できます。CF APIトークンは期限切れでも、新しいトークンを入力して更新できます。新しいCF APIトークンには対象アカウントのWorkers Scripts:Edit、Cloudflare Tunnel:Read、Containers:Read権限が必要です。保存後、コンテナを再起動して反映します。</p>
  <div class="status-row">
    <label for="secret-name" style="font-size:13px;">対象:</label>
    <select id="secret-name">
      <option value="NEKOROOT_TUNNEL_TOKEN">NEKOROOT_TUNNEL_TOKEN（nekorootトンネル）</option>
      <option value="TAILSCALE_AUTHKEY">TAILSCALE_AUTHKEY（Tailscale）</option>
      <option value="TAILSCALE_LOGIN_SERVER">TAILSCALE_LOGIN_SERVER（Tailscale管理サーバーURL・https）</option>
      <option value="CF_CONTAINER_API_TOKEN">CF_CONTAINER_API_TOKEN（コンテナ内cfコマンド）</option>
      <option value="CONTAINER_GH_TOKEN">CONTAINER_GH_TOKEN（コンテナ内gh・git push）</option>
      <option value="SSH_HOST_ED25519_KEY_B64">SSH_HOST_ED25519_KEY_B64（sshのホスト秘密鍵・base64）</option>
      <option value="SSH_AUTHORIZED_KEYS">SSH_AUTHORIZED_KEYS（追加の公開鍵・;区切り）</option>
    </select>
  </div>
  <input id="secret-value" type="password" placeholder="トークンを貼り付け" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);margin-bottom:8px;" />
  <button id="btn-set-secret" type="button">保存・更新して再起動</button>
  <div id="secret-log" style="margin-top:6px;font-size:12px;color:var(--muted);"></div>
</details>
<details class="card" id="section-authorized-keys" tabindex="-1" data-section="authorized-keys">
  <summary>SSH公開鍵の追加（authorized_keys）</summary>
  <textarea id="authorized-key-input" rows="2" placeholder="ssh-ed25519 AAAA... comment" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-family:monospace;font-size:12px;"></textarea>
  <input id="authorized-key-hmac" type="password" autocomplete="off" placeholder="HMACシークレット" style="width:100%;padding:8px;margin-top:6px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);">
  <button id="btn-add-authorized-key" type="button" style="margin-top:6px;">追加</button>
  <div id="authorized-key-log" style="margin-top:6px;font-size:12px;color:var(--muted);"></div>
</details>
<details class="card" id="section-control" tabindex="-1" data-section="control" open>
  <summary>コンテナの操作（起動・停止・状態）</summary>
  <div class="status-row">
    <span id="status-chip" class="chip" data-running="false">状態取得中…</span>
    <button id="btn-refresh" type="button">状態を再取得</button>
  </div>
  <div id="live-clock" style="font-size:18px;font-weight:600;margin-bottom:4px;" hidden>00:00:00</div>
  <details class="sub" id="section-pricing" tabindex="-1" data-section="pricing">
  <summary>Cloudflare Containers 単価表（USD/時間）<button type="button" id="pricing-mode" aria-pressed="false" style="margin-left:8px;font-size:12px;">適用中のみ表示</button></summary>
  <div class="pricing-scroll">
    <table class="health-table pricing-table" style="margin-bottom:10px;">
      <thead><tr><th scope="col">モデル</th><th scope="col">vCPU</th><th scope="col">メモリ</th><th scope="col">ディスク</th><th scope="col">合計</th></tr></thead>
      <tbody>${instancePrices}</tbody>
    </table>
  </div>
  <p class="subtitle">無料枠未考慮・CPUを上限まで使用した場合の目安。CPUは実使用量、メモリ・ディスクは確保量で課金されます。通信・Workers・Durable Objects等の料金は別途。<a class="proxy-link" href="https://developers.cloudflare.com/containers/platform/pricing/" target="_blank" rel="noreferrer">公式料金</a></p>
  </details>
  <div id="cost-summary" style="font-size:13px;"></div>
  <div id="cost-diff" style="font-size:12px;"></div>
  <button id="btn-start" type="button">起動</button>
  <button id="btn-stop" type="button">停止</button>
  <button id="btn-restart" type="button">再起動</button>
  <div id="log"></div>
  <div id="usage-summary" style="margin-top:10px;font-size:12px;color:var(--muted);"></div>
  <div id="ssh-box" style="margin-top:10px;font-size:12px;" hidden>
    <strong>SSH接続:</strong>
    <code id="ssh-command" style="display:block;margin-top:4px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;word-break:break-all;"></code>
    <button id="btn-copy-ssh" type="button" style="margin-top:6px;">コマンドをコピー</button>
  </div>
</details>
<details class="card" id="section-links" tabindex="-1" data-section="links">
  <summary>リンク（Docker コマンドセンター・プロキシ）</summary>
  <p><a class="proxy-link" href="/cf-containers/docker.html" target="_blank" rel="noreferrer">Docker コマンドセンターを開く（管理者認証で接続）</a></p>
  <p><a class="proxy-link" href="/cf-containers/proxy/" target="_blank" rel="noreferrer">プロキシ経由でコンテナのレスポンスを開く(新しいタブ)</a></p>
</details>
<details class="card" id="section-health" tabindex="-1" data-section="health" open>
  <summary>ヘルスチェック</summary>
  <div class="status-row">
    <button id="btn-health" type="button">コンテナ内部の状態を確認</button>
  </div>
  <div class="pricing-scroll">
  <table class="health-table" id="health-table" hidden>
    <thead><tr><th>Apache(8443)</th><th>sshd(2222)</th><th>cloudflared(nekoroot)</th><th>Tailscale</th><th>Docker</th><th>確認時刻</th></tr></thead>
    <tbody><tr>
      <td id="health-apache"></td><td id="health-sshd"></td><td id="health-cloudflared"></td><td id="health-tailscale"></td><td id="health-docker"></td><td id="health-time"></td>
    </tr></tbody>
  </table>
  </div>
  <div class="pricing-scroll">
  <p class="subtitle" style="margin:6px 0 4px;">Apacheモジュール（導入済みファイルとapache2ctl -Mのロード状態。版はApache本体の版）</p>
  <table class="health-table" id="apache-modules-table" hidden>
    <thead><tr><th>モジュール</th><th>Apache版</th><th>導入</th><th>ロード状態</th></tr></thead>
    <tbody id="apache-modules-tbody"></tbody>
  </table>
  <div id="apache-modules-error" class="module-inactive" style="font-size:12px;margin-top:4px;"></div>
  <div id="apache-module-modal" class="menu-modal" hidden>
    <div class="menu-panel apache-module-panel" role="dialog" aria-modal="true" aria-labelledby="apache-module-title">
      <div class="status-row"><strong id="apache-module-title"></strong><button type="button" id="apache-module-close">閉じる</button></div>
      <div id="apache-module-body" style="font-size:13px;margin-top:6px;"></div>
    </div>
  </div>
  <div id="apache-help-modal" class="menu-modal" hidden>
    <div class="menu-panel apache-help-panel" role="dialog" aria-modal="true" aria-labelledby="apache-help-title">
      <div class="status-row"><strong id="apache-help-title"></strong><button type="button" id="apache-help-close">閉じる</button></div>
      <iframe id="apache-help-frame" src="about:blank" title="Apacheモジュールのヘルプ" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe>
    </div>
  </div>
  <!-- /apache-module-modals -->
  </div>
  <div id="image-build" style="font-size:12px;margin-bottom:6px;" hidden></div>
  <div class="pricing-scroll">
  <table class="health-table" id="version-table" hidden>
    <thead><tr><th>デーモン・CLI</th><th>実際の版</th><th>前回の版</th><th>想定の版</th><th>判定</th><th>今の版のリリース日</th><th>配布元の最新(リリース日)</th></tr></thead>
    <tbody id="version-tbody"></tbody>
  </table>
  </div>
  <div class="pricing-scroll">
  <p class="subtitle" style="margin:6px 0 4px;">ネットワーク・CLIツール（apt導入状況。最新版はコンテナ内のapt-cache候補版、6時間ごとに更新）</p>
  <table class="health-table" id="apt-table" hidden>
    <thead><tr><th>コマンド</th><th>パッケージ</th><th>実際の版</th><th>最新(apt候補)</th><th>判定</th></tr></thead>
    <tbody id="apt-tbody"></tbody>
  </table>
  </div>
  <p style="font-size:12px;color:var(--muted);">OpenSSL・OpenSSHは上流の最新版と比較します。Ubuntuによる修正のバックポート状況は、この比較では判定しません。</p>
  <div id="version-status-log" style="margin-top:6px;font-size:12px;color:var(--muted);">ページ表示時に最新版・導入状況をD1へ記録します。</div>
  <div id="health-log" style="margin-top:6px;font-size:12px;color:var(--muted);"></div>
</details>
<details class="card" id="section-report" tabindex="-1" data-section="report">
  <summary>6時間レポート(Slack通知)</summary>
  <label style="font-size:13px;display:flex;align-items:center;gap:6px;">
    <input type="checkbox" id="report-slack-toggle" disabled />
    6時間ごとのレポート(稼働数・支出・版の新旧)をSlackに送る
  </label>
  <div id="report-slack-log" style="margin-top:4px;font-size:12px;color:var(--muted);">OFFでもD1への記録は続けます。</div>
</details>
<details class="card" id="section-net" tabindex="-1" data-section="net">
  <summary>コンテナのネットワーク情報(IPアドレス・CIDR)</summary>
  <div class="status-row">
    <button id="btn-net" type="button">ip addr / ip route を取得</button>
  </div>
  <pre id="net-log" style="margin-top:6px;font-size:12px;white-space:pre-wrap;"></pre>
  <button id="btn-tailscale-peers" type="button" style="margin-top:8px;">Tailscaleの接続経路を取得</button>
  <pre id="tailscale-peers-log" style="margin-top:6px;font-size:12px;white-space:pre-wrap;"></pre>
</details>
<details class="card" id="section-t3" tabindex="-1" data-section="t3" open>
  <summary>T3 Code・Codex・Tailscale の状態</summary>
  <p class="subtitle" style="margin:0 0 4px;">好ましい状態(総合判定が「準備完了」になる条件):</p>
  <ul class="subtitle" style="margin:0 0 8px;padding-left:20px;">
    <li>T3本体が 127.0.0.1:3773 だけで待ち受け、HTTPが正常に返る(<code>/.well-known/t3/environment</code>)</li>
    <li>埋め込み用の中継が 127.0.0.1:3774 だけで待ち受け、frame-ancestors 付きでHTTPが正常に返る</li>
    <li>codex コマンドが入っていて、<code>codex login status</code> がサインイン済みを返す(T3はこの結果を見ている。手でサインインしても、T3が見る HOME と同じでなければ反映されない)</li>
    <li><code>~/.codex/auth.json</code> がある(権限は 600)</li>
    <li>Tailscale が Running で、このコンテナのノードと相手が見える</li>
  </ul>
  <div class="status-row">
    <button id="btn-t3-health" type="button">T3・Codex・Tailscale の状態を確認</button>
    <button id="btn-t3-login" type="button">T3にログイン(トークン入力なし)</button>
  </div>
  <p style="font-size:12px;margin:4px 0;">新しいタブでT3が開き、このブラウザがログイン済みになります。その後はtree-viewのT3もそのまま使えます。PWAには、PWAに出る承認リンクをこのブラウザで開いて承認すると引き継がれます。</p>
  <div id="t3-verdict" style="margin:8px 0;font-size:13px;" hidden></div>
  <div class="pricing-scroll">
  <table class="health-table" id="t3-table" hidden>
    <thead><tr><th>項目</th><th>結果</th><th>詳細</th></tr></thead>
    <tbody id="t3-tbody"></tbody>
  </table>
  </div>
  <pre id="t3-log" style="margin-top:6px;font-size:12px;white-space:pre-wrap;"></pre>
</details>
<details class="card" id="section-buildlog" tabindex="-1" data-section="buildlog">
  <summary>本番ビルド(Workers Builds)のログ</summary>
  <div class="status-row">
    <button id="btn-buildlog" type="button">最新ビルドのログを取得</button>
  </div>
  <pre id="buildlog-log" style="margin-top:6px;font-size:12px;white-space:pre-wrap;max-height:480px;overflow:auto;"></pre>
</details>
<details class="card" id="section-container-list" tabindex="-1" data-section="container-list">
  <summary>作成日ごとのContainer一覧（wrangler containers list）</summary>
  <p class="subtitle">デモコンテナ内で読み取り専用の一覧コマンドを実行します。Cloudflare APIトークンにはContainers Read権限が必要です。</p>
  <div class="status-row">
    <button id="btn-container-list" type="button">一覧を更新</button>
  </div>
  <div id="container-list-groups" aria-live="polite"></div>
  <pre id="container-list-output" style="margin-top:6px;font-size:12px;white-space:pre;max-height:480px;overflow:auto;" aria-live="polite">未実行</pre>
</details>
<details class="card" id="section-tunnels" tabindex="-1" data-section="tunnels">
  <summary>Cloudflare Tunnel一覧</summary>
  <div class="status-row">
    <button id="btn-tunnels" type="button">取得</button>
  </div>
  <table class="tunnel-table" id="tunnel-table" hidden>
    <thead><tr><th>name</th><th>status</th><th>connections</th><th>id</th></tr></thead>
    <tbody id="tunnel-tbody"></tbody>
  </table>
  <div id="tunnel-log" style="margin-top:6px;font-size:12px;color:var(--muted);"></div>
</details>
<div id="menu-modal" class="menu-modal" hidden>
  <div class="menu-panel" role="dialog" aria-modal="true" aria-labelledby="menu-title">
    <div class="status-row"><strong id="menu-title"></strong></div>
    <div id="menu-body" style="font-size:13px;margin:6px 0;"></div>
    <div class="status-row">
      <button type="button" id="menu-change">変更する</button>
      <button type="button" id="menu-close">閉じる</button>
    </div>
  </div>
</main>
</div>
<script>
  // 前回のヘルスチェック時の記録(D1のcf_container_snapshots)。開いた時点で読み、比較元として固定する。
  // ヘルスチェックのたびに今回の値をD1へ記録する(差分はcf_container_snapshot_diffsに残る)。
  var prevSnapshot = null;
  var prevSnapshotLoaded = false;
  var currentSnapshot = {};
  var onPrevSnapshotLoaded = [];
  fetch('/api/cf-containers/snapshot/latest')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var r = data && data.snapshot;
      if (data && data.error) console.error('[cf-containers] 前回の記録の取得に失敗', data.error);
      prevSnapshot = r ? {
        savedAt: r.createdAt,
        cost: r.connectedSeconds === null ? null : { cumulativeConnectedSeconds: r.connectedSeconds, estimatedCostUsd: r.estimatedCostUsd },
        commit: r.imageCommit,
        versions: r.versions || {}
      } : null;
    })
    .catch(function (err) { console.error('[cf-containers] 前回の記録の取得に失敗', err); })
    .finally(function () {
      prevSnapshotLoaded = true;
      onPrevSnapshotLoaded.forEach(function (fn) { fn(); });
    });
  function saveSnapshot(part) {
    Object.keys(part).forEach(function (k) { currentSnapshot[k] = part[k]; });
  }
  // ヘルスチェックの結果がそろったら、今回の値をD1へ記録する
  function recordSnapshotToServer() {
    var c = currentSnapshot.cost || {};
    fetch('/api/cf-containers/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runningContainers: typeof currentSnapshot.running === 'boolean' ? (currentSnapshot.running ? 1 : 0) : null,
        connectedSeconds: typeof c.cumulativeConnectedSeconds === 'number' ? c.cumulativeConnectedSeconds : null,
        estimatedCostUsd: typeof c.estimatedCostUsd === 'number' ? c.estimatedCostUsd : null,
        imageCommit: currentSnapshot.commit || null,
        versions: currentSnapshot.versions || {}
      })
    })
      .then(readJsonOrText)
      .then(function (data) {
        var el = document.getElementById('health-log');
        if (data.error) { el.textContent = '記録に失敗: ' + data.error; return; }
        el.textContent = '今回の値を記録しました(前回からの変更 ' + (data.diffs ? data.diffs.length : 0) + '件)';
      })
      .catch(function (err) { document.getElementById('health-log').textContent = '記録に失敗: ' + String(err); });
  }
  function prevSince() {
    return prevSnapshot && prevSnapshot.savedAt ? '前回(' + prevSnapshot.savedAt.replace('T', ' ').slice(0, 16) + ' UTC)から' : '';
  }

  // ページ内メニュー: 行末の▼で現在の設定状況を最上位のモーダルに出し、「変更する」で該当セクションへ飛ぶ
  function getNextZ() {
    var max = 1000;
    document.querySelectorAll('*').forEach(function (el) {
      var z = parseInt(getComputedStyle(el).zIndex, 10);
      if (!isNaN(z) && z > max) max = z;
    });
    return max + 100;
  }
  function sectionText(id) {
    var el = document.getElementById(id);
    return el ? (el.textContent || '').trim().slice(0, 160) : '';
  }
  function sectionStatus(name) {
    var lines = [];
    if (name === 'secrets') lines.push('対象: ' + document.getElementById('secret-name').value + '（値は表示しません）');
    if (name === 'control') lines.push('コンテナの状態: ' + document.getElementById('status-chip').textContent);
    if (name === 'pricing') lines.push(sectionText('cost-summary') || '未取得');
    if (name === 'health') lines.push(document.getElementById('health-table').hidden ? '未確認' : '確認済み: ' + document.getElementById('health-time').textContent);
    if (name === 'report') lines.push('Slack通知: ' + (document.getElementById('report-slack-toggle').checked ? 'ON' : 'OFF'));
    if (name === 't3') lines.push(document.getElementById('t3-table').hidden ? '未確認' : '総合判定: ' + document.getElementById('t3-verdict').textContent);
    if (name === 'net') lines.push(document.getElementById('net-log').textContent ? '取得済み' : '未取得');
    if (name === 'buildlog') lines.push(document.getElementById('buildlog-log').textContent ? '取得済み' : '未取得');
    if (name === 'tunnels') lines.push(document.getElementById('tunnel-table').hidden ? '未取得' : '一覧: ' + document.getElementById('tunnel-tbody').rows.length + '件');
    if (name === 'links' || name === 'pricing') { /* 上の行で足りる */ }
    return lines.join('\\n');
  }
  var menuModal = document.getElementById('menu-modal');
  var menuTarget = null;
  function closeMenu() {
    menuModal.hidden = true;
    document.querySelectorAll('.menu-toggle').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); b.textContent = '▼'; });
  }
  document.querySelectorAll('.menu-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var name = btn.getAttribute('data-section');
      menuTarget = name;
      document.getElementById('menu-title').textContent = btn.getAttribute('aria-label');
      document.getElementById('menu-body').textContent = sectionStatus(name);
      menuModal.style.zIndex = String(getNextZ());
      menuModal.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      btn.textContent = '▲';
    });
  });
  document.getElementById('menu-close').addEventListener('click', closeMenu);
  menuModal.addEventListener('click', function (e) { if (e.target === menuModal) closeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menuModal.hidden) closeMenu(); });
  document.getElementById('menu-change').addEventListener('click', function () {
    var section = document.getElementById('section-' + menuTarget);
    closeMenu();
    if (section) {
      section.open = true;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // 各セクションの開閉をブラウザに覚えさせる(保存できない環境でも表示は既定のまま動く)
  document.querySelectorAll('details[data-section]').forEach(function (d) {
    var key = 'cf-containers:open:' + d.getAttribute('data-section');
    try {
      var saved = localStorage.getItem(key);
      if (saved !== null) d.open = saved === '1';
    } catch (e) {}
    d.addEventListener('toggle', function () {
      try { localStorage.setItem(key, d.open ? '1' : '0'); } catch (e) {}
    });
  });
</script>
<script id="section-navigation">
(function () {
  function reveal(hash) {
    if (!hash || hash.indexOf('#section-') !== 0) return;
    var target = document.getElementById(hash.slice(1));
    if (!target) return;
    for (var node = target; node; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  }
  document.querySelectorAll('.section-sidebar a[href^="#section-"]').forEach(function (link) {
    link.addEventListener('click', function () { reveal(link.hash); });
  });
  window.addEventListener('hashchange', function () { reveal(window.location.hash); });
  reveal(window.location.hash);
})();
</script>
<script id="apache-modules-panel">
// Apacheモジュール一覧(ユーザー指定 2026-11-14)。Apache(本体)行の行頭のトグルで
// ▶(全部閉じる)→▼(全部開く。🔐でない行はグレーアウト)→▲(🔐の行だけ)→▶ と巡る。
// 各モジュール名の先頭のチェックボックスをONにすると🔐ボタンに替わりロックされ、🔐を押すと解除する。
// ロックはCookie cfc_apache_module_locks に7日間保存する。壊れた値や一覧に無い名前はロック無しとして扱う。
// モジュール名を押すと、最上位のモーダルに状態・説明・設定項目(ディレクティブ)を出す(ユーザー指定 2026-11-15)。
// 説明は静的アセット(Apacheのソースから展開したマニュアル)のmodules.jsonから読み、ヘルプは分離したiframeで最上位に出す。
(function () {
  var MANUAL_BASE = '${APACHE_MANUAL_BASE}';
  var manualPromise = null;
  var currentModule = null;
  var moduleModal = document.getElementById('apache-module-modal');
  var helpModal = document.getElementById('apache-help-modal');
  var helpFrame = document.getElementById('apache-help-frame');
  var COOKIE = 'cfc_apache_module_locks';
  var MAX_AGE = 7 * 24 * 60 * 60;
  var NEXT = { closed: 'open', open: 'locked', locked: 'closed' };
  var MARK = { closed: '▶', open: '▼', locked: '▲' };
  var LABEL = { closed: 'モジュール一覧を開く', open: '🔐の行だけにする', locked: 'モジュール一覧を閉じる' };
  var state = 'closed';
  var locks = {};

  function readLocks() {
    var found = {};
    document.cookie.split(';').forEach(function (part) {
      var kv = part.trim();
      var eq = kv.indexOf('=');
      if (eq < 0 || kv.slice(0, eq) !== COOKIE) return;
      kv.slice(eq + 1).split(',').forEach(function (raw) {
        var name;
        try { name = decodeURIComponent(raw); } catch (e) { return; }
        if (name) found[name] = true;
      });
    });
    return found;
  }

  function writeLocks() {
    var value = Object.keys(locks).map(encodeURIComponent).join(',');
    document.cookie = COOKIE + '=' + value + '; Path=/cf-containers; Secure; SameSite=Lax; Max-Age=' + (value ? MAX_AGE : 0);
  }

  function apply() {
    var toggle = document.getElementById('apache-modules-toggle');
    if (toggle) {
      toggle.textContent = MARK[state];
      toggle.setAttribute('data-state', state);
      toggle.setAttribute('aria-label', LABEL[state]);
      toggle.setAttribute('aria-expanded', state === 'closed' ? 'false' : 'true');
    }
    document.querySelectorAll('#apache-modules-tbody tr[data-module]').forEach(function (tr) {
      var locked = !!locks[tr.getAttribute('data-module')];
      tr.classList.toggle('module-unlocked', !locked);
      tr.hidden = state === 'closed' || (state === 'locked' && !locked);
    });
  }

  function fillLock(cell, name) {
    cell.innerHTML = '';
    if (locks[name]) {
      var lock = document.createElement('button');
      lock.type = 'button';
      lock.className = 'module-lock';
      lock.textContent = '🔐';
      lock.title = name + ' のロックを解除';
      lock.setAttribute('aria-label', lock.title);
      lock.addEventListener('click', function () {
        delete locks[name];
        writeLocks();
        fillLock(cell, name);
        apply();
      });
      cell.appendChild(lock);
      return;
    }
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'module-check';
    box.setAttribute('aria-label', name + ' をロック');
    box.addEventListener('change', function () {
      if (!box.checked) return;
      locks[name] = true;
      writeLocks();
      fillLock(cell, name);
      apply();
    });
    cell.appendChild(box);
  }

  // 開く直前に、画面のすべての要素のz-indexの最大値+100を取る(CLAUDE.md ルール26)
  function nextZ() {
    var max = 1000;
    document.querySelectorAll('*').forEach(function (el) {
      var z = parseInt(getComputedStyle(el).zIndex, 10);
      if (!isNaN(z) && z > max) max = z;
    });
    return max + 100;
  }

  function loadManual() {
    if (!manualPromise) {
      manualPromise = fetch(MANUAL_BASE + '/modules.json', { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
      // 失敗は次に開いたときに読み直す
      manualPromise.catch(function () { manualPromise = null; });
    }
    return manualPromise;
  }

  function el(tag, text, className) {
    var node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function addPair(dl, label, value) {
    if (!value) return;
    dl.appendChild(el('dt', label));
    dl.appendChild(el('dd', value));
  }

  function openHelp(url, title) {
    document.getElementById('apache-help-title').textContent = title;
    helpFrame.setAttribute('src', url);
    helpModal.style.zIndex = String(nextZ());
    helpModal.hidden = false;
  }

  function closeHelp() {
    helpModal.hidden = true;
    helpFrame.setAttribute('src', 'about:blank');
  }

  function closeModule() {
    closeHelp();
    moduleModal.hidden = true;
    currentModule = null;
  }

  function helpLink(href, text, className, title) {
    var a = el('a', text, className);
    a.href = href;
    a.setAttribute('href', href);
    a.addEventListener('click', function (e) { e.preventDefault(); openHelp(href, title); });
    return a;
  }

  function fillManual(body, note, index, module, apacheVersion) {
    var entry = index && index.modules ? index.modules[module.name] : null;
    if (!entry) {
      note.textContent = '静的アセットにこのモジュールの説明がありません(Apache ' + (index && index.apacheVersion || '?') + ' のマニュアルに無いモジュールです)。';
      return;
    }
    note.textContent = entry.description;
    var dl = el('dl');
    addPair(dl, '区分', entry.status);
    addPair(dl, '識別子', entry.identifier);
    addPair(dl, 'ソース', entry.sourceFile);
    addPair(dl, '互換性', entry.compatibility);
    body.appendChild(dl);
    if (apacheVersion && index.apacheVersion !== apacheVersion) {
      body.appendChild(el('p', '説明はApache ' + index.apacheVersion + ' のマニュアルです(コンテナは ' + apacheVersion + ')。', 'module-inactive'));
    }
    var href = MANUAL_BASE + '/' + entry.file;
    body.appendChild(helpLink(href, '📖 ' + entry.title + ' のヘルプを開く', 'apache-help-link', entry.title));
    body.appendChild(el('h4', '設定項目(ディレクティブ)'));
    if (!entry.directives || !entry.directives.length) {
      body.appendChild(el('p', 'このモジュールのページで定義されたディレクティブはありません。', 'module-inactive'));
      return;
    }
    var table = el('table', null, 'apache-directives');
    var head = el('tr');
    ['名前', '構文', '既定値', '使える場所'].forEach(function (h) { head.appendChild(el('th', h)); });
    table.appendChild(head);
    entry.directives.forEach(function (d) {
      var tr = el('tr');
      var nameCell = el('td');
      nameCell.appendChild(helpLink(href + (d.anchor ? '#' + d.anchor : ''), d.name, 'apache-directive-link', entry.title + ' - ' + d.name));
      if (d.description) { nameCell.appendChild(el('br')); nameCell.appendChild(el('span', d.description, 'module-inactive')); }
      tr.appendChild(nameCell);
      var syntax = el('td');
      syntax.appendChild(el('code', d.syntax || ''));
      tr.appendChild(syntax);
      tr.appendChild(el('td', d['default'] || ''));
      tr.appendChild(el('td', d.context || ''));
      table.appendChild(tr);
    });
    body.appendChild(table);
  }

  function openModule(module, apacheVersion) {
    currentModule = module.name;
    var active = module.installed && module.enabled === true;
    document.getElementById('apache-module-title').textContent = 'mod_' + module.name;
    var body = document.getElementById('apache-module-body');
    body.innerHTML = '';
    var dl = el('dl');
    dl.appendChild(el('dt', 'ロード状態'));
    var stateCell = el('dd');
    stateCell.appendChild(el('span', module.enabled === true ? '有効' : (module.enabled === false ? '無効' : '不明'), active ? 'module-active' : 'module-inactive'));
    stateCell.firstChild.id = 'apache-module-state';
    dl.appendChild(stateCell);
    addPair(dl, '導入', module.installed ? '導入済み' : '未導入');
    addPair(dl, 'Apache版', apacheVersion || '取得できず');
    body.appendChild(dl);
    var note = el('p', '説明を読み込んでいます…');
    note.style.margin = '8px 0 4px';
    body.appendChild(note);
    moduleModal.style.zIndex = String(nextZ());
    moduleModal.hidden = false;
    var name = module.name;
    loadManual().then(function (index) {
      if (currentModule !== name) return;
      fillManual(body, note, index, module, apacheVersion);
    }).catch(function (err) {
      if (currentModule !== name) return;
      note.textContent = '説明を読み込めませんでした(' + (err && err.message ? err.message : String(err)) + ')。';
    });
  }

  if (moduleModal && helpModal && helpFrame) {
    document.getElementById('apache-module-close').addEventListener('click', closeModule);
    document.getElementById('apache-help-close').addEventListener('click', closeHelp);
    moduleModal.addEventListener('click', function (e) { if (e.target === moduleModal) closeModule(); });
    helpModal.addEventListener('click', function (e) { if (e.target === helpModal) closeHelp(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!helpModal.hidden) closeHelp();
      else if (!moduleModal.hidden) closeModule();
    });
  }

  function cell(tr, text, className) {
    var td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    tr.appendChild(td);
    return td;
  }

  function render(data) {
    var table = document.getElementById('apache-modules-table');
    var tbody = document.getElementById('apache-modules-tbody');
    var error = document.getElementById('apache-modules-error');
    tbody.innerHTML = '';
    error.textContent = data && data.error ? '状態取得の補足: ' + data.error : '';
    if (!data || !Array.isArray(data.items)) { table.hidden = true; return; }
    locks = readLocks();
    var installed = 0;
    var enabled = 0;
    data.items.forEach(function (m) {
      if (m.installed) installed++;
      if (m.installed && m.enabled === true) enabled++;
    });

    var main = document.createElement('tr');
    main.className = 'apache-main-row';
    var head = document.createElement('td');
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'apache-modules-toggle';
    toggle.className = 'module-toggle';
    toggle.addEventListener('click', function () { state = NEXT[state]; apply(); });
    head.appendChild(toggle);
    head.appendChild(document.createTextNode('Apache(本体)'));
    main.appendChild(head);
    cell(main, data.apacheVersion || '取得できず', data.apacheVersion ? 'module-active' : 'module-inactive');
    cell(main, installed + '/' + data.items.length + ' 導入済み');
    cell(main, '有効 ' + enabled + '件');
    tbody.appendChild(main);

    data.items.forEach(function (module) {
      var active = module.installed && module.enabled === true;
      var tr = document.createElement('tr');
      tr.setAttribute('data-module', module.name);
      var first = document.createElement('td');
      first.className = 'module-first';
      var lockCell = document.createElement('span');
      lockCell.className = 'module-lock-cell';
      var name = document.createElement('button');
      name.type = 'button';
      name.className = 'module-name ' + (active ? 'module-active' : 'module-inactive');
      name.textContent = module.name;
      name.setAttribute('aria-label', module.name + ' の説明を開く');
      name.addEventListener('click', function () { openModule(module, data.apacheVersion); });
      first.appendChild(lockCell);
      first.appendChild(name);
      tr.appendChild(first);
      fillLock(lockCell, module.name);
      cell(tr, data.apacheVersion || '取得できず', active && data.apacheVersion ? 'module-active' : 'module-inactive');
      cell(tr, module.installed ? '導入済み' : '未導入', module.installed ? 'module-active' : 'module-inactive');
      cell(tr, module.enabled === true ? '有効' : (module.enabled === false ? '無効' : '不明'), active ? 'module-active' : 'module-inactive');
      tbody.appendChild(tr);
    });
    apply();
    table.hidden = false;
  }

  window.cfcApacheModules = { render: render };
})();
</script>
<script>
(function () {
  var chip = document.getElementById('status-chip');
  var log = document.getElementById('log');
  var buttons = {
    start: document.getElementById('btn-start'),
    stop: document.getElementById('btn-stop'),
    restart: document.getElementById('btn-restart'),
    refresh: document.getElementById('btn-refresh')
  };

  var isRunning = false;

  // 起動中は「起動」、停止中は「停止」を押せないようにする(状態と矛盾する
  // 操作をボタンの見た目からも分かるようにする)。
  function applyRunningDisabled() {
    buttons.start.disabled = isRunning;
    buttons.stop.disabled = !isRunning;
  }

  function setBusy(busy) {
    if (busy) {
      Object.keys(buttons).forEach(function (key) {
        buttons[key].disabled = true;
      });
      return;
    }
    buttons.restart.disabled = false;
    buttons.refresh.disabled = false;
    applyRunningDisabled();
  }

  var usageSummary = document.getElementById('usage-summary');
  var sshBox = document.getElementById('ssh-box');
  var sshCommand = document.getElementById('ssh-command');
  var btnCopySsh = document.getElementById('btn-copy-ssh');
  btnCopySsh.addEventListener('click', function () {
    navigator.clipboard.writeText(sshCommand.textContent).then(function () {
      btnCopySsh.textContent = 'コピーしました';
      setTimeout(function () { btnCopySsh.textContent = 'コマンドをコピー'; }, 1500);
    });
  });

  var sleepAfterValue = document.getElementById('sleep-after-value');
  var liveClock = document.getElementById('live-clock');
  var costSummary = document.getElementById('cost-summary');
  var liveClockTimer = null;
  var sleepAfterShown = false;

  function formatSleepAfter(value) {
    var m = /^(\d+)([a-z]+)$/.exec(String(value || ''));
    if (!m) return String(value || '不明');
    var n = m[1];
    if (m[2] === 'm') return n + '分';
    if (m[2] === 's') return n + '秒';
    if (m[2] === 'h') return n + '時間';
    return value;
  }

  function formatHms(totalSeconds) {
    var s = Math.max(0, Math.floor(totalSeconds));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return pad(h) + ':' + pad(m) + ':' + pad(sec);
  }

  function renderStatus(data) {
    chip.textContent = data.label;
    chip.setAttribute('data-running', data.running ? 'true' : 'false');
    isRunning = !!data.running;
    applyRunningDisabled();
    if (data.usage) {
      var parts = ['累計起動回数: ' + data.usage.totalStartCount + '回'];
      if (data.usage.lastStartedAt) {
        parts.push('直近起動: ' + data.usage.lastStartedAt);
      }
      if (data.usage.elapsedSinceLastStart) {
        parts.push('経過: ' + data.usage.elapsedSinceLastStart);
      }
      usageSummary.textContent = parts.join(' / ');
    } else {
      usageSummary.textContent = '';
    }
    if (data.instanceId) {
      sshBox.hidden = false;
      sshCommand.textContent = 'ssh -o ProxyCommand="wrangler containers ssh %h" cloudchamber@' + data.instanceId;
    } else {
      sshBox.hidden = true;
    }
    if (sleepAfterValue && !sleepAfterShown && data.sleepAfter) {
      sleepAfterValue.textContent = formatSleepAfter(data.sleepAfter);
      sleepAfterShown = true;
    }
    if (data.cost) {
      costSummary.textContent =
        '累計接続時間: ' + formatHms(data.cost.cumulativeConnectedSeconds) +
        ' / 予定支出(概算、無料枠未考慮): $' + data.cost.estimatedCostUsd.toFixed(4) +
        (data.cost.cumulativeConnectedSeconds > 0
          ? ' / 実質時間単価(総経費÷総接続時間): $' + (data.cost.estimatedCostUsd / (data.cost.cumulativeConnectedSeconds / 3600)).toFixed(5) + '/時間'
          : '');
      renderCostDiff(data.cost);
    }
    if (typeof data.running === 'boolean') saveSnapshot({ running: data.running });
    if (liveClockTimer) {
      clearInterval(liveClockTimer);
      liveClockTimer = null;
    }
    if (data.running && data.usage && data.usage.lastStartedAt) {
      var startedAtMs = Date.parse(data.usage.lastStartedAt);
      liveClock.hidden = false;
      var tick = function () {
        var elapsedThisSession = (Date.now() - startedAtMs) / 1000;
        liveClock.textContent = formatHms(elapsedThisSession) + '（今回のセッション）';
      };
      tick();
      liveClockTimer = setInterval(tick, 1000);
    } else {
      liveClock.hidden = true;
    }
  }

  function fetchStatus() {
    return fetch('/api/cf-containers/status')
      .then(readJsonOrText)
      .then(function (data) {
        if (data.error) {
          chip.textContent = 'エラー: ' + data.error;
          chip.setAttribute('data-running', 'false');
          return;
        }
        renderStatus(data);
      })
      .catch(function (err) {
        chip.textContent = '取得に失敗しました';
        log.textContent = String(err);
      });
  }

  function runAction(action) {
    setBusy(true);
    log.textContent = action + ' を実行中…';
    fetch('/api/cf-containers/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action })
    })
      .then(readJsonOrText)
      .then(function (data) {
        if (data.error) {
          log.textContent = 'エラー: ' + data.error;
          return;
        }
        log.textContent = action + ' が完了しました(' + data.label + ')';
        renderStatus(data);
      })
      .catch(function (err) {
        log.textContent = 'エラー: ' + String(err);
      })
      .finally(function () {
        setBusy(false);
      });
  }

  buttons.start.addEventListener('click', function () { runAction('start'); });
  buttons.stop.addEventListener('click', function () { runAction('stop'); });
  buttons.restart.addEventListener('click', function () { runAction('restart'); });
  buttons.refresh.addEventListener('click', fetchStatus);

  fetchStatus();

  // JSON以外(例: コンテナ停止中のHTTP 500のテキスト)が返っても、Safariの
  // "The string did not match the expected pattern" ではなく本文をそのまま見せる
  function readJsonOrText(res) {
    return res.text().then(function (text) {
      try { return JSON.parse(text); } catch (e) {
        throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 300));
      }
    });
  }

  function badge(ok) {
    return '<span class="badge" data-ok="' + (ok ? 'true' : 'false') + '">' + (ok ? 'OK' : 'NG') + '</span>';
  }

  // 版の判定: ok=想定どおり(緑)、warn=想定と違う(黄)、ng=無い・最低版より古い(赤)
  var VERSION_LABELS = { ok: 'OK', warn: '想定と違う', ng: 'NG', none: '未導入' };
  // 版を数値の並びとして比べる(server.jsのcompareVersionsと同じ考え方)
  function compareVer(a, b) {
    var pa = String(a).split(/[^0-9]+/).filter(Boolean).map(Number);
    var pb = String(b).split(/[^0-9]+/).filter(Boolean).map(Number);
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  }
  var latestVersions = null;
  var lastVersions = null;
  function loadLatestVersions(versions) {
    var node = (versions.items || []).filter(function (v) { return v.name === 'node'; })[0];
    var major = node && node.actual ? String(node.actual).split('.')[0] : '26';
    var current = (versions.items || []).filter(function (v) { return v.actual; })
      .map(function (v) { return v.name + ':' + v.actual; }).join(',');
    fetch('/api/cf-containers/latest-versions?nodeMajor=' + encodeURIComponent(major) + '&current=' + encodeURIComponent(current))
      .then(readJsonOrText)
      .then(function (data) { latestVersions = data.latest || null; renderVersions(lastVersions); })
      .catch(function (err) { latestVersions = { _error: String(err) }; renderVersions(lastVersions); });
  }
  // ネットワーク・CLIツールの表(apt)。最新と同じか新しければ緑、古ければ黄、入っていなければ赤。
  function renderApt(tools) {
    var table = document.getElementById('apt-table');
    var tbody = document.getElementById('apt-tbody');
    tbody.innerHTML = '';
    if (!tools || !tools.items) { table.hidden = true; return; }
    tools.items.forEach(function (t) {
      var tr = document.createElement('tr');
      var cells = [t.name, t.pkg || '-', t.actual || '(入っていない)', t.latest || (t.note || '-')];
      cells.forEach(function (text, i) {
        var td = document.createElement('td');
        td.textContent = text;
        if (i === 2) td.className = t.level === 'ok' ? 'diff-ok' : (t.level === 'warn' ? 'diff-up' : '');
        tr.appendChild(td);
      });
      var tdLevel = document.createElement('td');
      var span = document.createElement('span');
      span.className = 'badge';
      span.setAttribute('data-level', t.level);
      span.textContent = t.status || ({ ok: 'OK(最新)', warn: '古い・取得できず', ng: '未インストール' }[t.level] || t.level);
      tdLevel.appendChild(span);
      tr.appendChild(tdLevel);
      tbody.appendChild(tr);
    });
    table.hidden = false;
  }

  function renderVersions(versions) {
    lastVersions = versions;
    var table = document.getElementById('version-table');
    var tbody = document.getElementById('version-tbody');
    tbody.innerHTML = '';
    if (!versions || !versions.items) { table.hidden = true; return; }
    versions.items.forEach(function (v) {
      var tr = document.createElement('tr');
      var prevVersions = (prevSnapshot && prevSnapshot.versions) || {};
      var before = prevVersions[v.name];
      var changed = before !== undefined && before !== v.actual;
      var info = latestVersions && latestVersions[v.name];
      var isLatest = !!(info && info.latest && v.actual && compareVer(v.actual, info.latest) >= 0);
      var cells = [v.name, v.actual || (v.level === 'none' ? '未導入' : '(取得できず)'), before === undefined ? '-' : (before || '(取得できず)'), v.expected || (v.minimum ? v.minimum + '以上' : '-')];
      cells.forEach(function (text, i) {
        var td = document.createElement('td');
        td.textContent = text;
        if (i === 1) td.className = isLatest ? 'diff-ok' : (changed ? 'diff-up' : '');
        if (i === 2) td.className = changed ? 'diff-up' : '';
        tr.appendChild(td);
      });
      var tdLevel = document.createElement('td');
      var span = document.createElement('span');
      span.className = 'badge';
      span.setAttribute('data-level', v.level);
      span.textContent = VERSION_LABELS[v.level] || v.level;
      span.title = v.raw || '';
      tdLevel.appendChild(span);
      tr.appendChild(tdLevel);
      // 今の版のリリース日(配布元から取れたもの)
      var tdCurDate = document.createElement('td');
      tdCurDate.textContent = !latestVersions ? '確認中…' : (info && info.currentDate) ? info.currentDate : '-';
      tr.appendChild(tdCurDate);
      // 配布元に新しい版があれば黄のバッジ
      var tdLatest = document.createElement('td');
      if (!latestVersions) {
        tdLatest.textContent = '確認中…';
      } else if (!info) {
        tdLatest.textContent = '-';
      } else if (!info.latest) {
        tdLatest.textContent = '取得できず';
        tdLatest.title = (info.source || '') + ': ' + (info.error || '');
      } else if (v.actual && compareVer(info.latest, v.actual) > 0) {
        var nb = document.createElement('span');
        nb.className = 'badge';
        nb.setAttribute('data-level', 'warn');
        nb.textContent = '新版あり ' + info.latest;
        nb.title = info.source;
        tdLatest.appendChild(nb);
        if (info.latestDate) tdLatest.appendChild(document.createTextNode(' (' + info.latestDate + ')'));
      } else {
        tdLatest.textContent = info.latest + (info.latestDate ? ' (' + info.latestDate + ')' : '');
        tdLatest.title = info.source;
      }
      tr.appendChild(tdLatest);
      tbody.appendChild(tr);
    });
    table.hidden = false;
    var snap = {};
    versions.items.forEach(function (v) { snap[v.name] = v.actual; });
    saveSnapshot({ versions: snap });
  }

  // 描画・開閉・ロックは <script id="apache-modules-panel"> が受け持つ。
  function renderApacheModules(data) {
    window.cfcApacheModules.render(data);
  }

  // 単価表: 既定は適用中のプランだけ。切り替えで全プランを表示する(適用中は緑のまま)
  var pricingModeBtn = document.getElementById('pricing-mode');
  pricingModeBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var showAll = pricingModeBtn.getAttribute('aria-pressed') !== 'true';
    pricingModeBtn.setAttribute('aria-pressed', showAll ? 'true' : 'false');
    pricingModeBtn.textContent = showAll ? '全プランを表示中' : '適用中のみ表示';
    document.querySelectorAll('#section-pricing tbody tr').forEach(function (row) {
      row.hidden = !showAll && row.getAttribute('data-applied') !== 'true';
    });
  });

  // 累計接続時間・予定支出の前回表示時からの増分
  function renderCostDiff(cost) {
    if (!prevSnapshotLoaded) { onPrevSnapshotLoaded.push(function () { renderCostDiff(cost); }); return; }
    var el = document.getElementById('cost-diff');
    var prev = prevSnapshot && prevSnapshot.cost;
    if (prev) {
      var dSec = cost.cumulativeConnectedSeconds - prev.cumulativeConnectedSeconds;
      var dUsd = cost.estimatedCostUsd - prev.estimatedCostUsd;
      el.className = dSec > 0 || dUsd > 0 ? 'diff-up' : 'diff-same';
      el.textContent = prevSince() + ': 接続時間 +' + formatHms(Math.max(0, dSec)) + ' / 支出 +$' + Math.max(0, dUsd).toFixed(4);
    } else {
      el.className = 'diff-same';
      el.textContent = '(前回の記録なし。ヘルスチェックを実行すると記録され、次回から差分を表示します)';
    }
    saveSnapshot({ cost: { cumulativeConnectedSeconds: cost.cumulativeConnectedSeconds, estimatedCostUsd: cost.estimatedCostUsd } });
  }

  // どのコミット・ビルドから作ったイメージかを表示する(build-info.json)
  function renderBuild(build) {
    var el = document.getElementById('image-build');
    if (!build) { el.hidden = true; return; }
    el.textContent = build.error
      ? 'イメージのビルド情報: 取得できず(' + build.error + ')'
      : 'イメージ: commit ' + String(build.commit || '?').slice(0, 7) + ' / branch ' + (build.branch || '?') +
        ' / build ' + (build.buildUuid || '?') + ' / 作成 ' + (build.builtAt || '?');
    var prevCommit = prevSnapshot && prevSnapshot.commit;
    if (!build.error && prevCommit && prevCommit !== build.commit) {
      el.textContent += '(' + prevSince() + '変更: ' + String(prevCommit).slice(0, 7) + ' → ' + String(build.commit).slice(0, 7) + ')';
      el.className = 'diff-up';
    } else {
      el.className = '';
    }
    if (!build.error) saveSnapshot({ commit: build.commit });
    el.hidden = false;
  }

  // 6時間レポートのSlack通知のON/OFF(D1に保存)
  var reportToggle = document.getElementById('report-slack-toggle');
  var reportLog = document.getElementById('report-slack-log');
  fetch('/api/cf-containers/report-settings')
    .then(readJsonOrText)
    .then(function (data) {
      if (data.error) { reportLog.textContent = 'エラー: ' + data.error; return; }
      reportToggle.checked = !!data.slackEnabled;
      reportToggle.disabled = false;
    })
    .catch(function (err) { reportLog.textContent = 'エラー: ' + String(err); });
  reportToggle.addEventListener('change', function () {
    reportToggle.disabled = true;
    fetch('/api/cf-containers/report-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slackEnabled: reportToggle.checked })
    })
      .then(readJsonOrText)
      .then(function (data) {
        if (data.error) { reportLog.textContent = 'エラー: ' + data.error; reportToggle.checked = !reportToggle.checked; return; }
        reportLog.textContent = data.slackEnabled ? 'ONにしました(次回の6時間cronから送ります)' : 'OFFにしました(D1への記録は続けます)';
      })
      .catch(function (err) { reportLog.textContent = 'エラー: ' + String(err); reportToggle.checked = !reportToggle.checked; })
      .finally(function () { reportToggle.disabled = false; });
  });

  // コンテナの状態の帯(ページ最上部と左サイドパネル)。状態はAPIから取り、ビルド中は開始時刻と経過時間を1秒ごとに更新する。
  var BANNER_LABELS = { building: 'ビルド中', build_failed: 'ビルド失敗', standby: '待機中', stopped: '停止中', unknown: '状態不明' };
  var bannerTargets = [document.getElementById('status-banner'), document.getElementById('sidebar-status')];
  var bannerState = null;
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function formatElapsed(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var sec = total % 60;
    return (h > 0 ? h + ':' + pad2(m) : String(m)) + ':' + pad2(sec);
  }
  function formatStart(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function bannerDetail(state) {
    if (state.kind === 'building') {
      var start = state.build && state.build.startedAt;
      var parts = [];
      if (start) {
        parts.push('ビルド開始 ' + formatStart(start));
        parts.push('経過 ' + formatElapsed(Date.now() - new Date(start).getTime()));
      } else {
        parts.push('ビルド開始時刻を取得できません');
      }
      if (state.build && state.build.status) parts.push('(status: ' + state.build.status + ')');
      return parts.join(' ');
    }
    var notes = [];
    if (state.kind === 'build_failed') {
      var failedAt = state.build && state.build.startedAt;
      notes.push((failedAt ? formatStart(failedAt) + ' 開始の' : '') + '本番のビルドが失敗しました。コンテナは前のイメージのまま動いています。「最新ビルドのログを取得」で原因を確かめてください');
    }
    if (state.container && state.container.label) notes.push(state.container.label);
    if (state.container && state.container.error) notes.push('取得エラー: ' + state.container.error);
    if (state.build && state.build.checked === false && state.build.error) notes.push('ビルドの状態: ' + state.build.error);
    return notes.join(' / ');
  }
  function renderBanner() {
    if (!bannerState) return;
    var label = BANNER_LABELS[bannerState.kind] || BANNER_LABELS.unknown;
    var detail = bannerDetail(bannerState);
    bannerTargets.forEach(function (target) {
      if (!target) return;
      target.setAttribute('data-kind', bannerState.kind);
      target.querySelector('.status-label').textContent = label;
      target.querySelector('.status-detail').textContent = detail;
    });
  }
  function loadBanner() {
    fetch('/api/cf-containers/banner', { cache: 'no-store' })
      .then(readJsonOrText)
      .then(function (data) {
        if (data.error || !data.kind) throw new Error(data.error || '状態を読めません');
        bannerState = data;
        renderBanner();
      })
      .catch(function (err) {
        bannerState = { kind: 'unknown', container: { label: '', error: String(err) }, build: { checked: false } };
        renderBanner();
      })
      .finally(function () {
        // ビルド中は短い間隔、それ以外はゆっくり確認する。
        setTimeout(loadBanner, bannerState && bannerState.kind === 'building' ? 15000 : 30000);
      });
  }
  setInterval(function () { if (bannerState && bannerState.kind === 'building') renderBanner(); }, 1000);
  loadBanner();

  var btnHealth = document.getElementById('btn-health');
  var healthTable = document.getElementById('health-table');
  var healthLog = document.getElementById('health-log');
  btnHealth.addEventListener('click', function () {
    btnHealth.disabled = true;
    healthLog.textContent = '確認中…(コンテナが停止中の場合は起動を待ちます)';
    fetch('/cf-containers/proxy/health')
      .then(readJsonOrText)
      .then(function (data) {
        document.getElementById('health-apache').innerHTML = badge(data.apache);
        document.getElementById('health-sshd').innerHTML = badge(data.sshd);
        document.getElementById('health-cloudflared').innerHTML = badge(data.cloudflared);
        document.getElementById('health-tailscale').innerHTML = badge(data.tailscale);
        if (data.features && data.features.docker === false) {
          document.getElementById('health-docker').textContent = '未同梱（構成指定）';
        } else {
          document.getElementById('health-docker').innerHTML = badge(data.docker);
        }
        document.getElementById('health-time').textContent = data.checkedAt || '';
        healthTable.hidden = false;
        latestVersions = null;
        renderVersions(data.versions);
        renderApacheModules(data.apacheModules);
        renderApt(data.aptTools);
        if (data.versions && data.versions.items) loadLatestVersions(data.versions);
        renderBuild(data.build);
        recordSnapshotToServer();
        healthLog.textContent = '';
      })
      .catch(function (err) {
        healthLog.textContent = 'エラー: ' + String(err);
      })
      .finally(function () {
        btnHealth.disabled = false;
      });
  });

  // ページ表示時に上流リリース情報と最後に記録した導入版をD1へ同期する。
  // コンテナのhealth endpointは呼ばないため、ページ表示を契機にコンテナを起動しない。
  var versionStatusLog = document.getElementById('version-status-log');
  fetch('/api/cf-containers/package-release-status/check', { method: 'POST' })
    .then(readJsonOrText)
    .then(function (data) {
      if (data.error) { versionStatusLog.textContent = 'D1記録エラー: ' + data.error; return; }
      var basis = data.installedSnapshotAt
        ? '導入版の基準: ' + data.installedSnapshotAt + ' / '
        : '導入版の記録なし / ';
      versionStatusLog.textContent = 'D1へ' + data.packageCount + 'パッケージを記録しました。' + basis
        + '新版あり ' + data.updatesAvailable + '件 / 最新版取得失敗 ' + data.latestUnavailable + '件 / 確認 ' + data.checkedAt;
    })
    .catch(function (err) { versionStatusLog.textContent = 'D1記録エラー: ' + String(err); });

  var btnNet = document.getElementById('btn-net');
  var netLog = document.getElementById('net-log');
  btnNet.addEventListener('click', function () {
    btnNet.disabled = true;
    netLog.textContent = '取得中…';
    fetch('/cf-containers/proxy/debug/net')
      .then(readJsonOrText)
      .then(function (data) {
        netLog.textContent = '[ip addr]\\n' + (data.addr || '') + '\\n\\n[ip route]\\n' + (data.route || '')
          + '\\n\\n[/etc/resolv.conf]\\n' + (data.dns || '') + '\\n\\n[ss -tulpn]\\n' + (data.netstat || '')
          + '\\n\\n[netstat -tunap]\\n' + (data.netstatLegacy || '') + '\\n\\n[top]\\n' + (data.top || '')
          + '\\n\\n[dig 既定DNS region1.v2.argotunnel.com]\\n' + (data.digDefault || '') + '\\n\\n[dig @1.1.1.1 region1.v2.argotunnel.com]\\n' + (data.digV4 || '')
          + '\\n\\n[dig @1.1.1.1 controlplane.tailscale.com]\\n' + (data.digTailscale || '') + '\\n\\n[ping 1.1.1.1]\\n' + (data.ping || '')
          + '\\n\\n[whois nekomaneki.work]\\n' + (data.whois || '')
          + '\\n\\n[ファイアウォール: 送信元・逆引き・WHOIS・CIDR集計]\\n' + JSON.stringify(data.firewallStats || {}, null, 2)
          + '\\n\\n[nft ruleset / counters]\\n' + (data.nftRuleset || '')
          + '\\n\\n[drop log]\\n' + (data.dropLog || '');
      })
      .catch(function (err) {
        netLog.textContent = 'エラー: ' + String(err);
      })
      .finally(function () {
        btnNet.disabled = false;
      });
  });

  // T3・Codex・Tailscaleの状態。総合判定の文言(コンテナ側のstateと対応)。
  var T3_STATE_LABELS = {
    ready: '準備完了',
    'server-down': 'T3本体が停止中',
    'server-error': 'T3本体の応答が異常',
    'proxy-down': '埋め込み用の中継が停止中',
    'proxy-error': '埋め込み用の中継の応答が異常',
    exposed: '外に公開されている(要対処)',
    'codex-missing': 'codexが無い',
    'login-required': 'Codexが未サインイン',
    'login-unknown': 'Codexのサインイン状態が不明'
  };

  // tailscale-peersの応答を、表示用の{ok,label,detail}にまとめる。ok: true=正常、false=異常、null=不明。
  function summarizeTailscaleSession(data) {
    if (!data) return { ok: null, label: '不明', detail: 'Tailscaleの状態を取得できませんでした' };
    if (data.error) return { ok: false, label: '取得失敗', detail: String(data.error) };
    var peers = data.peers || [];
    var online = 0;
    var direct = 0;
    var relay = 0;
    peers.forEach(function (peer) {
      if (peer.online) online += 1;
      if (peer.connection === 'direct') direct += 1;
      if (peer.connection === 'relay') relay += 1;
    });
    var self = data.self || {};
    var detail = 'このコンテナ: ' + (self.dnsName || '不明') + ' (' + (self.ip || 'IPなし') + ') / 相手 ' + peers.length + ' 件(オンライン ' + online + ') / 直接 ' + direct + '・中継 ' + relay;
    return { ok: data.backendState === 'Running', label: String(data.backendState || '不明'), detail: detail };
  }

  function t3Cell(ok, text) {
    var span = document.createElement('span');
    span.className = 'badge';
    span.setAttribute('data-ok', ok === true ? 'true' : 'false');
    span.textContent = text || (ok === true ? 'OK' : ok === false ? 'NG' : '不明');
    return span;
  }

  function addT3Row(tbody, name, ok, text, detail) {
    var tr = document.createElement('tr');
    var th = document.createElement('td');
    th.textContent = name;
    var result = document.createElement('td');
    result.appendChild(t3Cell(ok, text));
    var d = document.createElement('td');
    d.textContent = detail;
    tr.appendChild(th);
    tr.appendChild(result);
    tr.appendChild(d);
    tbody.appendChild(tr);
  }

  function renderT3(t3, tailscale) {
    var tbody = document.getElementById('t3-tbody');
    tbody.textContent = '';
    var s = t3.server || {};
    var p = t3.proxy || {};
    var c = t3.codex || {};
    var auth = c.authFile || {};
    var serverOk = Boolean(s.listening) && s.httpStatus >= 200 && s.httpStatus < 300;
    var proxyOk = Boolean(p.listening) && p.httpStatus >= 200 && p.httpStatus < 300;
    addT3Row(tbody, 'T3本体(ポート ' + (s.port || 3773) + ')', serverOk, null,
      '待ち受け: ' + (s.listening ? (s.listenAddress || 'アドレス不明') : 'なし') + ' / HTTP: ' + (s.httpStatus == null ? '応答なし' : s.httpStatus)
      + (s.environmentKeys && s.environmentKeys.length ? ' / environmentのキー: ' + s.environmentKeys.join(', ') : ''));
    addT3Row(tbody, '埋め込み用の中継(ポート ' + (p.port || 3774) + ')', proxyOk, null,
      '待ち受け: ' + (p.listening ? (p.listenAddress || 'アドレス不明') : 'なし') + ' / HTTP: ' + (p.httpStatus == null ? '応答なし' : p.httpStatus)
      + ' / frame-ancestors: ' + (p.frameAncestors ? 'あり' : 'なし'));
    addT3Row(tbody, 'Codex', Boolean(c.installed), null, c.installed ? '版 ' + (c.version || '不明') : 'codex コマンドが見つかりません');
    addT3Row(tbody, 'Codexのサインイン', c.loggedIn === true ? true : c.loggedIn === false ? false : null, null,
      (c.loginSummary ? c.loginSummary + ' / ' : '') + 'auth.json: ' + (auth.exists ? '有(権限 ' + (auth.mode || '不明') + ')' : '無') + ' / HOME: ' + (c.codexHome || c.home || '不明'));
    var ts = summarizeTailscaleSession(tailscale);
    addT3Row(tbody, 'Tailscaleのセッション', ts.ok, ts.label, ts.detail);
    var verdict = document.getElementById('t3-verdict');
    var label = T3_STATE_LABELS[t3.state] || String(t3.state || '不明');
    verdict.textContent = '';
    verdict.appendChild(t3Cell(t3.state === 'ready', label));
    var why = (t3.reasons || []).concat(t3.errors || []);
    if (why.length > 0) verdict.appendChild(document.createTextNode(' ' + why.join(' / ')));
    verdict.hidden = false;
    document.getElementById('t3-table').hidden = false;
  }

  var btnT3Health = document.getElementById('btn-t3-health');
  var t3Log = document.getElementById('t3-log');
  btnT3Health.addEventListener('click', function () {
    btnT3Health.disabled = true;
    t3Log.textContent = '確認中…(コンテナが停止中の場合は起動を待ちます)';
    var tailscaleRequest = fetch('/cf-containers/proxy/debug/tailscale-peers')
      .then(readJsonOrText)
      .catch(function (err) { return { error: String(err) }; });
    fetch('/cf-containers/proxy/health/t3')
      .then(readJsonOrText)
      .then(function (t3) {
        if (!t3 || t3.error || !t3.state) throw new Error((t3 && t3.error) || 'T3の状態を読めません');
        return tailscaleRequest.then(function (tailscale) {
          renderT3(t3, tailscale);
          t3Log.textContent = '確認時刻: ' + (t3.checkedAt || '');
        });
      })
      .catch(function (err) { t3Log.textContent = 'エラー: ' + String(err); })
      .finally(function () { btnT3Health.disabled = false; });
  });

  var btnT3Login = document.getElementById('btn-t3-login');
  btnT3Login.addEventListener('click', function () {
    btnT3Login.disabled = true;
    // 非同期の後のwindow.openはSafariがブロックするため、先にタブを開いておく。
    var tab = window.open('about:blank', '_blank');
    t3Log.textContent = 'ログイン用のペアリングを作成中…';
    fetch('/cf-containers/proxy/t3/pairing', { method: 'POST' })
      .then(readJsonOrText)
      .then(function (r) {
        if (!r || !r.ok) throw new Error(((r && r.detail) || '応答を読めません') + ((r && r.remedy) ? ' / 対処: ' + r.remedy : ''));
        if (tab) tab.location.href = r.pairUrl; else window.location.href = r.pairUrl;
        t3Log.textContent = 'T3を開きました(このリンクは1回限り、期限 ' + r.expiresAt + ')';
      })
      .catch(function (err) { if (tab) tab.close(); t3Log.textContent = 'エラー: ' + String(err); })
      .finally(function () { btnT3Login.disabled = false; });
  });

  var btnTailscalePeers = document.getElementById('btn-tailscale-peers');
  var tailscalePeersLog = document.getElementById('tailscale-peers-log');
  btnTailscalePeers.addEventListener('click', function () {
    btnTailscalePeers.disabled = true;
    tailscalePeersLog.textContent = '取得中…';
    fetch('/cf-containers/proxy/debug/tailscale-peers')
      .then(readJsonOrText)
      .then(function (data) {
        if (!data || data.error) { tailscalePeersLog.textContent = 'エラー: ' + ((data && data.error) || '応答を読めません'); return; }
        var lines = ['状態: ' + data.backendState + ' / このコンテナ: ' + data.self.dnsName + ' (' + data.self.ip + ')', ''];
        data.peers.forEach(function (peer) {
          var route = peer.connection === 'direct' ? '直接(P2P) ' + peer.curAddr
            : peer.connection === 'relay' ? 'DERP中継 ' + peer.relay
            : '経路なし';
          lines.push((peer.active ? '[通信中] ' : '') + (peer.online ? '' : '[オフライン] ') + peer.hostName + ' ' + peer.ip + ' ' + peer.os + ' : ' + route);
        });
        if (data.peers.length === 0) lines.push('相手がいません');
        lines.push('', '確認時刻: ' + data.checkedAt);
        tailscalePeersLog.textContent = lines.join('\\n');
      })
      .catch(function (err) { tailscalePeersLog.textContent = 'エラー: ' + String(err); })
      .finally(function () { btnTailscalePeers.disabled = false; });
  });

  var btnBuildLog = document.getElementById('btn-buildlog');
  var buildLogPre = document.getElementById('buildlog-log');
  btnBuildLog.addEventListener('click', function () {
    btnBuildLog.disabled = true;
    buildLogPre.textContent = '取得中…';
    fetch('/api/cf-containers/build-log')
      .then(readJsonOrText)
      .then(function (data) {
        if (data.error) { buildLogPre.textContent = 'エラー: ' + data.error; return; }
        buildLogPre.textContent = 'build=' + data.buildUuid + ' status=' + (data.status || '?') + '\\n\\n[直近のビルド]\\n' + (data.recentBuilds || []).join('\\n') + '\\n\\n[API応答の形]\\n' + (data.responseShape || []).join('\\n') + '\\n\\n' + (data.log || '(ログ空)');
        if (data.timingWarning) buildLogPre.textContent += '\\n\\n' + data.timingWarning;
      })
      .catch(function (err) { buildLogPre.textContent = 'エラー: ' + String(err); })
      .finally(function () { btnBuildLog.disabled = false; });
  });

  var btnContainerList = document.getElementById('btn-container-list');
  var containerListOutput = document.getElementById('container-list-output');
  var containerListGroups = document.getElementById('container-list-groups');
  btnContainerList.addEventListener('click', function () {
    btnContainerList.disabled = true;
    containerListOutput.textContent = '実行中…';
    containerListGroups.textContent = '';
    fetch('/cf-containers/proxy/debug/wrangler/containers-list', { cache: 'no-store' })
      .then(readJsonOrText)
      .then(function (data) {
        var lines = ['$ ' + (data.command || 'wrangler containers list --json')];
        if (data.stdout) lines.push(data.stdout.replace(/\\s+$/, ''));
        if (data.stderr) lines.push('[stderr]\\n' + data.stderr.replace(/\\s+$/, ''));
        if (data.error) lines.push('[error] ' + data.error);
        if (data.checkedAt) lines.push('[取得時刻] ' + data.checkedAt);
        containerListOutput.textContent = lines.join('\\n\\n');
        if (data.exitCode !== 0 || !data.stdout) return;
        var rows;
        try { rows = JSON.parse(data.stdout); } catch (_) { return; }
        if (!Array.isArray(rows)) rows = rows && (rows.containers || rows.items || rows.results);
        if (!Array.isArray(rows)) return;
        if (rows.length === 0) {
          containerListGroups.textContent = 'コンテナはありません。';
          return;
        }
        var groups = Object.create(null);
        rows.forEach(function (row) {
          var created = row && (row.created_at || row.createdAt || row.created);
          var date = typeof created === 'string' && !isNaN(Date.parse(created)) ? new Date(created).toISOString().slice(0, 10) : '作成日不明';
          (groups[date] || (groups[date] = [])).push(row);
        });
        Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); }).forEach(function (date) {
          var section = document.createElement('section');
          var heading = document.createElement('h3');
          heading.textContent = date + '（' + groups[date].length + '）';
          section.appendChild(heading);
          var list = document.createElement('ul');
          groups[date].forEach(function (row) {
            var item = document.createElement('li');
            item.textContent = [row.name || row.id || row.application_id || '名前不明', row.version ? 'version ' + row.version : '', row.status || ''].filter(Boolean).join(' — ');
            list.appendChild(item);
          });
          section.appendChild(list);
          containerListGroups.appendChild(section);
        });
      })
      .catch(function (err) { containerListOutput.textContent = 'エラー: ' + String(err); })
      .finally(function () { btnContainerList.disabled = false; });
  });

  var btnTunnels = document.getElementById('btn-tunnels');
  var tunnelTable = document.getElementById('tunnel-table');
  var tunnelTbody = document.getElementById('tunnel-tbody');
  var tunnelLog = document.getElementById('tunnel-log');
  btnTunnels.addEventListener('click', function () {
    btnTunnels.disabled = true;
    tunnelLog.textContent = '取得中…';
    fetch('/api/cf-containers/tunnels')
      .then(readJsonOrText)
      .then(function (data) {
        if (data.error) {
          tunnelLog.textContent = 'エラー: ' + data.error;
          return;
        }
        tunnelTbody.innerHTML = '';
        (data.tunnels || []).forEach(function (t) {
          var tr = document.createElement('tr');
          var statusBadge = badge(t.status === 'healthy');
          tr.innerHTML = '<td>' + t.name + '</td><td>' + statusBadge + ' ' + t.status + '</td>' +
            '<td>' + t.connectionCount + '</td><td><code>' + t.id + '</code></td>';
          tunnelTbody.appendChild(tr);
        });
        tunnelTable.hidden = false;
        var q = data.queriedWith || {};
        tunnelLog.textContent = data.tunnels && data.tunnels.length ? '' :
          '(トンネルが見つかりません: アカウント末尾' + (q.accountIdTail || '?') + '、トークン=' + (q.tokenSource || '?') + '。このアカウントに削除されていないトンネルが無いか、トンネルが別のアカウントにあります)';
      })
      .catch(function (err) {
        tunnelLog.textContent = 'エラー: ' + String(err);
      })
      .finally(function () {
        btnTunnels.disabled = false;
      });
  });

  var secretName = document.getElementById('secret-name');
  var secretValue = document.getElementById('secret-value');
  var authorizedKeyInput = document.getElementById('authorized-key-input');
  var authorizedKeyHmac = document.getElementById('authorized-key-hmac');
  var authorizedKeyLog = document.getElementById('authorized-key-log');
  var btnAddAuthorizedKey = document.getElementById('btn-add-authorized-key');
  btnAddAuthorizedKey.addEventListener('click', function () {
    var publicKey = authorizedKeyInput.value.trim();
    var hmac = authorizedKeyHmac.value;
    if (!publicKey) { authorizedKeyLog.textContent = '公開鍵を入力してください'; return; }
    if (!hmac) { authorizedKeyLog.textContent = 'HMACシークレットを入力してください'; return; }
    btnAddAuthorizedKey.disabled = true;
    authorizedKeyLog.textContent = '追加中…';
    fetch('/api/cf-containers/authorized-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: publicKey, hmac: hmac })
    })
      .then(readJsonOrText)
      .then(function (data) {
        if (!data || data.ok !== true) { authorizedKeyLog.textContent = (data && data.error) || '追加を確認できませんでした'; return; }
        authorizedKeyLog.textContent = data && data.added === false ? data.message : '追加しました';
        authorizedKeyInput.value = '';
      })
      .catch(function (err) { authorizedKeyLog.textContent = '追加に失敗しました: ' + err.message; })
      .finally(function () { authorizedKeyHmac.value = ''; btnAddAuthorizedKey.disabled = false; });
  });
  var btnSetSecret = document.getElementById('btn-set-secret');
  var secretLog = document.getElementById('secret-log');
  btnSetSecret.addEventListener('click', function () {
    var value = secretValue.value.trim();
    if (!value) {
      secretLog.textContent = 'トークンを入力してください';
      return;
    }
    btnSetSecret.disabled = true;
    secretLog.textContent = '設定中…(設定後にコンテナを再起動するため少し時間がかかります)';
    fetch('/api/cf-containers/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: secretName.value, value: value })
    })
      .then(readJsonOrText)
      .then(function (data) {
        if (data.error) {
          secretLog.textContent = 'エラー: ' + data.error;
          return;
        }
        secretValue.value = '';
        secretLog.textContent = data.warning ? data.warning : '設定・再起動が完了しました';
        fetchStatus();
      })
      .catch(function (err) {
        secretLog.textContent = 'エラー: ' + String(err);
      })
      .finally(function () {
        btnSetSecret.disabled = false;
      });
  });
})();
</script>
</body>
</html>`;
}
