# SPEC.cloudflare-workers-github-oauth-1.20261008.worker-auth-policy

## ワーカー間リクエストの認証方式の現状分析と、CF-Workerヘッダー+HMAC照合への統一方針

**対象**: `src/index.ts`内の`/api/*-external`系エンドポイント群・`/webhook/github`・
`/api/settings/slack-notify`・`src/utils/notifyDispatch.ts`(cf-auth宛送信)・
`src/utils/webhookSlackSettingDiagnostics.ts`(cf-auth宛送信)・`src/utils/redmineProxy.ts`・
`src/utils/githubWebhook.ts` — 本Workerと他Worker(`nekoserver/dynamicneko`・`nekoserver/cf-auth`・
`rust-worker-sqlx-d1`)の間で送受信するリクエストの認証方式一覧と、それを「`CF-Worker`ヘッダーで
呼び出し元を名乗り、HMAC照合で検証する」方式へ統一できるかどうかの分析。**本SPECは分析・方針の
記録のみで、既存エンドポイントの実装はまだ変更していない**(移行は別タスク)。

### 背景

ユーザーから「ワーカー間リクエストのポリシーとしてCF-WorkerとHMAC照合を基準にしたい」という方針が
示され、現状分析とSPECへのまとめ、統一できそうならCLAUDE.mdへの明文化を依頼された。

### 現状分析: 本Workerが関わるワーカー間認証の実態

現在、ワーカー間(本Worker ⇄ dynamicneko/cf-auth/rust-worker-sqlx-d1)のリクエストは、
**機能ごとに異なる認証方式が個別に実装されており、統一されていない**。

| # | 方式 | 対象(本Worker側) | 件数 | 署名対象 | リプレイ対策 | 呼び出し元の識別 |
|---|---|---|---|---|---|---|
| 1 | 静的共有シークレットのBearer照合(単純`===`比較) | `/api/tsubuyaki-external`・`/api/aichat/*-external`(`AICHAT_EXTERNAL_SECRET`)、`/api/kimi-code/generate-external`(`KIMI_CODE_EXTERNAL_SECRET`)、`/api/jev-playground-external`(`JEV_PLAYGROUND_EXTERNAL_SECRET`)等 | 22エンドポイント(`-external`サフィックスのGET/POST合計、`grep`実測) | なし(本文は署名対象外) | なし | 不可(シークレットを知っていれば誰でも同一に見える。機能ごとに別シークレットのため、機能単位では区別できるが呼び出し元Worker単位では区別できない) |
| 2 | 静的共有シークレットのBearer照合(cf-auth⇄本Worker) | `/api/settings/slack-notify`(受信、`CF_AUTH_WEBHOOK_SECRET`)/ `src/utils/notifyDispatch.ts`・`webhookSlackSettingDiagnostics.ts`(送信、`NOTIFY_WORKER_SECRET`) | 双方向で計3箇所 | なし | なし | 不可(#1と同様) |
| 3 | 実HMAC-SHA256(タイムスタンプ・nonce・メソッド・パス・本文を含めて署名) | `src/utils/redmineProxy.ts`の`redmineSignature`(Redmine Apache HMACゲートウェイ宛、`REDMINE_HMAC_SECRET`) | 1箇所 | method+path+timestamp+nonce+apiKey+contentType+body | タイムスタンプ+nonceで対応済み | シークレットの持ち主のみ(Redmineゲートウェイとの1:1、Workerを識別する概念自体がない) |
| 4 | 実HMAC-SHA256(本文のみ署名、タイミングセーフ比較) | `/webhook/github`の`verifyGitHubWebhookSignature`(`GITHUB_WEBHOOK_SECRET`、GitHub標準の`X-Hub-Signature-256`形式) | 1箇所 | 本文(rawBody)のみ | なし(GitHub Webhook標準に準拠、GitHub以外からの転送は想定外) | GitHubからの配信であること自体のみ(個別Workerの識別ではない) |
| 5 | rust-worker-sqlx-d1側でのみ実HMAC署名(本Workerは関与せず) | `src/utils/tunnelSignerAsk.ts`経由の`/neko askgk`(`ORIGIN_HMAC_SECRET`はrust-worker-sqlx-d1側の環境変数で、本Workerはシークレットを一切扱わない) | 1箇所(本Workerからは中継のみ) | rust-worker-sqlx-d1側の実装次第(本リポジトリからは見えない) | 不明(他リポジトリのため本SPECの調査対象外) | 不明 |

**まとめると**:
- 「Workerの身元を示すヘッダー(`CF-Worker`等)」は**現状どこにも存在しない**。識別はすべて
  「どの共有シークレットを提示したか」で行われており、シークレットの値そのものが身元の代用に
  なっている(機能ごとに別シークレットを発行することで、実質的に「身元」を分けている)。
- 「HMAC照合」を実際に行っているのは#3(Redmine)と#4(GitHub Webhook)の2箇所だけで、
  本Worker⇄dynamicneko/cf-auth間(#1・#2、合計25箇所)はすべて**生シークレットの文字列比較**
  であり、リクエスト本文は署名の対象になっていない(本文を改ざんされても検出できない)。
- #1の一部(`AICHAT_EXTERNAL_SECRET`)は単純な`!==`比較で、タイミングセーフ比較になっていない
  (`verifyGitHubWebhookSignature`のような`mismatch |= ...`形式の定数時間比較を使っていない)。

### 提案: `CF-Worker`ヘッダー + HMAC照合への統一方針

ユーザー要望の「CF-WorkerとHMAC照合を基準にしたい」を踏まえ、以下の統一ポリシーを提案する。

#### リクエストヘッダー(呼び出し元Worker → 本Worker)

```
CF-Worker: dynamicneko
CF-Worker-Timestamp: 1733654400
CF-Worker-Signature: sha256=<hex>
```

- `CF-Worker`: 呼び出し元Worker名(`dynamicneko` / `cf-auth` / `rust-worker-sqlx-d1` 等の固定値)。
  これにより、ログ・診断時に「どのWorkerからの呼び出しか」が一目でわかるようになる(現状はログに
  残らない)。
- `CF-Worker-Timestamp`: UNIXタイムスタンプ(秒)。受信側は現在時刻との差が一定範囲
  (例: ±5分、Redmineの`redmineSignature`と同程度)を超えたリクエストを拒否し、リプレイ攻撃を防ぐ。
- `CF-Worker-Signature`: `HMAC-SHA256(secret, "{CF-Worker}\n{CF-Worker-Timestamp}\n{METHOD}\n{PATH}\n{rawBody}")`
  の16進数表現。`verifyGitHubWebhookSignature`と同じ`crypto.subtle`によるHMAC計算+
  タイミングセーフ比較(`mismatch |= a ^ b`形式)を使う。

#### シークレットの単位

`CF-Worker`ヘッダーの値ごとに個別の環境変数シークレットを持つ(例:
`CF_WORKER_SECRET_DYNAMICNEKO`・`CF_WORKER_SECRET_CF_AUTH`)。現状の「機能ごとに別シークレット」
(`AICHAT_EXTERNAL_SECRET`・`KIMI_CODE_EXTERNAL_SECRET`・`JEV_PLAYGROUND_EXTERNAL_SECRET`等)を
「呼び出し元Workerごとに1つのシークレット」へ統合できる。これにより、同じdynamicnekoからの
呼び出しであれば`/api/tsubuyaki-external`も`/api/kimi-code/generate-external`も同じシークレットで
認証でき、新しい`-external`エンドポイントを追加するたびに新しいシークレット環境変数を発行する
運用(現状)が不要になる。

#### 検証ロジックの共通化

現状、`/api/tsubuyaki-external`等の各エンドポイントで個別に書かれている
```ts
const expected = c.env.AICHAT_EXTERNAL_SECRET ? `Bearer ${c.env.AICHAT_EXTERNAL_SECRET}` : null;
if (!expected || auth !== expected) { return jsonUtf8({ error: 'Unauthorized' }, 401); }
```
のようなコードを、`verifyGitHubWebhookSignature`と同様の共通関数(例:
`verifyWorkerRequestSignature(c.env, callerName, timestamp, method, path, rawBody, signatureHeader)`)
に一本化し、Honoのミドルウェアとして`/api/*-external`配下にまとめて適用できるようにする
(現状の個別`if`による重複実装を解消する)。

### 統一できそうかどうかの判定

**統一可能、かつ望ましい**と判断する。理由:

1. 本Worker側のコードは全箇所`src/index.ts`・`src/utils/*.ts`に収まっており、改修範囲は本リポジトリ
   内に限定できる(#5のrust-worker-sqlx-d1側の実装詳細は見えないが、`askTunnelSigner`は本Workerから
   シークレットを一切扱わない中継役のため、本ポリシーへの統一対象には含めない)。
2. 既存の「機能ごとに別シークレット」という設計は、呼び出し元が増えるたびにシークレットが増える
   構造になっており、`CF-Worker`ヘッダーによる呼び出し元単位への統合で見通しが良くなる。
3. タイミングセーフ比較・タイムスタンプによるリプレイ対策は、`verifyGitHubWebhookSignature`・
   `redmineSignature`という実装済みの先例をほぼそのまま転用できるため、実装コストは低い。

### 移行方針(今後の実施事項、本SPEC執筆時点では未実装)

- 新しい共通検証関数(`verifyWorkerRequestSignature`)を`src/utils/`に追加し、まずは**新規に
  追加する`-external`エンドポイントから**この方式を使う(既存22エンドポイントの一括移行は、
  呼び出し元(dynamicneko/cf-auth/rust-worker-sqlx-d1)側の送信コードも同時に変更する必要があり、
  相手リポジトリとの協調が要るため、別タスクとして扱う)。
- 既存の`AICHAT_EXTERNAL_SECRET`等の静的Bearer方式は、呼び出し元の移行が完了するまで**後方互換の
  ため並行稼働**させる。両方式を同時にサポートする検証関数にするか、エンドポイントごとに
  移行完了を確認してから静的Bearer方式のコードを削除する。
- `CF_AUTH_WEBHOOK_SECRET`・`NOTIFY_WORKER_SECRET`(cf-auth⇄本Worker)は双方向に実装があるため、
  最初の移行対象として適している(影響範囲が小さく、両方向のコードが本リポジトリと
  `nekoserver/dynamicneko`の両方に閉じている)。

### 関連

ユーザーからの依頼「ワーカー間リクエストのポリシーとしてCF-WorkerとHMAC照合を基準にしたい」への
現状分析・方針まとめ。CLAUDE.mdへの明文化は別途ルールとして追記した。
