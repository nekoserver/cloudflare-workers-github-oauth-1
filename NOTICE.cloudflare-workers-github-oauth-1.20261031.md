# NOTICE 2026-10-31: T3 Code のログインと PWA 化で分かったこと

T3 Code(コンテナ内の T3 0.1.3、`t3.nekomaneki.work`)のログインを PWA に引き継ぐ作業で、3日かけて分かったこと。仕様は [`SPEC.cloudflare-workers-github-oauth-1.T3-PWA.20261031.md`](SPEC.cloudflare-workers-github-oauth-1.T3-PWA.20261031.md) を参照。

## 1. T3 の挙動は推測せず、配布物のソースで確かめる

- T3 のバイナリには、サーバーとクライアントの JS が埋め込まれている。チェックサムを照合した tarball を展開して `strings` で読めば、関数ごとに確かめられる。
- 推測で外した実例:
  - 認証に失敗すると 401 が返ると思い込んだ。実際は、`/api/auth/session` は 200 の `{authenticated:false}` を返す。
  - ペアリングのトークンの期限(既定5分、1回限り)を知らず、期限切れのトークンを使わせた。
- 確かめた挙動は、契約テスト(`src/cf-containers-t3-contract.test.ts` など)に書いておく。版を上げるときは、テストを先に直す(ルール43)。

## 2. 2つのエラーは、失敗した段階が違う

| 表示 | 失敗した段階 | 主な原因 |
|---|---|---|
| `Invalid pairing token. Check the token and try again.` | トークンの交換(`POST /api/auth/browser-session`) | トークンが未知・使用済み・期限切れ |
| `Timed out waiting for authenticated session after bootstrap.` | 交換の後の `/api/auth/session`(2秒待つ) | クッキーが保存されないか、送られないか、拒否された |

- 後者は、トークンの問題ではない。トークンを作り直しても直らない。

## 3. 中継で Host を書き換えるときは、X-Forwarded-Host を渡す

- T3 は、クッキーで届いたセッションを、Origin のホストが `Host` か `X-Forwarded-Host` と一致するときだけ受け付ける(`isBrowserOriginAllowed`)。
- 中継(`t3-embed-proxy.cjs`)は `Host` を `127.0.0.1:3773` に書き換えるので、元のホストを `X-Forwarded-Host` で渡さないと、発行した直後のクッキーが拒否される(#2505)。
- 拒否されると `authenticated:false` が返る。中継はそれを古いセッションとみなして、クッキーを消す。そのため、症状がさらに分かりにくくなる。

## 4. iOS の Safari は、iframe の中のクッキーに頼れない

- tree-view(dynamicneko)は T3 を iframe で表示している。iOS の Safari では、iframe の中でペアリングに成功しても、クッキーが保存されないか送られず、`Timed out…` で止まった(本番で発生)。
- Partitioned 付きのクッキーを返しても、解決しなかった。
- 対処として、iframe ではクッキーを使わないようにした。コンテナが Bearer トークン(`t3 auth session issue --json`)を発行し、iframe を `/#t3-bearer=<トークン>&expires=<UNIX秒>` で開く。差し込んだスクリプトが、このトークンを `Authorization` で送る。
- T3 は、クッキー → Bearer の順に資格情報を選ぶ(`selectRequestCredential`)。古いクッキーが残っていると Bearer より優先されるので、Bearer を送る通信では `credentials: 'omit'` にする。

## 5. iOS の PWA は、Safari ともほかの PWA ともクッキーを共有しない

- Safari でログインしても、ホーム画面の PWA はログインしていない状態で起動する。
- ログインを PWA へ持ち込むことはできない。PWA の中で、新しくペアリングするしかない。
- そこで、ログイン済みのブラウザを中継が見た接続元と、PWA の申請の接続元が同じで、5分以内なら、コンテナの CLI でペアリングを発行して自動で承認するようにした(#2503)。この方法で、T3 単独の PWA にはトークンを入力せずに引き継げた(本番で確認)。

## 6. 利用者に確認や承認をさせない

- 「状態を確認する」ボタンや承認ボタンのように、確認の作業を利用者に回すと、手続きが止まる。ユーザーから「確認はアプリ側の仕事」と指摘された。
- 失敗したときは、自動で診断して、原因と対処を表示する。画面の文言でも、利用者に「確かめてください」と指図しない。

## 7. テストは、実際の動作を確かめる

- 作り物の DOM で行ったテストは通っても、画面の不具合を捕まえられなかった。
- 実際のブラウザ(Playwright と Chromium)で、偽の T3、本物の中継、iframe の順につなぐテストを追加した(`src/cf-containers-t3-pwa-diagnose-browser.test.ts`)。
- 中継の CSP(`frame-ancestors`)が許すのは、`http://127.0.0.1:4173` と dynamicneko だけ。そのため、iframe を使うテストの親ページはポート 4173 で開く。
- このサンドボックスにある Playwright は、リポジトリの Playwright と版が違う。そのため `executablePath: '/opt/pw-browsers/chromium'` を指定する。

## 8. 確かめていないこと

- 本番の経路(cloudflared)で、`CF-Connecting-IP` が届いているか。届いていなければ、接続元はすべてトンネルの IP になり、自動承認が別の端末を区別できない。
- iframe での Bearer 方式が、iPhone の実機で動くか。
