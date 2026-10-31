# T3 Code のログインと PWA 化(2系統)の仕様

2026-10-31 時点の仕様。T3 Code(コンテナ内、`t3.nekomaneki.work`)に、トークンの手入力も承認の操作もなしでログインするための仕組みを、PWA 化の2つの系統に分けてまとめる。

- **系統A: tree-view の PWA**(dynamicneko `https://dynamicneko.nekoflare.workers.dev`。tree-view の中の T3 タブで使う)
- **系統B: T3 単独の PWA**(`https://t3.nekomaneki.work` をホーム画面に追加したもの)

| 項目 | 系統A: tree-view の PWA | 系統B: T3 単独の PWA |
|---|---|---|
| T3 の表示場所 | tree-view の T3 タブの iframe | PWA の画面そのもの(最上位) |
| 本人の確認 | tree-view の GitHub ログイン(管理者 `nekoserver` だけ) | 同じ接続元にいる、ログイン済みのブラウザ |
| ログインの方法 | 開くたびに新しいペアリング URL で iframe を開く | 引き継ぎの申請を自動で承認し、PWA の中でペアリングする |
| 利用者の操作 | なし | なし(自動承認が効かないときだけ、承認のリンクを開いて承認する) |
| クッキーの保存場所 | dynamicneko の下に分けて保存される(Partitioned) | t3.nekomaneki.work の PWA 自身 |

---

## 1. 共通: T3 のペアリングの契約(T3 0.1.3)

**対象**: コンテナ内の T3 0.1.3(`/root/.t3/runtime/versions/0.1.3/t3`)、`containers/demo/server.js` の `POST /t3/pairing`、`containers/demo/t3-embed-proxy.cjs` — 両方の系統が使う、T3 の挙動と中継の前提。

### 背景
3日間、T3 の挙動を確かめないまま推測で直し、外し続けた。T3 0.1.3 の配布物(チェックサムで照合した tarball に埋め込まれた JS)から確かめた事実を、ここに固定する。

### 確かめた T3 の挙動
| 項目 | 内容 | 根拠(T3 0.1.3 の関数) |
|---|---|---|
| ペアリングの発行 | `t3 auth pairing create --json [--label L] [--base-url U]` は `{id, credential, scopes, expiresAt, pairUrl}` を出す。`pairUrl` は `<U>/pair#token=<credential>` | `pairingCreateCommand`, `formatIssuedPairingCredential` |
| 期限と回数 | 既定5分、1回限り。CLI と稼働中のサーバーは同じ DB(`~/.t3`)を使う | `PairingGrantStore.issueOneTimeToken`, `consume` |
| 「Invalid pairing token」 | 交換(`POST /api/auth/browser-session`)で `invalid_credential` が返ったとき。原因は、未知・使用済み・期限切れ・失効のいずれか | `PairingGrantStore.consume`, client の `PrimaryEnvironmentPairingCredentialRejectedError` |
| 「Timed out waiting for authenticated session after bootstrap.」 | 交換は成功したが、その後の `/api/auth/session` で認証済みにならなかった(2秒、100ms ごとに確認) | client の `PrimaryEnvironmentAuthSessionTimeoutError` |
| クッキーの受け付け | クッキーのセッションは、Origin のホストが `Host` か `X-Forwarded-Host` と一致するとき(または `Sec-Fetch-Site: same-origin` のとき)だけ受け付ける | `isBrowserOriginAllowed` |
| 認証に失敗したとき | `/api/auth/session` は 200 の `{authenticated:false}`、ほかの API は 401 | `getSessionState` |
| 資格情報の優先順 | クッキー → Bearer → DPoP の順に、最初に見つかったものを使う | `selectRequestCredential` |

### 中継(`t3-embed-proxy.cjs`、127.0.0.1:3774 → T3 127.0.0.1:3773)の前提
- `Host` を `127.0.0.1:3773` に書き換えるので、元のホストを `X-Forwarded-Host` で渡す。渡さないと、発行した直後のクッキーが拒否されて、上の「Timed out…」になる(#2505)。
- T3 のクッキーは、Partitioned 付きと無しの2つの形で返す(#2497)。
- T3 が拒否した古いセッションのクッキーは削除する(#2494)。

### 修正内容
| ファイル | 変更 |
|---|---|
| `containers/demo/server.js` | `POST /t3/pairing`: `t3 auth pairing create --json --label one-click --base-url https://t3.nekomaneki.work` を実行し、`{ok, pairUrl, expiresAt}` を返す。失敗したときは `{ok:false, errorCode, detail, remedy}` を返す。届くのは Worker のコンテナ連携からだけ(#2501) |
| `containers/demo/t3-embed-proxy.cjs` | `X-Forwarded-Host` に元のホストを入れる(#2505) |

### 関連コミット
- [`b06a288c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b06a288c) T3: /cf-containersのボタン1つで、トークン入力なしにT3へログインできるようにする
- [`5247251d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5247251d) T3: 中継が元のホストをX-Forwarded-HostでT3に渡し、発行直後のクッキーが拒否されないようにする

---

## 2. 系統A: tree-view の PWA(T3 タブで自動ログイン)

**対象**: dynamicneko の `POST /api/tree-view/t3/pairing` と `src/components/tree-view-container-chat.tsx`、本体 Worker の `POST /api/tree-view/t3-power-external`(`action: "pairing"`)— tree-view の GitHub ログインのまま、T3 タブの iframe を T3 にログインした状態で開く。

### 背景
tree-view はログインしないと使えないページなので、本人の確認はすでに済んでいる。それなのに、T3 タブでは毎回 `t3 pair` のトークンを入力させていた。

### 流れ
1. T3 タブが表示され、T3 サーバーが起動していると確認できたら、dynamicneko の画面が `POST /api/tree-view/t3/pairing` を呼ぶ。同じ origin からの依頼に限る。
2. dynamicneko のサーバーは、セッションが管理者のものかを確かめてから、本体 Worker の `/api/tree-view/t3-power-external` を `{action:"pairing", userToken}` で呼ぶ。経路は Service Binding の `MAIN_WORKER`、署名は `CF_WORKER_SECRET_MAIN` による `CF-Worker` と HMAC(ルール38)。
3. 本体 Worker は、署名と `userToken`(ログイン名が `nekoserver`)を確かめてから、コンテナの `POST /t3/pairing` を呼んで `{pairUrl, expiresAt}` を返す。
4. 画面は、`pairUrl` が T3 の接続先(`TREE_VIEW_CONTAINER_ORIGIN`)の `/pair#token=` で始まることを確かめ、iframe の `src` にする。T3 の画面がペアリングして、そのまま開く。
5. 失敗したときは、原因(`error`・`detail`)と対処(`remedy`)を画面に出し、T3 の標準画面(`origin + "/"`)で開く。

### 注意事項
- タブを開き直すたびに、新しいペアリング(T3 のセッション)を作る。
- iframe の中のクッキーは、dynamicneko の下に分けて保存される(Partitioned)。そのため、このログインを Safari の最上位の画面や、系統B の PWA から直接は使えない。系統B は、このログインを接続元として使う(3章)。
- 新しいシークレットや環境変数は追加していない(既存の `CF_WORKER_SECRET_MAIN` と `DYNAMICNEKO_WORKER_HMAC_SECRET` を使う)。

### 修正内容
| リポジトリ | ファイル | 変更 |
|---|---|---|
| 本体 | `src/routes/treeViewT3Power.ts` | `pairing` アクション: コンテナの `/t3/pairing` を呼び、URL か、原因と対処を返す |
| dynamicneko | `src/server.ts` | `POST /api/tree-view/t3/pairing`(管理者・同じ origin に限る) |
| dynamicneko | `src/components/tree-view-container-chat.tsx` | ペアリング URL で iframe を開く。失敗したら原因を出して標準の画面で開く |

### 関連コミット
- [`879cc6bb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/879cc6bb) tree-view: dynamicnekoのログインのまま、T3のペアリングURLを発行するpairingアクションを追加
- dynamicneko [`8627176`](https://github.com/nekoserver/dynamicneko/commit/8627176) tree-view: ログイン済みのまま、T3のiframeをペアリングURLで開いて自動でT3に入る

---

## 3. 系統B: T3 単独の PWA(ログイン済みのブラウザから自動で引き継ぐ)

**対象**: `containers/demo/t3-pwa-auth.cjs`(`/_t3/pwa/*`)、`containers/demo/t3-pwa-client.js`(PWA の画面に差し込むスクリプト)、`containers/demo/t3-embed-proxy.cjs` — PWA は Safari とクッキーを共有しないので、ログイン済みのブラウザの代わりに、コンテナが PWA 用のペアリングを発行する。

### 背景
iOS の PWA は、Safari ともほかの PWA ともクッキーを共有しない。tree-view の T3 タブでログインした状態を PWA に持ち込もうとすると、トークンが合わずに失敗していた。また、「状態を確認する」ボタンや承認ボタンのように、確認や承認の操作を利用者にさせていた。

### 流れ
1. 中継は、T3 の `GET /api/auth/session` が `authenticated:true` を返した要求を見るたびに、その接続元 IP(`CF-Connecting-IP`)を記録する(`noteOwner`)。記録するのは HMAC の署名だけで、置き場所はメモリだけ。系統A の T3 タブや、最上位で開いたブラウザでのログインが、これにあたる。
2. PWA を開いてセッションが無いと、差し込んだスクリプトが引き継ぎを申請する(`POST /_t3/pwa/create`、PWA だけが知る secret を付ける)。
3. 同じ接続元を5分以内に記録していれば、中継はその場で、CLI(`t3 auth pairing create --json --label tree-view-pwa:<id>`)でペアリングを発行し、申請を `approved` にする(`approved_by='auto-same-ip'`)。
4. PWA は申請の状態を確かめ(`/status`)、承認済みならペアリングの資格情報を受け取る(`/claim`、1回限り)。`/#token=<資格情報>` を付けて T3 の画面を起動すると、T3 が自動でペアリングする。
5. 自動で承認できなかったときは、申請を承認待ちのまま残す。原因は `create` の応答の `autoApproval` に入れる。そのときは、ログイン済みのブラウザで承認のリンク(`/_t3/pwa/approve/<id>`)を開いて承認する。
6. どの段階で失敗しても、スクリプトが自動で `/_t3/pwa/diagnose` を呼び、項目ごとに OK か、だめなら理由と対処を表示する。確認のためのボタンは置かない。項目は、引き継ぎの設定、T3 本体、このブラウザの T3 のログイン、最近の申請の4つ。

### 自動承認の条件
| 条件 | 自動承認 |
|---|---|
| 同じ接続元 IP で、5分以内にログイン済みのブラウザを見た | する |
| 別の接続元 IP(例: 携帯の回線と Wi-Fi) | しない(承認待ち) |
| 最後にログイン済みのブラウザを見てから5分を過ぎた | しない(承認待ち) |
| 見たのは未ログインのブラウザ(`authenticated:false`)だけ | しない(承認待ち) |
| CLI での発行に失敗した | しない(承認待ち。`autoApproval.ok=false` と `detail`) |

### 前提
- 引き継ぎを有効にする設定ファイル `/root/.t3/userdata/pwa-handoff/config.json` は、中継の起動時に無ければ作られる(`ensureHandoffConfig`、結果は `/tmp/t3-proxy.log` の `T3 PWA handoff config:` の行)。
- 申請の期限は5分。資格情報は DB に保存せず、プロセスのメモリにだけ置く。
- 画面の文言では、利用者に確認や承認を指図しない。起きたことと原因だけを伝える。

### 修正内容
| ファイル | 変更 |
|---|---|
| `containers/demo/t3-pwa-auth.cjs` | ペアリングによる引き継ぎ(#2500)、同じ接続元の自動承認(`noteOwner`、`mintAutoPairing`)、失敗の理由と対処(`HANDOFF_REASONS`)、診断(`/diagnose`) |
| `containers/demo/t3-embed-proxy.cjs` | `/api/auth/session` が認証済みなら `noteOwner` を呼ぶ。起動時に `ensureHandoffConfig` を呼ぶ |
| `containers/demo/t3-pwa-client.js` | 申請、受け取り、`/#token=` での起動。失敗したら自動で診断する。「状態を確認する」ボタンは廃止した |

### 関連コミット
- [`5f6b3ade`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5f6b3ade) T3: PWAへのログインの引き継ぎを、T3本来のペアリングで動くように作り直す
- [`fb302d82`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fb302d82) T3: 引き継ぎの失敗のたびに理由と対処を返し、PWAに診断を出す
- [`75b6f2dc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/75b6f2dc) T3 PWA: 「状態を確認する」を押したらすぐ確認中を出し、結果の位置まで画面を動かす
- [`56f78bd3`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/56f78bd3) T3 PWA: 「状態を確認する」ボタンを廃止し、失敗したら自動で診断して結果を表示する
- [`9ab2963f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/9ab2963f) T3 PWA: 画面の文言から利用者への確認の指図を除き、事実だけを伝える
- [`f86b1b07`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f86b1b07) T3 PWA: ログイン済みのブラウザと同じ接続元から5分以内の申請は、承認ボタンなしで自動承認する

---

## 4. テスト

| テスト | 検査する内容 |
|---|---|
| `src/cf-containers-t3-one-click-pairing.test.ts` | `/t3/pairing` の CLI 引数、成功時の URL、CLI の失敗、想定外の出力(別の版を疑う) |
| `src/cf-containers-t3-forwarded-host.test.ts` | T3 が受け取る `X-Forwarded-Host` が、Origin のホストと一致する |
| `src/routes/treeViewT3Power.test.ts` | `pairing` アクション: 管理者だけ、署名が要る、原因と対処を返す |
| dynamicneko `test/tree-view-t3-pairing.test.ts` | 管理者と origin の制限、`pairing` の中継、原因と対処の保持 |
| dynamicneko `test/tree-view-t3-tab.browser.test.tsx` | iframe がペアリング URL で開く |
| `src/cf-containers-t3-pwa-auto-approve.test.ts` | 本物の中継と偽の T3 で、自動承認の5つの条件を検査する |
| `src/cf-containers-t3-pwa-handoff*.test.ts` | 申請・承認・受け取り、失敗の理由と対処、ボタンが無いこと |
| `src/cf-containers-t3-pwa-diagnose-browser.test.ts` | 実際のブラウザ(Chromium)で、操作なしで診断の結果が出る |
| `src/cf-containers-t3-contract.test.ts` | Dockerfile の T3 の版と、契約を確かめた版(0.1.3)が同じ |

---

## 5. 確かめていないこと(2026-10-31 時点)

- iPhone の実機での、系統A と系統B の動作
- 「Timed out waiting for authenticated session after bootstrap.」の本当の原因が、`X-Forwarded-Host` の欠落だったかどうか(T3 のソースからの推定)
- iOS の Safari が、埋め込み(iframe)の中で Partitioned のクッキーを保存するかどうか。保存しない場合、系統A はクッキーを使わない方式(Bearer)に切り替える必要がある
- 本番の経路(cloudflared)で、`CF-Connecting-IP` が届いているかどうか(届かなければ接続元はトンネルの IP になり、別の端末を区別できない)
- コンテナを作り直すと、T3 と Codex の状態が消える問題(課題A、#2495 の設計案。R2 と暗号鍵の承認が必要)

## 6. T3 の版を上げるとき

ルール43に従い、1章の「確かめた T3 の挙動」の各項目を新しい版のソースで確かめ直す。契約テストの版を先に上げてから、Dockerfile の版を上げる。
