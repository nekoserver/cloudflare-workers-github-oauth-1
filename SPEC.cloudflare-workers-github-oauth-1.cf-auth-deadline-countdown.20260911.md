# SPEC.cloudflare-workers-github-oauth-1.cf-auth-deadline-countdown.20260911.md

## 1. cf-authログイン通知の署名検証不一致の調査と復旧

**対象**: `POST /webhook/cf-auth`(本体Worker)と`nekoserver/cf-auth`の
`notifyWelcome()`(`src/webhook.ts`) —— cf-authからのログイン通知webhookが
本番で継続的に401(署名検証エラー)になっていた問題の原因切り分けと復旧。

### 背景

ユーザーから「cf-authからのログイン時のwebhook署名検証を、呼び出し側に
合わせてアドホック対応するか、本体側に合わせて呼び出し元を修正するか
どちらかにしてほしい」という依頼があった。両リポジトリのコードを確認した
ところ、署名アルゴリズム(HMAC-SHA256、hex、`sha256=`プレフィックス、
ボディ全体を署名対象にする点)は**コード上は完全に一致**しており、実際に
同じ秘密鍵・同じボディ文字列で両者のロジックを計算しても署名は一致した。

D1の`webhook_log`テーブル(`SELECT id, event_type, status, error, received_at
FROM webhook_log WHERE source = 'cf-auth' ORDER BY id DESC LIMIT 20`)を
確認したところ、`status='rejected'`・`error='Signature mismatch'`
(署名フォーマット・長さは正しいが計算結果が食い違う)が繰り返し記録されて
いた。これはコードのロジック不一致ではなく、**本体Worker側の
`CF_AUTH_WEBHOOK_SECRET`とcf-auth側の`WEBHOOK_SECRET`に設定されている値
そのものが食い違っている**という運用上の問題である可能性が最も高いと判断。

ユーザーがcf-auth側の`WEBHOOK_SECRET`を再設定・再デプロイしたところ、
直後のログで`status='ok'`に復旧したことを確認した。

### 対処内容

- コード変更なし(署名検証ロジック自体に問題は無かった)
- 診断用SQL(`webhook_log`の`source='cf-auth'`絞り込み)を提示し、実際の
  拒否理由(`Signature mismatch`)から原因を運用起因と特定
- `wrangler secret put CF_AUTH_WEBHOOK_SECRET`(本体)・
  `wrangler secret put WEBHOOK_SECRET`(cf-auth)で値を合わせる運用対応を実施

---

## 2. `/countdown`予定登録モーダルのラベル初期値をcf-auth関連に変更

**対象**: `src/views/countdown.ts`のカレンダー日付タップから開く
「予定を登録」モーダル、「予定の名前」テキストボックス —— 手入力の手間を
省くため、テキストボックスの実際の入力値(`value`、プレースホルダではない)
に既定文字列を入れる。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/countdown.ts` | `addPickerRow()`内の`labelInput`に`value = 'cf-auth 期限まで'`を設定(プレースホルダではなく実際の入力値として)。プレースホルダは汎用的な「予定の名前」に戻した |

### 関連コミット

- [`fb24249`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fb24249) プレースホルダを「cf-auth 期限まで」に変更(誤りだった中間コミット、後続で修正)
- [`3443101`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3443101) プレースホルダではなく実際の入力値として既定値を設定するよう修正

### 注意事項

- 当初この修正を`src/utils/countdownQuickAdd.ts`(`/neko tlist`の「登録」
  ボタンから開く別実装のモーダル)にも展開したが、ユーザーから明確な
  指示が無い変更だったため`git revert`した
  ([`873fbcb`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/873fbcb)
  →
  [`3c31cb5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3c31cb5)
  でrevert)。**依頼された画面以外への横展開は事前確認してから行うこと。**

---

## 3. cf-authログイン時に「cf-auth 期限」カウントダウンを自動登録する

**対象**: `POST /webhook/cf-auth`(本体Worker)、D1の`countdown_events`
テーブル、`src/utils/countdown.ts`の純粋関数群 —— cf-authへのログインの
たびに、そのユーザーの`/countdown`へ「cf-auth 期限」ラベルで期限日時を
自動登録・更新する。

### 背景

「cf-authへのログイン日時から割り出した『セッション期限の日時データ』と
『固定値cf-auth 期限』を、countdown_eventsとカウントダウンウィジェットに
セットするだけでいいのでは」という依頼を受けて実装した。期限日時は
cf-auth側のセッション有効期限(`nekoserver/cf-auth`の`src/session.ts`の
`SESSION_TTL` = 7日)をログイン日時に加算して算出する。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/utils/countdown.ts` | 純粋関数`computeCfAuthDeadlineTargetAt(loginAt: Date): string`、定数`CF_AUTH_SESSION_TTL_MS`(7日)・`CF_AUTH_DEADLINE_LABEL`(`'cf-auth 期限'`)を追加 |
| `src/index.ts` | `upsertCfAuthDeadlineCountdown(db, userId, loginAt)`を追加。`/webhook/cf-auth`でhasAccess=OKのたびに呼び出し、同じuser_id+ラベルの既存行があれば`target_at`のみUPDATE、無ければINSERTする(毎ログインで行が増え続けないようにするため) |
| `src/index.ts` | 登録結果(OK/NG)をSlack通知の文面に追加(CLAUDE.mdルール8: 記録はログ、通知はSlack) |

### 関連コミット

- [`26921c9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/26921c9) cf-authログイン時にcountdown_eventsへ「cf-auth 期限」を自動登録する

### 動作確認

D1の`countdown_events`に実際に自動登録された行を確認済み:

```
id=23, user_id=nekoserver, label="cf-auth 期限", target_at=2026-09-18T11:24:24.845Z
```

ログイン日時(約2026-09-11T11:24)から正しく7日後になっている。`/countdown`
ページのリストにも反映されることをユーザー自身に確認してもらった。

---

## 4. `hasCfAuthAccess()`共通関数化と、それによって生じた既存機能への回帰

**対象**: `src/index.ts`の`hasCfAuthAccess(db, userId): Promise<boolean>`、
`POST /api/countdown`、`GET /countdown`、`src/views/welcome.ts`の
「⏱️ カウントダウンに登録」ボタン(本セッション以前から存在する既存機能、
[`22b60d2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/22b60d2)) ——
アクセス許可判定の共通化と、その適用範囲を誤って広げたことによる
既存機能の破壊、およびその復旧。

### 背景

「今回確立したメールアドレス登録済みかどうかをチェックする部分を共通関数化
して各所から呼び出し、その結果を踏まえて処理を振り分けたらどうか」という
提案を受け、`getUserSession(db, id) !== null`という重複していた判定を
`hasCfAuthAccess()`として共通化した。この時点では以下3箇所で使用:

1. `/webhook/cf-auth`のhasAccess判定(**正しい用途**: cf-auth経由の
   外部ログイン向けアクセス許可判定)
2. `GET /countdown`の登録ボタン表示制御
3. `POST /api/countdown`のサーバー側再検証(403ゲート)

### 発生した回帰

`POST /api/countdown`は`/countdown`のカレンダーだけでなく、
`src/views/welcome.ts`の「⏱️ カウントダウンに登録」ボタン(このアプリへ
直接ログインした全ユーザーが使える、本セッションより前からの既存機能)
からも呼ばれる**汎用API**だった。`hasCfAuthAccess()`はcf-auth経由の
ログイン向けの判定基準であり、これをこの汎用APIに一律適用したことで、
`/welcome`の既存機能(ボタンを押しても「✅ 登録しました」まで到達しない)
を壊す回帰を引き起こした。

原因特定までに、無関係な仮説(cf-auth側`/welcome`のnekoserver特別扱いの
順序、`/neko tlist`チャットバブルの登録ボタン等)を何度か検証しては
ユーザーに指摘されて撤回する、という手戻りが発生した。最終的に
「`/welcome`に元々あった『⏱️ カウントダウンに登録』ボタンが
`POST /api/countdown`を叩いている」という事実にたどり着き、原因を
確定させた。

### 対処内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `POST /api/countdown`から`hasCfAuthAccess()`の403ゲートを削除。authMiddlewareによる認証のみに戻した |
| `src/views/countdown.ts` | 登録ボタンの表示制御(`hasAccess`引数)を撤去し、常に表示するよう戻した(APIが全ユーザーに開いているのに表示だけ絞ると一貫性が無いため) |
| `src/index.ts` | `hasCfAuthAccess()`自体は`/webhook/cf-auth`(cf-authからのログイン通知のOK/NG判定)には引き続き使用 |

### 関連コミット

- [`f1f058e`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f1f058e) `hasCfAuthAccess()`共通関数化(この時点で回帰が混入)
- [`d6725de`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/d6725de) → [`2474664`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2474664) `/neko tlist`の登録ボタンにも表示制御を追加したが、指示が無い変更だったためrevert
- [`be56a72`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/be56a72) `POST /api/countdown`から`hasCfAuthAccess()`ゲートを撤去(回帰修正)

### cf-auth側の変更とrevert

原因調査の過程で、cf-auth側の`/welcome`ルートで「nekoserverアカウントは
`notifyWelcome()`を呼ばずに`/wspace`へ即転送している」ことを発見し、
一度は「呼び出し順を直せば自動登録が発火するはず」という仮説のもとに
修正・マージした([`89d2060`](https://github.com/nekoserver/cf-auth/commit/89d2060)、
[PR #40](https://github.com/nekoserver/cf-auth/pull/40))。しかし
ユーザーから「これは関係ない、元に戻せ」と指摘され、
[`9993224`](https://github.com/nekoserver/cf-auth/commit/9993224)
([PR #41](https://github.com/nekoserver/cf-auth/pull/41))でrevertした。
実際、3節の自動登録が正常に動作していることをD1で確認済みであり、
nekoserverアカウントでも`notifyWelcome()`(=webhook送信)は現在の
(revert後の)コードで問題なく発火している。

### 注意事項

- **共通関数化そのものは妥当だが、適用範囲の精査を怠らないこと。**
  「同じ判定ロジックを使っている箇所」と「同じ判定を適用すべき箇所」は
  イコールではない。`POST /api/countdown`は`/countdown`専用ではなく、
  `/welcome`からも叩かれる共有APIだったことを、共通化の前に
  `grep -rn "'/api/countdown'"`等で呼び出し元を洗い出さずに見落とした。
- 今後同種の共通化をする際は、対象エンドポイント・関数の**全呼び出し元**
  を先に洗い出してから適用範囲を決めること。

---

## 5. 未解決: 「緑色のトースト内の登録ボタン」

**対象**: ユーザーが「cf-authにログインした後に出てくる緑色のトースト、
その中の登録ボタン」と説明している何らかのUI要素 —— 具体的な画面・操作
手順が特定できておらず、本セッション終了時点で**未解決**。

### 状況

- 3節の自動登録機能(D1への「cf-auth 期限」自動登録)、
  `/countdown`ページのウィジェット表示は、いずれもユーザー自身に
  確認してもらい正常動作を確認済み。ユーザーからも「これはこれでいい」
  との返答あり。
- 上記とは別に、「緑色のトースト」「トースト内の登録ボタン」という
  UI要素をユーザーは探しているが、本体Worker・cf-auth両リポジトリの
  コードを検索した範囲では該当箇所を特定できていない。
- 候補として調査したが否定された/該当しなかったもの:
  - `/countdown`ページのカレンダー登録モーダル(1・2節)
  - `/neko tlist`チャットバブルの「登録」ボタン(`src/views/aichat.ts`の
    `addTlistRegisterButton`) — ユーザーからこの変更に心当たりが無いと
    指摘され撤回
  - cf-auth側`/welcome`・`/wspace`のnotifyWelcome順序 — 「関係ない」と
    明言された
  - `/countdown`ページ右下の常時カウントダウンウィジェット — 「違う」と
    明言された
  - 自動カウントダウン登録機能全般 — 「関係ない」と明言された

### 申し送り事項

次にこの件を扱うセッションは、**推測でコードを変更する前に**、
ユーザーから以下を確認すること:

1. 実際に操作した手順(①ログイン→②画面遷移→③何を見た/入力したか、の順)
2. そのトーストの正確な文言(色だけでは`showToast()`のような汎用トースト
   実装が複数箇所にあり絞り込めない)
3. 可能であれば、次にそのトーストが表示されたタイミングでのスクリーン
   ショット

D1ログ(`webhook_log`・`countdown_events`)と実際の操作タイミングを
突き合わせる調査手法は有効だったため、今後も踏襲すること。
