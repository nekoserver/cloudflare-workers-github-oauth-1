# SPEC: ドメインごとのCookieの割り当て状態とアクセス制御(2026-11-15)

---

## 1. 対象と結論

**対象**: 本体ワーカーの2つのホスト(ワーカーのドメイン`cloudflare-workers-github-oauth-1.nekoflare.workers.dev`と、独自ドメイン`1.wr1.nekomaneki.work`)と、同じ`nekomaneki.work`の下にある本体コンテナ(`mygw.nekomaneki.work`)のCookieとアクセス制御 — ホストごとに、どのCookieが付き、誰が何にアクセスできるかを定める。

### 結論

- 本体ワーカーは、2つのホストで**同じコード・同じD1**を使う。違いは**Cookieがホストごとに分かれる**ことから生じる。
- 本体ワーカーのCookieには`Domain`を付けない(ホスト限定)。**ワーカーのドメインと独自ドメインでログインを共有しない**。
- 同じ`nekomaneki.work`の下でも、`Domain=nekomaneki.work`でCookieを共有しない(5章)。
- 本体コンテナの`/lib`は、どちらのホストからも、本体ワーカー経由の入口(`/cf-containers/proxy/lib/...`)でだけ使う(詳しくは[`SPEC.cloudflare-workers-github-oauth-1.20261115.lib-access-via-worker.md`](SPEC.cloudflare-workers-github-oauth-1.20261115.lib-access-via-worker.md))。

---

## 2. ホストの一覧

**対象**: このSPECが扱うホスト。2026-11-15に実物で応答を確かめた。

| ホスト | 種類 | 中身 | 2026-11-15の応答 |
|---|---|---|---|
| `cloudflare-workers-github-oauth-1.nekoflare.workers.dev` | ワーカーのドメイン | 本体ワーカー | 有効 |
| `1.wr1.nekomaneki.work` | 独自ドメイン(Custom Domain) | 本体ワーカー(同じWorker) | `/`が200 |
| `1.cfw1.nekomaneki.work` | Worker Route(`wrangler.toml`でコメントアウト) | — | 応答なし(使っていない) |
| `mygw.nekomaneki.work` | トンネルの公開ホスト | 本体コンテナのApache(8443) | `/`が200、`/lib/...`が403 |

- ワーカーのドメインのサイト(ブラウザがCookieの「同じサイト」を判断する単位)は`nekoflare.workers.dev`、独自ドメインと`mygw`のサイトは`nekomaneki.work`である(`workers.dev`は公開サフィックスのため)。
- **独自ドメインと`mygw`は同じサイト、ワーカーのドメインと`mygw`は別のサイト**になる。

---

## 3. 本体ワーカーのCookieの割り当て

**対象**: 本体ワーカーが発行するCookie(`src/`の`Set-Cookie`と`document.cookie`、2026-11-15に洗い出した約60種類) — 種類ごとの属性と、ホストごとの扱い。

### 3.1 共通の属性

- **`Domain`はどれにも付けない。** Cookieは、発行したホストにだけ送られる。ワーカーのドメインで発行したCookieは独自ドメインに送られず、逆も同じ。
- `SameSite`はすべて`Lax`。

### 3.2 種類ごとの属性

| 種類 | 主なCookie | 属性 | 用途 |
|---|---|---|---|
| ログイン | `auth_token`(JWT)、`last_activity`、`login_method` | `HttpOnly; Secure; SameSite=Lax; Path=/` | ログインの証明と、最終操作時刻 |
| ログインの表示用 | `login_timestamp` | `Secure; SameSite=Lax; Path=/`(`HttpOnly`なし) | 画面での表示 |
| ログインの途中 | `oauth_state`、`oauth_pkce`、`oauth_return_to`、`slack_oauth_state` | `HttpOnly; Secure; SameSite=Lax; Path=/`、短い期限 | GitHub・SlackのOAuthの往復 |
| 画面の設定(全体) | `user_theme`、`user_timezone`、`user_session_duration`、`aichat_*`、`er_*`、`user_status_*`など | 多くは`Secure; SameSite=Lax; Path=/` | 表示の好み |
| 画面の設定(ページ限定) | `cfc_apache_module_locks`・`cfc_apache_help_size`(`Path=/cf-containers`)、`inq_board_layout`(`Path=/muse-inquiries`)、`/cron-status`の設定 | `Secure; SameSite=Lax`、ページのパスに限定 | そのページだけの状態 |

- 画面の設定の一部(`heritage_journey_*`、`keyword_*`、`kw_panel_*`、`kp_hide_zero_hits`、`commit_history_merge_filter`、`history_incr_search`、`cg_group_off_clears_badges`)には`Secure`が無い。中身は表示の好みだけで、サイトはHTTPSでしか配信しないため、実害は小さい。ただし統一されていない(未決事項)。

### 3.3 ログインの属性を緩めない

`auth_token`などの`Secure`・`HttpOnly`・`SameSite`は削除・緩和しない(CLAUDE.md ルール25)。`Domain`を付けて共有範囲を広げることも、緩和に当たる(5章)。

---

## 4. ワーカーのドメインと独自ドメインの違い

**対象**: 同じ本体ワーカーを、ワーカーのドメインで使う場合と独自ドメインで使う場合の違い。

| 項目 | ワーカーのドメイン | 独自ドメイン | 理由・根拠 |
|---|---|---|---|
| ログイン | それぞれでログインが要る(共有しない) | 同左 | `auth_token`に`Domain`が無い |
| GitHubのログインの戻り先 | `https://…workers.dev/auth/github/callback` | `https://1.wr1.nekomaneki.work/auth/github/callback` | `redirect_uri`はアクセスしたホストから作る(`src/index.ts`)。GitHub側でそのURLが許可されている必要がある(独自ドメインでのログインの成否は、このSPECでは未確認) |
| 画面の設定(Cookieだけのもの) | ホストごとに別々 | 同左 | Cookieがホスト限定 |
| 画面の設定(D1に保存するもの) | 同じ値 | 同じ値 | 同じユーザーなら同じD1の行を読む。解決順は「D1 → Cookie → 既定値」(CLAUDE.md ルール27)。タイムゾーン・セッションの有効期限など |
| PWA(ホーム画面に追加) | 別のアプリ | 別のアプリ | オリジンが違う。Service Workerも別々 |
| 同じオリジンかの確認(`Origin`ヘッダー) | 通る | 通る | 要求を受けたホスト自身と比べる(`isSameOriginRequest`、`securemineLogin.ts`、`dockerDashboardProxy.ts`、`redmineProxy.ts`など) |
| CORS(ほかのオリジンからの呼び出し) | 許可リストにある | **許可リストに無い** | `ALLOWED_ORIGINS`は`workers.dev`と`http://localhost:8787`だけ(`src/index.ts`)。独自ドメインのページから`workers.dev`のAPIを呼ぶような、ドメインをまたぐ呼び出しは通らない。同じホスト内の呼び出しには影響しない |
| 本体ワーカーが作るリンク | `workers.dev`を指す | **`workers.dev`を指す** | `WORKER_BASE_URL`が`workers.dev`に固定(`src/utils/aiSummary.ts`。Slackに出すAI要約のリンクなど)。独自ドメインでログインしていても、リンクを開くと`workers.dev`でのログインが要る |
| `/lib`(本体コンテナ) | `/cf-containers/proxy/lib/...`で管理者だけ | 同左 | パスで決まる経路で、ホストに依存しない |
| 埋め込みの会話(`mygw`の`/lib/conversation-embed.html`) | 親ページ`nekoflare.workers.dev`の区画 | 親ページ`nekomaneki.work`の区画 | 6章 |

---

## 5. 同じ`nekomaneki.work`の下でもCookieを共有しない

**対象**: 独自ドメインの本体ワーカーと`mygw`が同じ`nekomaneki.work`の下にあること — `Domain=nekomaneki.work`でログインを共有する方式を採らない理由。

`auth_token`に`Domain=nekomaneki.work`を付ければ`mygw`にも届き、公開の入口の`/lib`を本体ワーカーのログインで開けるように見える。次の理由で採らない。

1. **すべてのサブドメインに送られる。** `r9`・`stream`・Redmine・ほかのWorkerなど、`nekomaneki.work`の下のすべてのホストにログインCookieが送られる。どれか1つから漏れれば、本体ワーカーの管理者として振る舞える。
2. **署名鍵をコンテナに渡すことになる。** `mygw`のApacheでJWTを検証するには、本体ワーカーの`JWT_SECRET`をコンテナに渡す必要がある。コンテナの中から、本体ワーカーの管理者のログインを偽造できるようになる。
3. **ワーカーのドメインでは使えない。** `workers.dev`は別のサイトなので、この方式は独自ドメインでしか働かず、2つのホストで動きが食い違う。
4. 2026-11-11の判断(`/lib`は管理者専用、公開の入口では拒否)を変えることになり、鍵の扱いも大規模改修に当たる(CLAUDE.md ルール45・37)。

---

## 6. 本体コンテナ(`mygw`)のCookie

**対象**: `mygw.nekomaneki.work`のlibが発行するCookie(2026-11-13のSPECの記録) — 本体ワーカーのホストによって分かれ方が変わる点。

| Cookie | 属性 | 用途 |
|---|---|---|
| `__Host-conversation-observer` | `Secure; HttpOnly; Path=/; SameSite=None; Partitioned`(`Domain`は付けられない) | 会話の閲覧のセッション(最長7日) |
| `__Host-conversation-console` | 同上 | 会話への投稿のセッション(15分〜7日から選ぶ) |

- `Partitioned`のCookieは、**埋め込んでいる親ページのサイトごと**に分けて保存される。本体ワーカーのページに埋め込んだ会話は、ワーカーのドメインのページ(`nekoflare.workers.dev`)と独自ドメインのページ(`nekomaneki.work`)で、閲覧・投稿のログインが共有されない。`mygw`を直接開いた場合も、さらに別の区画になる。
- ブラウザの仕様から言えることで、実際の挙動は確かめていない(未確認)。
- `__Host-`のCookieは`mygw`のホストに限られ、本体ワーカーの`auth_token`とは無関係である。本体ワーカーにログインしていても、会話のログインは別に要る。

---

## 7. アクセス制御のまとめ

**対象**: ホストと入口ごとの、アクセスできる人。

| 入口 | 確認するもの | アクセスできる人 |
|---|---|---|
| 本体ワーカーの画面・API(どちらのホストでも) | そのホストの`auth_token`とD1のセッション | そのホストでログインした人 |
| 本体ワーカーの`/cf-containers`・`/cf-containers/proxy/*`(どちらのホストでも) | 上に加え、GitHubのIDが`CF_DASHBOARD_ADMIN_GITHUB_IDS`に含まれるか | そのホストでログインした管理者 |
| `mygw`の`/lib/...`(公開) | 一律に拒否(署名付きのtunnels APIの2パスだけ例外) | だれも(403) |
| `mygw`の会話(`/lib/conversation-embed.html`など) | libの観測・投稿のセッション(`__Host-`のCookie) | 会話のログインをした人(本体ワーカーのログインとは別) |

---

## 8. 確認状況

**対象**: このSPECを書いたときに、実物・コードで確かめたこと、確かめていないこと。

| 確認したこと | 方法 |
|---|---|
| 独自ドメインが200、`1.cfw1`は応答なし、`mygw`の`/lib`は403 | 2026-11-15に実際に要求した |
| 本体ワーカーのCookieに`Domain`が無いこと、属性の一覧 | `src/`の`Set-Cookie`・`document.cookie`を洗い出した |
| `redirect_uri`がアクセスしたホストから作られること | `src/index.ts`のコード |
| CORSの許可リスト、同じオリジンかの確認の実装、`WORKER_BASE_URL` | コード |

確かめていないこと:

- 独自ドメインでGitHubのログインが通ること(GitHub側の許可するコールバックURLの設定は見ていない)。
- 埋め込みの会話の`Partitioned`のCookieの、実際のブラウザでの分かれ方。
- `r9`・Redmine・ほかのWorkerが発行するCookie(このSPECの範囲外)。

---

## 9. 未決事項

- 画面の設定のCookieのうち、`Secure`が無いものに`Secure`を付けて統一するか。
- `WORKER_BASE_URL`(Slackのリンクなど)を、独自ドメインに切り替えるか。切り替えるなら、ログインし直しが要る人が出る。
- 正式な入口をワーカーのドメインと独自ドメインのどちらにするか。決めれば、もう一方を案内しない運用にできる。
