# EVAL: PR #1812 セキュリティアップデートと検知設計（2026-09-14）

**対象**: PR #1812（merge commit `0059083`、実装 commit `4bdb102`）で行われた、
`POST /api/aichat/query-external` と `POST /api/cursor-agent/query-external` の
`login`（`user_id`）差し替え対策、および同時に追加されたテスト。

**評価範囲**: 現行ブランチのコード・migration・テストを静的に確認し、対象テストを実行した。
本書は評価と次の実装案をまとめるもので、監査ログや認証方式そのものの実装は行わない。

関連ファイル:

- `src/index.ts`
- `src/utils/dynamicnekoAichatPermission.ts`
- `src/utils/dynamicnekoAichatPermission.test.ts`
- `src/dynamicneko-aichat-external-endpoints.test.ts`
- `src/dynamicneko-cursor-cache-external-endpoint.test.ts`
- `migrations/0133_create_dynamicneko_aichat_allowed_users.sql`
- `migrations/0141_add_github_login_to_dynamicneko_aichat_allowed_users.sql`

---

## 1. 結論

### 1.1 判定

**PR #1812 は「リクエスト本文の `login` を直接 `user_id` に使う」という具体的な
BOLA/IDOR 経路を妥当に閉じており、その回帰テストも当該不変条件を概ね確認できている。**
`login` を入力型から外し、許可済み email に紐づけてサーバー側 D1 に保存した
`github_login` を使う変更は、クライアント申告の対象ユーザー ID よりサーバー側の対応表を
優先するため、修正前より明確に安全である。未設定・空白の `github_login` を `null` として
処理を止めるフェイルクローズも適切である。

ただし、**「認証された呼び出し主体」と本文の `email` は依然として結び付いていない**。
Bearer secret は呼び出し元サービス全体の共有資格情報であり、本文の email は任意入力である。
したがって、その secret を使える主体が別の許可済み email を知る、推測する、ログ等から得る
場合、その email に紐づく `github_login` として検索・集計・書き込みできる。#1812 は
`login` の直接差し替えを **email の差し替えが必要な攻撃へ難化**したが、エンドユーザー単位の
本人性を保証する認証へは変えていない。

よって総合判定は次のとおり。

| 観点 | 判定 | 理由 |
|---|---|---|
| 元の `login` 直接差し替え | **解消** | 本文の `login` は型・処理から除外され、DB 解決値だけが `user_id` に使われる |
| `github_login` 欠損時の安全性 | **妥当** | NULL・空白なら処理を止め、検索・AI呼出し・保存へ進まない |
| 他ユーザー境界の回帰テスト | **部分的に十分** | `login: victim-user` 無視と検索結果分離は確認するが、email 差し替えは未検証 |
| 呼び出し主体とユーザーの真正な紐付け | **未解決** | 共有 Bearer + 自己申告 email のまま |
| 悪用前兆の可観測性 | **不十分** | 一部 `logger.warn/error` のみで、401・成功時の不審入力・集計可能な永続イベントがない |
| migration の運用安全性 | **要補強** | 追加列は nullable。既存行を backfill するまで許可済みユーザーも 500 になる |

### 1.2 優先順位

1. **P0（デプロイ条件）**: migration 0141 を先行適用し、既存 allowlist 全行へ正しい
   `github_login` を backfill してからコードを切り替える。重複・空値検査も実施する。
2. **P1（残余リスク解消）**: email を本文から本人申告させず、呼び出し元が検証した署名付き
   identity assertion、ユーザー別短命 token、または Worker 間の信頼できる認証コンテキストから
   email/login を得る。共有 secret はサービス認証にだけ使う。
3. **P1（検知）**: 外部 API 専用の構造化 security event を永続化し、401/403、廃止済み
   `login` フィールド、identity 解決失敗、レート超過を集計・通知する。
4. **P2（テスト）**: 実 D1 相当の migration テスト、2 endpoint 共通の identity 境界テーブルテスト、
   telemetry/集計テストを追加する。

---

## 2. 修正内容とセキュリティ不変条件

修正前は、共有 Bearer secret と allowlist 上の email が通れば、別途本文に指定された `login` が
そのまま `user_id` となった。このため認証・許可された主体と、アクセス対象オブジェクトの所有者が
一致しない BOLA/IDOR だった。

#1812 後は次の順序になる。

1. `Authorization` が `Bearer ${AICHAT_EXTERNAL_SECRET}` と完全一致することを確認する。
2. DB が無ければ 503 で停止する。
3. 本文の email が allowlist に存在することを確認し、未許可なら 403 で停止する。
4. 同じ email から `dynamicneko_aichat_allowed_users.github_login` を取得する。
5. login が NULL/空白なら 500 で停止する。
6. 解決した login だけを集計、AI回答保存、Cursor履歴検索の `user_id` に使う。

この変更が意図する主要な不変条件は次の三つである。

- **I1**: 本文に `login` が含まれても、認可対象の `user_id` は変化しない。
- **I2**: 認可対象は allowlist の email と同じ行に保存された非空 `github_login` である。
- **I3**: identity を一意・安全に解決できなければ副作用や機微データ読出しより前に停止する。

I1 と空値に対する I3 は実装されている。I2 は通常データでは成立するが、後述する
大文字小文字だけが違う email の重複があると一意性が保証されない。また「本文 email が実際の
利用者本人の email である」という、より上位の不変条件 I4 は現在のプロトコルでは成立しない。

---

## 3. 追加テストの妥当性

### 3.1 良い点

#### `resolveDynamicnekoAllowedLogin` の単体テスト

- 関数の引数に `login` が無く、email だけから解決する API 設計を固定している。
- email の小文字化を確認している。
- 未登録、NULL、空白のみ、空 email をすべて `null` にしている。
- 空 email では DB bind 自体を呼ばないことを確認し、曖昧な検索への到達を防いでいる。

これは純粋な identity 解決関数の境界値テストとして妥当である。

#### AI query endpoint のテスト

- 未許可 email の 403、DB 未設定の 503、`github_login` 未登録の 500 と AI 未呼出しを確認する。
- `/neko aireqst` に `login: victim-user` を残した悪意あるリクエストを送り、実際に D1 集計へ
  bind された値が allowlist 由来の `nekoserver` であることを確認する。
- 統計読出しだけでなく通常質問でも解決済み login が必要になる実装経路を通している。

特に「レスポンスが 200」という表面的結果だけでなく、D1 に渡った user ID を捕捉している点は良い。

#### Cursor cache endpoint のテスト

- `node:sqlite` のインメモリ DB に本人と他人の行を用意し、攻撃者指定の
  `login: victim-user` が無視され、本人の行だけ返ることを確認する。
- 回答本文まで検証するため、「件数が偶然1件だった」だけの偽陽性を避けている。
- 許可・入力・DB 欠損のフェイルクローズも同一 endpoint で確認する。

三群のうち、このテストが実際の SQL とデータ分離を最も強く確認している。

### 3.2 足りない点と偽の安心につながる箇所

#### A. email 差し替え攻撃を扱っていない（最重要）

現在のテストは `email: ok@example.com, login: victim-user` のみを攻撃ケースとする。しかし現在の
API では `email: victim@example.com` と送れば、その email が allowlist にある限り victim の
`github_login` が正規に解決される。共有 secret の所持者がどの end user なのかをサーバーは
判別できない。

追加すべきテストは、現行仕様のままなら「これは現在成功してしまう」という**残余リスク実証テスト**
として隔離して記録するべきである。認証方式を更新した後は次の回帰テストに反転させる。

- Alice 用の署名/token で `email: bob@example.com` を送ると 403。
- Alice の identity assertion からサーバーが `alice@example.com` を導出し、本文 email は無視または拒否。
- Bob の検索行・集計・`ai_chat_shares` に読出し/書込みが一切起きない。

#### B. 通常 AI 質問の保存先を直接検証していない

最も具体的な書込みリスクは `saveDynamicnekoAiShare` の `user_id` である。現状の通常質問成功テストは
AI呼出しと回答だけを確認し、INSERT の bind 値が解決済み login か、攻撃者指定 login でないかを
直接検証していない。`/neko aireqst` の読出しテストだけでなく、通常質問後に
`ai_chat_shares.user_id = nekoserver` の1行だけが作られ、`victim-user` は0行であることを
SQLite 統合テストで確認すべきである。

#### C. 2回の SELECT と重複 email の曖昧性

許可判定と login 解決は別クエリである。通常は問題ないが、email 列の UNIQUE は SQLite の既定では
大文字小文字を区別する一方、検索は `lower(email) = ? LIMIT 1` である。そのため
`Alice@example.com` と `alice@example.com` を両方保存でき、異なる login を持たせると
`LIMIT 1` の結果が未規定になる。

テストと修正案:

- migration 0133 → 0141 を実際に適用した SQLite DB で、case variant の挿入可否を確認する。
- 既存重複を検査・解消後、`email TEXT NOT NULL COLLATE NOCASE UNIQUE` 相当を新表移行で強制するか、
  正規化済み列に UNIQUE index を設ける。
- 許可判定と login 解決を `SELECT github_login ...` の1回に統合し、「行ありだが login 欠損」と
  「行なし」を型付き結果で区別する。

#### D. mock が SQL 契約に弱い

AI endpoint の `createMockDb` は SQL に `github_login` という文字が含まれるかで応答を切り替える。
SQL の WHERE 句、LIMIT、列名、bind 数が壊れてもテストが通る可能性がある。また単体テスト用
`createMockDbWithLogin` は渡した row の email と bind email の一致を検証せず、任意 email に同じ行を返す。

少なくとも以下を assertion に含める。

- `prepare` された SQL が `lower(email) = ?` を持つ。
- bind は正規化 email 1個のみ。
- SQLite 統合テストで allowlist 2人を作り、双方が各自の login に解決される。
- endpoint 共通の table-driven test で A/B/未許可/NULL/空白を回す。

#### E. migration の実適用と rollout を検証していない

0141 は nullable 列追加だけで backfill がない。0133 由来の既存全行は migration 直後に NULL となり、
両 query endpoint が 500 を返す。これは安全側ではあるが、可用性上はデプロイ事故になりうる。
現在のテスト DB は最初から `github_login` を持つ完成形を CREATE しており、0133 → 0141 の更新を
検証しない。

CI に次を追加する。

1. 0133 schema を作成し既存許可ユーザーを INSERT。
2. 0141 を適用し、期待どおり列が増え既存行が NULL であることを確認。
3. rollout 用 backfill を適用し、`github_login IS NULL OR trim(github_login) = ''` が0件であることを確認。
4. case-insensitive email 重複と github_login 重複（仕様上1:1なら）を検査。
5. endpoint smoke test を行う。

#### F. エラー順序・副作用なしの網羅が不均一

- Cursor endpoint の未許可テストは D1 履歴検索が呼ばれていないことを明示的 spy していない。
- 不正 Bearer のとき DB に一度も触れないことを両 endpoint で固定するとよい。
- `github_login` 解決 SELECT が例外になったとき 500 かつ AI/検索/保存ゼロ、も endpoint ごとに必要。
- JSON 不正、巨大 email、制御文字、配列/object 型の email をどう扱うかが未定義である。
  TypeScript の型注釈は実行時検証ではないため、`email.trim()` が関数でなく 500 になる入力がありうる。
- `login` フィールドは黙って無視される。互換性には良いが攻撃試行の検知には不利である。

### 3.3 テスト妥当性のまとめ

| レベル | 現状 | 評価 |
|---|---|---|
| helper unit | 正規化、rowなし、NULL/空白 | 良好。ただし mock の email 対応が弱い |
| endpoint unit | 401/403/500、AI未呼出し | 良好 |
| authorization integration | Cursor は SQLite で本人/他人を分離 | 良好 |
| write-path integration | AI share の保存 user_id を未検証 | 不足 |
| migration integration | 0133→0141・backfill を未検証 | 不足 |
| caller identity | 共有 secret と本文 email の不一致を判定不能 | 設計上不足 |
| adversarial runtime input | 非string、重複キー、巨大値等 | 不足 |
| observability | イベント記録・集計・通知の振舞い | 未実装・未テスト |

---

## 4. 悪用の前兆として観測すべきもの

単発の 401 や typo を即侵害とみなさず、**主体・送信元・対象 identity・時間窓・endpoint を
組み合わせた相関**を見る。

| signal | 重要度 | 意味・閾値例 |
|---|---:|---|
| `auth_failed` | 中→高 | 同一 IP/service で5分に5回、または複数 endpoint 横断で増加。secret探索・旧secret利用 |
| `email_not_allowed` | 中→高 | 同一主体が異なる email を5分に3件以上。allowlist 列挙の疑い |
| `deprecated_login_present` | 高 | #1812 後に本文 `login` が存在。旧クライアントか、IDOR payload の再試行 |
| `claimed_email_mismatch` | 最高 | 将来の署名 identity と本文 email が不一致。即時拒否・通知 |
| `identity_missing` | 中 | 許可行に `github_login` が NULL/空白。通常は rollout/設定事故。急増なら改ざんも疑う |
| `identity_ambiguous` | 高 | 正規化 email が複数行に一致。データ不整合または allowlist 操作異常 |
| `rate_limited` | 中→高 | email/IP/service/endpoint 別の短時間過多。Cursor検索は列挙、AIは課金悪用の可能性 |
| `cross_identity_probe` | 最高 | login/email/user ID の複数候補を短時間に試す。canary 値へのアクセスを含む |
| `success_after_failures` | 高 | 複数 401/403 の直後に同じ送信元が成功。secret/identity 推測成功の可能性 |
| `new_origin_or_service` | 中 | 通常と異なる service binding、colo、ASN/IP prefix、User-Agent から成功 |
| `unusual_result_volume` | 中 | Cursor 検索の連続30件ヒット、広い keyword、ページング試行。データ収集の兆候 |
| `ai_write_spike` | 中 | 同一 identity への短時間大量保存。課金悪用または他人履歴への汚染 |

`login` の値そのものをログに残す必要は通常ない。存在フラグ、正規化後 identity の内部 ID、
提出値の keyed HMAC 程度で「同じ値を試した」相関を取れる。email、質問、回答、Bearer secret、
Authorization header はログへ保存しない。

---

## 5. 推奨する記録・集計の仕組み

### 5.1 イベントモデル

既存の一般 logger だけでなく、例えば `external_api_security_events` を D1 に追加する。

```sql
CREATE TABLE external_api_security_events (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  service_id TEXT,
  email_hmac TEXT,
  resolved_login_hmac TEXT,
  source_ip_prefix_hmac TEXT,
  cf_ray TEXT,
  colo TEXT,
  http_status INTEGER NOT NULL,
  detail_json TEXT
);
CREATE INDEX idx_external_security_time
  ON external_api_security_events(occurred_at);
CREATE INDEX idx_external_security_type_time
  ON external_api_security_events(event_type, occurred_at);
CREATE INDEX idx_external_security_service_time
  ON external_api_security_events(service_id, occurred_at);
CREATE INDEX idx_external_security_email_time
  ON external_api_security_events(email_hmac, occurred_at);
```

設計上の注意:

- HMAC key は Bearer secret と分離し、rotation 可能にする。単純 SHA-256 は email 辞書攻撃に弱い。
- IP は必要性と保持方針を確認し、可能なら prefix 化後 HMAC にする。
- `detail_json` は allowlist 方式で生成し、request body を丸ごと入れない。
- 成功全件を長期 D1 保存すると高コストなので、失敗・不審イベントは全件、通常成功はメトリクスまたは
  低率サンプルにする。ただしユーザー境界を伴う読出し/書込み監査が必要なら成功も短期保存する。
- 記録失敗で認可を成功させるかはイベント別に決める。`claimed_email_mismatch` 等の拒否判定自体は
  ログ保存成否に依存させず常に拒否する。監査保存失敗は別メトリクスと logger.error を出す。

### 5.2 集計

Cron Trigger で5分ごとに直近10分を重複窓で集計し、集計 cursor または alert fingerprint で
通知重複を抑える。D1 の例:

```sql
-- 異なる email を試す allowlist 列挙
SELECT service_id, source_ip_prefix_hmac,
       COUNT(*) AS denied_count,
       COUNT(DISTINCT email_hmac) AS distinct_emails
FROM external_api_security_events
WHERE occurred_at >= datetime('now', '-10 minutes')
  AND event_type = 'email_not_allowed'
GROUP BY service_id, source_ip_prefix_hmac
HAVING denied_count >= 5 OR distinct_emails >= 3;

-- #1812 の攻撃 payload/旧クライアント
SELECT service_id, source_ip_prefix_hmac, COUNT(*) AS attempts
FROM external_api_security_events
WHERE occurred_at >= datetime('now', '-10 minutes')
  AND event_type = 'deprecated_login_present'
GROUP BY service_id, source_ip_prefix_hmac
HAVING attempts >= 1;

-- 失敗後に成功した送信元
SELECT source_ip_prefix_hmac
FROM external_api_security_events
WHERE occurred_at >= datetime('now', '-15 minutes')
GROUP BY source_ip_prefix_hmac
HAVING SUM(CASE WHEN outcome='denied' THEN 1 ELSE 0 END) >= 3
   AND SUM(CASE WHEN outcome='allowed' THEN 1 ELSE 0 END) >= 1;
```

初期閾値はデータが無い段階の仮値である。2〜4週間は通知せず baseline を採り、p50/p95/p99、
時間帯、service_id ごとの通常値を確認して調整する。ただし `claimed_email_mismatch` と
canary identity は1件で通知してよい。

通知先は既存運用に合わせて Slack 等とし、内容は event id、時刻窓、endpoint、event_type、件数、
service_id、CF-Ray までに限定する。質問・回答・email・secret は載せない。対応手順へのリンク、
secret revoke/rotate、該当 service の停止、影響 identity の調査 SQL を runbook に置く。

### 5.3 レート制限

検知だけではデータ流出やAI課金を止めないため、多層 key で制限する。

- service credential 単位
- 解決済み identity 単位
- 送信元 IP/prefix 単位（Service Binding で意味が薄い場合は service instance/request issuer）
- endpoint 単位（AI query と検索で別枠）

401 の key に Authorization 値を使ったり保存したりしない。成功・失敗を別 bucket にし、
失敗 bucket は厳しくする。D1 カウンタだけでは同時更新や遅延に注意し、Cloudflare Rate Limiting、
Durable Object、または専用カウンタの適否を負荷に応じて決める。

### 5.4 canary

廃止済み `login` フィールドに、実ユーザーにならない固定 canary login が送られたら高優先イベントを
出す仕組みは、古い exploit payload の探索検知に使える。ただし canary email を「許可済みユーザー」
として実データへ到達可能にしてはならない。canary は常に拒否される予約 identity とし、値を公開文書や
通常クライアントへ埋め込まず、誤検知要因を管理する。

---

## 6. 検知機構に対するテスト計画

### 6.1 event emission の単体・endpoint テスト

共通関数 `recordExternalApiSecurityEvent` と、認証・認可結果を表す判定関数を分離し、次を
テーブル駆動で両 endpoint に適用する。

| 入力/状況 | HTTP | 必須 event | 機微情報なし | 下流副作用 |
|---|---:|---|---|---|
| Bearer 不一致/未設定 | 401 | `auth_failed` | header/secretなし | DB検索・AI・履歴検索なし（event sink除く） |
| 未許可 email | 403 | `email_not_allowed` | raw emailなし | AI・履歴検索なし |
| 本文に `login` | 方針により400または処理継続 | `deprecated_login_present` | raw loginなし | 継続時も値は認可に不使用 |
| login 解決なし | 500（将来は設定エラー用503も検討） | `identity_missing` | raw値なし | AI・履歴検索・保存なし |
| assertion/email 不一致 | 403 | `claimed_email_mismatch` | HMACのみ | 全副作用なし |
| レート超過 | 429 | `rate_limited` | tokenなし | 全副作用なし |
| 正常 | 200 | counter/audit policyどおり | question/answerなし | 解決済み本人だけ |

さらに event sink が失敗しても、拒否すべきリクエストが成功へ変化しないことを fault injection で確認する。
ログオブジェクトの snapshot では `authorization`, `secret`, `question`, `answer`, raw `email` が
存在しないことを deny-list assertion する。

### 6.2 aggregation test

実時刻に依存させず clock を注入し、SQLite fixture へ境界時刻のイベントを入れる。

- 10分窓の内側5件で発報、直前のイベントは除外。
- 同一 email の反復と異なる3 email の列挙を区別。
- 失敗3回→成功1回は発報、成功→古い失敗は発報しない。
- 2 endpoint 横断を同じ送信元で相関できる。
- alert fingerprint により重複窓でも同一 incident を再通知しない。
- service_id が異なる正常トラフィックを誤って合算しない。
- NULL の IP/service を一つの巨大グループとして誤通知しない。
- query plan と索引利用を定期確認し、イベント増加で Cron 自体が全表走査にならない。

### 6.3 security regression / property test

identity A/B と endpoint/read/write の組合せを生成し、常に次を確認する。

- credential A からは A の object だけ読める・A としてだけ書ける。
- 本文の `login`, `email`, key順、未知フィールド、重複 JSON key を変えても対象 identity は変わらない。
- 大文字小文字・Unicode・前後空白によって別 row や曖昧な row に解決されない。
- deny 応答では AI 呼出し、履歴 SELECT、share INSERT がゼロ。
- 返却 rows の全 `user_id` が解決済み identity に対応する（レスポンスで user_id を返さなくても DB fixture で確認）。

---

## 7. 実装ロードマップと受入基準

### Phase 0: #1812 rollout の安全確認

- 0141 適用状態を確認。
- allowlist の NULL/空白 `github_login` 件数が0であることをデプロイ gate にする。
- 正規化 email 重複、必要なら github_login 重複を0にする。
- 旧 dynamicneko クライアントが `login` を送り続けているか Cloudflare logs で一時確認する。

**受入基準**: 既存許可ユーザーの正常 query が通り、未許可・欠損は下流副作用なしで拒否される。

### Phase 1: 監査可能性

- 構造化 event、PII HMAC、保持期間、索引を実装。
- 401/403、`login` 存在、identity欠損を記録。
- 5/10/15分窓の集計と重複抑止、Slack通知、runbook を追加。

**受入基準**: 合成攻撃 fixture が期待 alert を1回生成し、通常 fixture は生成しない。ログに機微情報がない。

### Phase 2: 残余の impersonation 解消

推奨順:

1. dynamicneko 側でログイン済み identity を検証する。
2. 短命（数分）、audience・issuer・expiry・nonce を含む署名 token を発行する。
3. 本 Worker は署名を検証し、subject/email/login を token から取得する。
4. 本文 email/login は削除するか、移行期間は token 値との完全一致を要求する。
5. replay 防止が必要な操作では nonce/jti を期限付きで一度だけ受理する。
6. サービス共有 secret は Service Binding の防御層として残しても、ユーザー認可の根拠にはしない。

**受入基準**: Alice credential/assertion と任意の本文改ざんの組合せで Bob の読出し・書込みが不可能で、
不一致 event が発生する。

### Phase 3: 継続検証

- 定期的に「全 endpoint が共通 identity resolver/guard を通る」静的テストを行う。
- 新しい `*-external` route を追加する PR では、A/B isolation と event emission を必須チェックにする。
- 月次で false positive、検知から通知までの遅延、未分類 event、保存失敗件数をレビューする。
- secret 漏えい訓練で rotate、service停止、影響範囲抽出が runbook どおり可能か確認する。

---

## 8. 最終所見

#1812 のテストは、報告された直接原因である「本文 `login` の信頼」を再導入しないための回帰テストとして
妥当である。特に Cursor の SQLite 分離テストと `/neko aireqst` の bind 捕捉は、単なる status code
テストより強い。一方で、テスト名やコメントが「許可済み email 1件を知れば」という脅威を閉じたように
読めるのに対し、実際には email も本文由来である。共有 Bearer を使える攻撃者にとっては、対象の
許可済み email が分かれば依然としてそのユーザーを選択できる。

したがって、この更新を**有効な緊急緩和**として採用することには賛成だが、ユーザー単位認証の完了とは
扱わない。デプロイ時の backfill gate、通常 AI 書込み先と migration の統合テスト、構造化セキュリティ
イベントと集計を直近で追加し、その後に署名付き短命 identity へ移行するのが妥当である。
