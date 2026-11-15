# SPEC: 本体コンテナの /lib を、本体ワーカーにログインした管理者だけに見せる仕様(2026-11-15)

---

## 1. 背景と結論

**対象**: `https://mygw.nekomaneki.work/lib/...`(本体コンテナの`/lib`、SSIのページ)と、本体ワーカーの`/cf-containers/proxy/*` — 公開の入口では403になる`/lib`を、本体ワーカーへのログインを確かめたうえで使えるようにする方法を定める。

### 背景

- `https://mygw.nekomaneki.work/lib/ls_-la.shtml`は、つながるが403になる(2026-11-15に確認)。
- 「本体ワーカーにログインしているユーザーであることを検知して、アクセスを許可できないか」という要望があった。

### 結論

**新しい仕組みは作らない。すでにある本体ワーカー経由の入口(`/cf-containers/proxy/lib/...`)を使う。** この入口は、本体ワーカーのログインと管理者の確認を通った要求だけを、コンテナの中の`/lib`へ渡す。公開の入口(`mygw`)の403はそのまま残す。

---

## 2. 2つの入口

**対象**: 本体コンテナの`/lib`に届く経路 — 入口ごとに、誰が通れるかを分けて定める。

| 入口 | 経路 | `/lib`の扱い |
|---|---|---|
| 公開 `https://mygw.nekomaneki.work/lib/...` | Cloudflareのエッジ → トンネル → cloudflared → Apache(8443) | **一律に403**。2026-11-11のユーザー判断で、libは管理者専用にした(`containers/demo/apache-demo.conf`の`<LocationMatch "^/(?:debug|admin|lib)(?:/|$)">`で`Require all denied`)。例外は署名付きのtunnels APIの2パスだけ |
| 本体ワーカー経由 `https://cloudflare-workers-github-oauth-1.nekoflare.workers.dev/cf-containers/proxy/lib/...` | ログインの確認 → 管理者の確認 → Durable Object(`DEMO_CONTAINER`)→ コンテナの`server.js`(8080)→ 内部のApache(127.0.0.1:8445) | **ログイン済みの管理者だけが表示できる** |

公開の入口とワーカー経由の入口は、同じコンテナの同じ`/var/www/html/lib`を見る。違うのは、途中で誰が確認するかだけである。

---

## 3. 本体ワーカー経由の入口で行う確認

**対象**: `src/index.ts`の`app.all('/cf-containers/proxy/*', authMiddleware, cfDashboardAdminMiddleware, ...)`、`src/middleware/auth.ts`、`containers/demo/server.js`の`isLibPath`/`proxyToLib` — 要求が`/lib`に届くまでの確認の順番。

| 順番 | 確認するもの | 通らないとき |
|---|---|---|
| 1 | `authMiddleware`: 本体ワーカーのログイン(Cookie`auth_token`またはBearerのJWT)と、D1のセッション(強制失効していないか) | ログイン画面・401 |
| 2 | `cfDashboardAdminMiddleware`: ログインしたユーザーのGitHubのIDが、環境変数`CF_DASHBOARD_ADMIN_GITHUB_IDS`(カンマ区切り)に含まれるか | 未設定なら503「管理者設定が未構成です」、含まれなければ403「この操作には管理者権限が必要です」 |
| 3 | 転送先のパス: `/admin`と`/admin/...`は転送しない | 403「このパスはプロキシできません」 |
| 4 | Durable Objectがコンテナの8080へ転送し、`server.js`が`/lib`で始まるパスを内部のApache(127.0.0.1:8445)へ渡す | コンテナが止まっていれば502 |
| 5 | 内部のApache(`010-lib.conf`)が`Require local`で受け、SSI(`.shtml`)を展開する。拒否の表(`ops`・`keys`・ドットで始まるもの・`.env`など)はそのまま効く | 404・403 |

- **通れるのは「ログインしたユーザー」全員ではなく、管理者だけ**である。管理者でないログインユーザーは2で403になる。
- `server.js`の`/lib`の中継(8080)自身は、本体ワーカーのログインを確かめない。確認の境界は本体ワーカーにある。コンテナの中から8080を直接呼ぶ場合は、この確認を通らない(2026-11-13のSPECのとおり)。
- 1と2は、`/cf-containers`の画面と同じ確認である。`/cf-containers`を開ける人だけが、`/lib`も開ける。

---

## 4. 公開の入口で直接許可しない理由

**対象**: `mygw.nekomaneki.work`のApache — 本体ワーカーのログインをもとに、公開の入口の`/lib`を開ける方式を採らない理由。

1. **Cookieが届かない。** 本体ワーカー(`*.workers.dev`)のログインCookieは、別のドメインの`mygw.nekomaneki.work`には送られない。直接許可するには、本体ワーカーが短い期限の署名付きチケットを発行し、`mygw`のApacheがそれを検証して自分のCookieを発行する、という仕組みを新しく作る必要がある。
2. **2026-11-11の判断を変えることになる。** libを管理者専用にし、公開の入口では拒否すると決めている。
3. **大規模改修に当たる。** チケットの署名に`ORIGIN_HMAC_SECRET`を使えば、CLAUDE.md ルール45(この鍵は部分変更をしない)の対象になる。別の鍵を足すなら、ルール37(承認の無い設定・鍵を足さない)の対象になる。
4. **すでにある入口で足りる。** 本体ワーカー経由の入口が、要望の「ログインを検知して許可する」をそのまま満たしている。

---

## 5. 使い方

**対象**: 管理者が`/lib`のページを開く手順。

- 本体ワーカーにログインした状態で、`/lib/<ページ>`の前に`/cf-containers/proxy`を付けたURLを開く。
  - 例: `https://cloudflare-workers-github-oauth-1.nekoflare.workers.dev/cf-containers/proxy/lib/date.shtml`
- ページの中の相対リンク(`date.shtml`・`./api/...`など)は、同じ`/cf-containers/proxy/lib/`の下に解決されるので、そのまま動く。
- **注意**: ページの中に`/lib/...`のような絶対パスのリンクがあると、本体ワーカーの`/lib/...`(存在しない)を指してしまう。ワーカー経由で使うページは相対リンクで書く。

---

## 5.1 独自ドメイン(`1.wr1.nekomaneki.work`)で使う場合

**対象**: 本体ワーカーの独自ドメイン`https://1.wr1.nekomaneki.work/`(2026-11-15に200を確認) — `workers.dev`と同じ入口を独自ドメインで使うときに、別物になる点。

`/cf-containers/proxy/lib/...`はパスで決まる経路なので、ホストに関係なく同じように動く(例: `https://1.wr1.nekomaneki.work/cf-containers/proxy/lib/date.shtml`)。確認の内容(ログイン → 管理者 → コンテナ)も同じである。ただし、次の3点は`workers.dev`と別物になる。

| # | 別物になること | 理由 | 確認 |
|---|---|---|---|
| 1 | **ログインが別々。** `workers.dev`でログインしていても、独自ドメインではログインしていない扱いになる(逆も同じ)。PWAも別のアプリになる | ログインCookie`auth_token`に`Domain`が付いておらず、ログインしたホストにしか送られない(`src/utils/emailConfirm.ts`など)。GitHubのログインの戻り先も、アクセスしたホストから作る(`src/index.ts`の`redirect_uri`) | コードで確認 |
| 2 | **埋め込みの会話のログインも別々。** 本体のページに埋め込む`mygw`の会話の閲覧・投稿のログインは、`workers.dev`のページから開いた場合と独自ドメインから開いた場合で共有されない | 会話のCookie(`__Host-conversation-observer`など)は`Partitioned`で、ブラウザは埋め込んでいる親ページのサイトごとに分けて保存する | ブラウザの仕様から。実際の挙動は未確認 |
| 3 | **「同じドメインだからCookieを共有する」は採らない。** | 下記 | — |

### `Domain=nekomaneki.work`でCookieを共有しない理由

独自ドメインの本体ワーカーと`mygw`は、どちらも`nekomaneki.work`の下にある。ログインCookieに`Domain=nekomaneki.work`を付ければ`mygw`にも届くので、公開の入口の`/lib`を開けられるように見えるが、次の理由で採らない。

- ログインCookieが、`r9`・`stream`・Redmine・ほかのWorkerなど、`nekomaneki.work`の下の**すべて**のホストに送られる。どれか1つから漏れれば、本体ワーカーの管理者として振る舞える。
- `mygw`のApacheでCookie(JWT)を検証するには、本体ワーカーのJWTの署名鍵(`JWT_SECRET`)をコンテナに渡すことになる。コンテナの中から、本体ワーカーの管理者のログインを偽造できるようになる。
- 4章の理由(2026-11-11の判断の変更、鍵の扱いの大規模改修)もそのまま当てはまる。

独自ドメインでも、本体ワーカー経由の入口(`https://1.wr1.nekomaneki.work/cf-containers/proxy/lib/...`)を使う。

---

## 6. 2026-11-15の確認結果

**対象**: このSPECを書いたときに、実物で確かめたこと・確かめていないこと。

| 確認したこと | 結果 |
|---|---|
| 公開の`https://mygw.nekomaneki.work/lib/ls_-la.shtml` | 403 |
| 公開の`mygw`がこのコンテナに届いているか | 4回の要求が、4回ともこのコンテナのcloudflared・Apacheのログに届いた |
| コンテナの中で`server.js`(8080)経由の`/lib/date.shtml`・`/lib/ruby_-v.shtml` | 200(SSIが展開された) |
| コンテナの中で`server.js`経由の`/lib/ls_-la.shtml` | **404(ファイルが無い)**。公開の入口では、ファイルの有無を見る前に403で拒否するため、無いことが分からなかった |
| 本体ワーカーの独自ドメイン`https://1.wr1.nekomaneki.work/` | 200(有効)。`1.cfw1.nekomaneki.work`(`wrangler.toml`でコメントアウトされたWorker Routeの例)は応答なし |
| 配置されている`.shtml` | `/var/www/html/lib/`には`date.shtml`・`ruby_-v.shtml`の2つだけ。libリポジトリ(`/root/lib/`)には`ls.shtml`などがあるが、配置されていない |

確かめていないこと:

- 本体ワーカー経由の入口を、実際にログインして通すこと(ログインが要るため。コードとコンテナの中の応答で確かめた範囲)。
- 8080が外部から直接届くかという、ネットワーク全体の境界(2026-11-13のSPECでも未実施)。

---

## 7. 未決事項

- `ls -la`の結果を見るページを置くか。置くなら、libリポジトリの`ls.shtml`をコンテナの`/var/www/html/lib/`へ配置する(配置の仕組みはlib側。本体のリポジトリの変更ではない)。
- 管理者以外のログインユーザーにも見せるか。見せるなら、`cfDashboardAdminMiddleware`とは別の確認を作る必要がある。SSIはコマンドを実行できる(`exec`)ので、範囲を広げるかはユーザーが決める。

---

## 8. 関連

- [`SPEC.cloudflare-workers-github-oauth-1.20261113.lib-access-control.md`](SPEC.cloudflare-workers-github-oauth-1.20261113.lib-access-control.md): 入口ごとのlibのアクセス制御の全体(tunnels APIの例外、内部Apacheの拒否の表、libの閲覧・投稿の認証)
- [`SPEC.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.md`](SPEC.cloudflare-workers-github-oauth-1.20261114.fixed-domain-ingress-worker-assets.md): 固定ドメインのトンネルの入口と、Workerのルートの区別
