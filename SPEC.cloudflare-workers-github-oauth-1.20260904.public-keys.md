# SPEC 2026-09-04: 公開鍵登録・チャレンジ署名ログイン(/public-keys)

## 1. 概要と目的

**対象**: `/public-keys` ページ、`/login` ページのパスキー的ログイン導線、
`POST /api/public-keys*`・`POST /auth/public-key/*` エンドポイント、
D1 `user_public_keys`・`public_key_challenges`・`login_history` テーブル。

ブラウザ内で生成したECDSA(P-256)鍵ペアの公開鍵をサーバーに登録し、以後は
GitHub OAuthを経由せず「サーバーが発行したチャレンジ文字列への署名」で
本人確認する仕組み(パスキーに近いチャレンジ・レスポンス認証)。秘密鍵は
生成したブラウザのIndexedDBに閉じており、サーバーには一切送信されない。

## 2. 鍵ペアの生成・保存(ブラウザ側)

**対象**: `src/views/publicKeys.ts`(鍵ペア生成・IndexedDB保存ロジック)。

- `crypto.subtle.generateKey({name:'ECDSA', namedCurve:'P-256'}, true, ['sign','verify'])`
  でその場で鍵ペアを生成する。`extractable:true`のため理論上はexportKeyで
  秘密鍵を取り出せるが、画面上にそのためのUIは無い。
- IndexedDB `public-key-auth` データベース、`keypairs` オブジェクトストアに
  `{ keyPair, userId, label }` の形で保存する(キーはサーバー発行の`key.id`)。
  `userId`はログイン中のユーザー名を保存時に埋め込む(`/login`のパスキー
  ログイン一覧が、どのアカウント宛のチャレンジを取得すべきか判断するため)。
- 公開鍵のみを `crypto.subtle.exportKey('jwk', keyPair.publicKey)` で書き出し、
  `POST /api/public-keys` に送って登録する。

### 2.1 旧形式データの互換

初期実装ではIndexedDBの値がCryptoKeyPairそのもの(ラップ無し)だった。
その後 `{keyPair, userId, label}` 形式に変更したため、変更前に登録した鍵は
`userId`を持たず、`/login`のパスキーログイン一覧が壊れる不具合があった
([`7eb8803`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7eb8803)で修正)。

- `loadKeyPair`系は `req.result.keyPair || req.result` で新旧どちらの形式でも
  秘密鍵を読めるようにしている。
- `/public-keys` を開くたびに `migrateLegacyKeyPairs()` が、サーバー側の
  登録済み一覧と突き合わせて旧形式エントリを新形式へ自動的に書き換える。
- `/login` は `userId` の無い(未移行の)エントリを一覧から除外し、
  壊れたボタンを表示しない。

## 3. D1スキーマ

**対象**: `migrations/0121`〜`0124`、`migrations/0127`(mainとの合流で番号が
0125→0127へ振り直された)。

| テーブル | 主なカラム | 用途 |
|---|---|---|
| `user_public_keys` | `id`(PK), `user_id`, `label`, `public_key_jwk`, `created_at`, `last_used_at`, `revoked_at`, `expires_at` | 登録済み公開鍵(JWK文字列)本体 |
| `public_key_challenges` | `id`(PK), `user_id`, `key_id`, `challenge`, `created_at`, `expires_at`, `used_at` | ログイン・照合テストごとに発行するワンタイムチャレンジ |
| `login_history` | `id`(PK), `user_id`, `method`, `created_at` | ログイン方式(`github_oauth`/`public_key`)の全履歴ログ |
| `user_sessions.last_login_method` | (既存テーブルへのADD COLUMN) | 直近1回のログイン方式(画面表示用の高速参照) |

`expires_at`は `user_public_keys` にのみ存在し、`public_key_challenges`の
`expires_at`(ワンタイムチャレンジの5分間TTL)とは別物。

## 4. 公開鍵の登録・失効・有効期限

**対象**: `POST /api/public-keys`・`GET /api/public-keys`・
`POST /api/public-keys/:id/revoke`、`src/utils/publicKeyAuth.ts`。

- 登録時、`isValidEcPublicKeyJwk()` で「ECDSA P-256の公開鍵JWKであり、
  秘密鍵成分(`d`)を含まないこと」を検証する。秘密鍵が誤って送られてきた
  場合は拒否する。
- 有効期限は登録フォームで `30日 / 90日 / 1年 / 2年 / 5年 / 無期限` から選択する
  (既定値は無期限)。`resolvePublicKeyExpiryDays()`が不正な値をすべて
  無期限にフォールバックするため、想定外の値で短命化する事故は起きない
  ([`60fd090`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/60fd090))。
- 失効(`revoked_at`)は本人のみ、`user_id`で絞り込んだUPDATEで行う。
- 一覧(`/public-keys`)では `失効済み` / `期限切れ` / `有効` の3状態を
  バッジで区別する。期限切れの鍵は「照合テスト」ボタンも無効化される。

## 5. チャレンジ署名の検証

**対象**: `src/utils/publicKeyAuth.ts` の `validateChallengeRow` /
`verifyChallengeSignature`、4つのチャレンジ発行・検証エンドポイント。

チャレンジを消費する経路は2系統ある。

1. **ログイン済みユーザーの照合テスト**(`/public-keys`画面):
   `POST /api/public-keys/challenge` → `POST /api/public-keys/verify`
   (`authMiddleware`あり、`user.sub`はセッションから取得)
2. **パスキー的ログイン**(`/login`画面、GitHub OAuth不要):
   `POST /auth/public-key/challenge` → `POST /auth/public-key/verify`
   (`authMiddleware`なし。`userId`はリクエストボディで指定)

いずれの系統でも、公開鍵を引く際のWHERE条件は
`revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`
に統一している(4箇所すべてを`src/publicKeyExpiry-20260903.test.ts`で
ソースレベルに固定し、1箇所でも条件を書き忘れて期限切れの鍵でログインが
通ってしまう後退を防いでいる)。

チャレンジ行(`public_key_challenges`)自体の検証は `validateChallengeRow()`
が担い、以下をすべて満たさないと拒否する。

- 対象チャレンジが存在する(`not_found`)
- リクエストの`userId`とチャレンジ発行時の`user_id`が一致する(`user_mismatch`)
- 未使用である(`already_used`、リプレイ防止)
- 有効期限内である(`expired`、TTLは`CHALLENGE_TTL_SECONDS`=5分)

署名検証(`verifyChallengeSignature`)は、DBに保存された`public_key_jwk`を
`crypto.subtle.importKey`で読み込み、ECDSA/SHA-256でチャレンジ文字列への
署名を検証する。検証の成否に関わらずチャレンジは即座に`used_at`を立てて
消費済みにする(検証失敗時の再試行によるチャレンジ使い回しを防ぐため)。

## 5.1 異常検知・記録・通知(セキュリティ)

**対象**: `src/utils/publicKeySecurity.ts`、`flagPublicKeySecurityEvent()`
(`src/index.ts`)、D1 `public_key_security_events`(移行`0128`)。

秘密鍵が何らかの方法で別環境に持ち出され、悪用が試みられた場合を想定し、
チャレンジ発行・検証の4エンドポイント(`/auth/public-key/challenge`・
`verify`、`/api/public-keys/challenge`・`verify`)すべてで、以下2種類の
異常を検知するたびにD1へ記録しSlackへ通知する。

- `key_not_found`: 対象鍵が見つからない(`userId`/`keyId`の組み合わせ不一致・
  失効・期限切れのいずれか)
- `signature_mismatch`: 対象鍵は存在するが、署名が登録済み公開鍵と
  一致しない(=リクエスト元が正しい秘密鍵を持っていない)

DB記録(`public_key_security_events`: `user_id`, `key_id`, `event_type`,
`detail`, `ip`, `created_at`)に失敗してもSlack通知は継続し、Slack通知に
失敗してもログイン処理自体のエラーレスポンスは継続する
([`cd882a0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cd882a0))。

## 6. パスキー的ログインの確定処理

**対象**: `src/index.ts` の `finalizePasskeyLogin`。

GitHub OAuthを経由しないため、以前のGitHubログインで作成された
`user_sessions`行(`timezone`・`session_duration`・`github_access_token`等)を
`getUserSession()`で取得し、そのまま`updateUserSession()`へ渡して
`last_login_at`等だけを更新する。`github_access_token`を明示的に
引き継がず`undefined`のまま`updateUserSession`を呼ぶと、UPSERT文の
`ON CONFLICT DO UPDATE`が既存のトークンをNULLで上書き消去してしまう
ため、ここは意図的に既存値をそのまま渡している
([`ca88942`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ca88942))。

ログイン確定時に発行するJWTペイロードは `{ sub: userId }` のみ(`name`・
`github_id`等は含まない)。UIの表示名は`user.name || user.username`の
フォールバックで吸収される。

## 7. ログイン方式の記録・画面表示

**対象**: `src/utils/loginHistory.ts`、`recordLoginMethod()`、`/welcome`ページ。

`finalizeGithubLogin`・`finalizePasskeyLogin`の両方が`recordLoginMethod()`を
呼び、`user_sessions.last_login_method`(直近1回、画面表示用)と
`login_history`(全履歴、監査用)の両方に書き込む。書き込みに失敗しても
ログイン自体は継続する(ログの記録失敗でログインを止めない設計)。

`/welcome`ページでは2種類の表示がある。

- **ログイン直後だけの一時バッジ**: `login_method`Cookie(Max-Age=60)経由。
  「🔐 パスキーでログイン」等、ようこそメッセージに1回だけ表示される。
- **常時表示の「ログイン方法」欄**: `user_sessions.last_login_method`を
  毎回読み、ページを開くたびに表示される。

([`05a8aa4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/05a8aa4))

## 8. 関連コミット

- [`82ae7bd`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/82ae7bd) 公開鍵登録によるチャレンジ署名ログイン機能を追加
- [`ca88942`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ca88942) 公開鍵によるパスキー的ログイン(GitHub OAuth不要)を追加
- [`05a8aa4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/05a8aa4) ログイン方式(GitHub OAuth/パスキー)を記録し画面に表示
- [`7eb8803`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7eb8803) IndexedDB保存形式変更で壊れた既存の登録済み鍵を修復する
- [`60fd090`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/60fd090) 公開鍵登録に有効期限(30日/90日/1年/2年/5年/無期限)を追加する
- [`cd882a0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/cd882a0) 公開鍵ログインの異常(鍵未検出・署名不一致)を検知・記録・通知する

## 9. 注意事項

- 秘密鍵はブラウザのIndexedDBにのみ存在するため、**端末・ブラウザごとに
  個別登録が必要**。別端末で照合テスト/ログインしようとすると
  「この端末に秘密鍵が見つかりません」になる(仕様通りの挙動)。
- ブラウザのサイトデータを消去すると秘密鍵も失われ、その公開鍵は
  二度と照合できなくなる。サーバー側の登録は残るため、ユーザー自身で
  `/public-keys`から失効させる必要がある。
- チャレンジ発行・検証エンドポイント(`/auth/public-key/*`)は未ログイン
  状態からも呼べる必要があるため、意図的に`authMiddleware`を経由しない。
  代わりに`userId`+`keyId`の組み合わせと署名検証で本人確認する。
- 現状、AIチャットの入力欄等からこのチャレンジ文字列を経由して秘密鍵を
  操作・詐称する経路は無い(秘密鍵はJSのCryptoKeyオブジェクトとして
  IndexedDBの外に出ない設計のため)。
