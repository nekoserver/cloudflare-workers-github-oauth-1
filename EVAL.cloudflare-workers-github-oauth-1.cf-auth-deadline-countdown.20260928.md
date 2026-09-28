# EVAL: cf-auth 期限カウントダウン不具合解消後の再発確認と実装評価（2026-09-28）

**評価対象**: [`SPEC.cloudflare-workers-github-oauth-1.cf-auth-deadline-countdown.20260911.md`](SPEC.cloudflare-workers-github-oauth-1.cf-auth-deadline-countdown.20260911.md) に記録された、cf-auth webhook の署名不一致、`/countdown` のラベル初期値、ログイン時の期限自動登録、および `POST /api/countdown` へのアクセス判定混入による回帰。

**基準点**: 2026-09-28 の `afb9cf6`。修正日（2026-09-11）から17日後のソース、回帰テスト、型検査を確認した。Cloudflare 本番の Secret 値や D1 の最新行をこの検査では参照していないため、本番運用状態は「継続中」と断定せず、リポジトリ内で再発要因が戻っていないことを評価する。

関連コミット:

- `3443101`: 予定名を placeholder ではなく入力値として設定
- `26921c9`: cf-auth 期限の自動登録
- `f1f058e`: `hasCfAuthAccess()` の共通化（回帰混入）
- `be56a72`: 汎用 `POST /api/countdown` から cf-auth 専用ゲートを撤去

---

## 1. 結論

| 検査項目 | 経過確認 | 実装評価 |
|---|---|---|
| webhook 署名検証 | **再発を示すコード変更なし / 回帰テスト合格** | HMAC-SHA256、raw body、`sha256=` 形式の正常・異常系は十分。ただし Secret の同値性はデプロイ環境の運用事項であり、単一リポジトリのテストだけでは保証できない |
| picker の既定ラベル | **再発なし** | 実際の `value` に `cf-auth 期限まで` が入り、DOM 実動作テストも合格 |
| cf-auth 期限の自動登録・更新 | **基本経路は再発なし** | 初回 INSERT、既存行 UPDATE、NG ユーザーの非登録、7日加算はテスト済み。ただしイベント種別を限定しておらず、署名済み push 等でも期限を更新し得るため、仕様どおりの「ログイン時だけ」としては要改善 |
| `/welcome` の既存登録機能 | **回帰の再混入なし** | `POST /api/countdown` は `authMiddleware` のみで利用でき、`/countdown` の登録ボタンも常時存在する。元の回帰原因は除去されたまま |
| 緑色トースト内の登録ボタン | **判定不能（未解決のまま）** | SPEC で対象画面・文言・再現手順が未特定。今回も推測による実装修正は行わない |

**総合判定: 条件付き合格。** 既知の署名不一致と `/welcome` 回帰を再現するコードは戻っておらず、対象80テストと型検査は合格した。一方、自動登録が webhook のイベント種別を見ずに実行される点は、現実装が扱うイベント範囲の拡大によって顕在化した仕様逸脱である。直ちに既修正を差し戻す理由はないが、次回の実装修正候補として切り分ける。全体テストは対象外の heritage journey テスト1件がタイムアウトし完走しなかったため、全リポジトリ合格とは判定しない。

---

## 2. 再発確認検査

### 2.1 webhook 署名不一致

現行ハンドラは次の順序を維持している。

1. `CF_AUTH_WEBHOOK_SECRET` 未設定なら 500
2. リクエスト本文を `text()` で一度だけ読み、raw body を署名検証へ渡す
3. `X-Hub-Signature-256` を `verifyGitHubWebhookSignature()` で検証
4. 不一致なら 401 とし、`webhook_log` に `rejected` を記録
5. 一致した後にだけ JSON を parse し、アクセス判定へ進む

回帰テストは、Secret 未設定、署名ヘッダーなし、Authorization による代用、不正署名、送受信 Secret 不一致、正しい署名をそれぞれ分離している。正しい Secret と同一本文で生成した署名は 200、不一致 Secret は 401 となった。このため、2026-09-11 に切り分けた「アルゴリズムではなく配備先 Secret の不一致」という診断と矛盾する再発は、現行コードとテスト結果からは見つからない。

ただし、この検査が保証するのは検証器の契約である。以下は保証しない。

- 本番 Worker の `CF_AUTH_WEBHOOK_SECRET` と送信元の `WEBHOOK_SECRET` が現在も同値であること
- Secret ローテーション時に両方が同時更新されること
- 本番 `webhook_log` に 2026-09-11 以降 `Signature mismatch` が発生していないこと

したがって本番の再発監視には、従来どおり次の診断 SQL を使う。

```sql
SELECT id, event_type, status, error, received_at
FROM webhook_log
WHERE source = 'cf-auth'
ORDER BY id DESC
LIMIT 20;
```

`status='rejected' AND error='Signature mismatch'` が連続した場合は、コード変更より先に両 Worker の Secret を同じ原本から再設定し、再デプロイ後の `status='ok'` を確認する。

### 2.2 `/countdown` picker の既定値

`addPickerRow()` は input の placeholder を `予定の名前` のままにし、`labelInput.value = 'cf-auth 期限まで'` を設定している。DOM テストでは日付を開いた直後の input 値を直接読み、期待値と一致した。追加行、一括 POST、未入力時の送信抑止も同じ実動作テスト群で合格している。

`countdownQuickAdd.ts` にはこの既定値を横展開していない。依頼された画面以外を変更しないという SPEC の申し送りも維持されている。

### 2.3 cf-auth 期限の自動登録

純粋関数 `computeCfAuthDeadlineTargetAt()` は受け取った日時へ `7 * 24 * 60 * 60 * 1000` を加算し、ISO 8601 文字列を返す。固定ラベルは `cf-auth 期限` である。endpoint テストでは次を確認した。

- `hasAccess=OK` かつ既存行なし: `countdown_events` に1件 INSERT
- 同じ user とラベルの既存行あり: INSERT せず既存 ID を UPDATE
- `hasAccess=NG`: countdown 登録を試みず 200/NG
- 期限計算: ログイン基準日時から正確に7日後

修正後に関連ファイルへ多数の変更は入っているが、上記契約を壊す変更は対象テストで検出されなかった。

### 2.4 `/welcome` からの汎用登録回帰

現行 `POST /api/countdown` は `authMiddleware` の後に DB と入力を検証し、`hasCfAuthAccess()` を呼ばない。`GET /countdown` が返す HTML にも `pickerSaveBtn` が常に含まれる。これにより、cf-auth 用の `user_sessions` 判定を共有 API 全体へ適用して `/welcome` の「⏱️ カウントダウンに登録」を止めた回帰は戻っていない。

`countdownRegister` の単体テストは `/welcome` 側スクリプトが `POST /api/countdown` へ `label` / `targetAt` を送ることを確認し、ページ/API の統合テストは認証済みユーザーの登録成功を確認する。入口と出口の両方に回帰テストがある状態である。

---

## 3. 実装評価

### 3.1 良い点

1. **署名検証を parse 前の raw body に対して行う。** JSON の再文字列化差分を持ち込まず、正しい境界で検証している。
2. **失敗モードが区別される。** Secret 未設定は 500、認証失敗は 401、署名後の不正 payload は 400、アクセス対象外は 200/NG であり、調査時に原因を分けられる。
3. **期限計算を純粋関数化している。** 時刻計算が endpoint から分離され、固定日時で再現可能なテストがある。
4. **同一ユーザーの通常の再ログインでは行を増やさない。** 既存行を更新する意図とテストが一致する。
5. **自動登録失敗で webhook 全体を落とさない。** 結果を Slack 文面へ載せ、ログも残すため、通知受信と付随機能の障害を分離している。
6. **回帰原因の共有 API 契約をコメントとテストで固定している。** `/api/countdown` が `/countdown` 専用でないことが明記され、同じ誤適用を防ぎやすい。

### 3.2 要改善事項

#### A. ログイン以外の署名済みイベントでも期限を更新する（優先度: 高）

ハンドラは `event` / `action` を抽出するが、期限登録条件は `hasAccess` だけである。同じ endpoint は GitHub native push を受け、`pusher.name` / `sender.login` もユーザー名候補にする。したがって、そのユーザーが `user_sessions` に存在すれば、push 受信時にも `new Date() + 7日` で `cf-auth 期限` を延長し得る。

これは「cf-auth へのログインのたびに更新する」という仕様より広い。修正時は、送信元が実際に送るログインイベント名と action を fixture で確定し、`isCfAuthLoginEvent(event, action, payload)` のような純粋判定を追加する。ログイン以外では countdown を変更しない endpoint テストを先に追加する。イベント名を確認せず推測で条件を置くことは避ける。

#### B. SELECT → INSERT は同時実行に対して原子的でない（優先度: 中）

`countdown_events` には `(user_id, label)` の UNIQUE 制約がない。既存行がない状態で同じユーザーの webhook が並行すると、両方が SELECT で未存在を見て2行 INSERT できる。また既に重複がある場合、`LIMIT 1` で1行だけ更新して残りを温存する。

固定ラベル以外には同名予定を複数登録できる汎用テーブルなので、表全体へ単純な UNIQUE 制約を付けるのは既存仕様を壊す。対策候補は、専用の安定キー/種別列を追加して部分的に一意化する、またはトランザクション相当の一括 statement と重複整理を設計することである。まず本番で同一 user・label の重複件数を測ってから別 SPEC で扱う。

#### C. TTL が別リポジトリの定数の複製（優先度: 中）

7日は `nekoserver/cf-auth` の `SESSION_TTL` を手動転記した値である。送信元だけ TTL が変わるとテストは合格したまま期限表示がずれる。最も強い契約は、cf-auth が署名対象 payload に実際の `expiresAt` を入れ、受信側が検証後にそれを保存することである。移行までは、両リポジトリの契約テストまたは変更チェックリストで同期を管理する。

#### D. 「ログイン日時」は受信 Worker の現在時刻（優先度: 低〜中）

現行は payload の発生日時ではなく、webhook 処理時の `new Date()` を使う。通常の即時配送では差は小さいが、再送・キュー遅延時は実際のセッション期限より遅い値を表示する。C と同様に、署名済みの絶対期限を送る設計ならこの誤差も解消できる。

#### E. コメントの一部が修正前の適用範囲を残す（優先度: 低）

`hasCfAuthAccess()` の説明は `/countdown` UI と登録 API でも同じ基準を使う旨を残し、`POST /api/countdown` 直前のコメントも表示側で判定すると記すが、現行 `/countdown` の登録ボタンは常時表示である。実行動作には影響しないものの、次の保守で回帰した設計を正しい設計と誤読させる。コード修正時に「cf-auth webhook 専用判定」と現状へ合わせる。

---

## 4. 実行した検査と結果

### 対象回帰テスト

```text
npx vitest run \
  src/webhook-cf-auth-endpoint.test.ts \
  src/utils/countdown.test.ts \
  src/countdown-20260828.test.ts \
  src/countdown-picker-bulk-register.test.ts \
  src/utils/countdownRegister.test.ts \
  src/welcomeExpiryCountdown-20260903.test.ts

Test Files  6 passed (6)
Tests      80 passed (80)
```

### 静的検査・全体回帰

```text
npm run typecheck
tsc --noEmit: passed

npm test
vitest run: 対象外の heritageJourney-registered-routes-modal-20260820.test.ts 1件が
23.2秒でタイムアウトし、その後も完走しなかったため中断
```

対象検査は、署名、期限計算、自動 INSERT/UPDATE、汎用 API、picker、`/welcome` 呼び出しを含む。実 D1、実 Secret、実 Slack、別リポジトリの送信コードを接続した E2E ではない。全体テストのタイムアウトは対象機能の80テスト合格とは分けて記録し、この評価のために既存の無関係なテストを修正していない。

---

## 5. 次のアクション

1. **本番経過確認**: 上記 SQL で直近の `cf-auth` webhook を確認し、`Signature mismatch` の再発有無と最新 `ok` 時刻を記録する。
2. **ログインイベント契約の確定**: cf-auth 側の実 payload fixture を取得し、ログインだけを自動登録対象にするテストと判定を追加する。
3. **データ健全性確認**: `countdown_events` で `label='cf-auth 期限'` を user ごとに集計し、重複がないか確認する。

```sql
SELECT user_id, COUNT(*) AS count
FROM countdown_events
WHERE label = 'cf-auth 期限'
GROUP BY user_id
HAVING COUNT(*) > 1;
```

4. **送信契約改善**: 可能なら TTL の複製をやめ、署名済み payload の `expiresAt` を正本にする。
5. **未解決 UI**: 緑色トーストは、再現手順・正確な文言・スクリーンショットが揃うまで変更しない。

今回の評価だけを根拠に既存機能へ追加ゲートを戻したり、`countdownQuickAdd` へ既定値を横展開したりしない。再発防止では「似た画面」ではなく、全呼び出し元とイベント契約を先に確定する。
