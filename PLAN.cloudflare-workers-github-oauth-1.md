# 2026年9月 実装評価・拡張計画

> 対象: `cloudflare-workers-github-oauth-1`
> 評価期間: 2026-09-01〜2026-09-28
> 作成日: 2026-09-28
> 評価方法: 対象期間の Git 履歴、現行ソース、テスト、マイグレーションを静的に確認。実運用の SLO、障害件数、利用率、コストは未提供のため評価対象外。

## 1. エグゼクティブサマリー

今月は **AI チャットを中心とする探索・編集体験、ブラウザ WASM、D1 運用可視化を短期間で大きく拡張した月**だった。対象期間には author date 基準で 291 コミット（マージ 139、非マージ 152）があり、機能追加だけでなく回帰修正、診断ログ、仕様・評価文書も継続的に追加されている。

一方、機能の集積点である `src/index.ts` は 25,182 行、ルート定義は単純集計で約 411 件に達している。553 個の `*.test.ts` が変更を支えているものの、巨大なエントリーポイント、外部サービスをまたぐ機能の増加、リポジトリ内 CI 定義の不在により、今後は「追加速度」より **境界の分離、契約テスト、観測可能性、リリースゲート**を優先すべき段階である。

**総合評価: B+（提供価値と検証量は高いが、構造的複雑性と運用保証が追いついていない）**

## 2. 今月の実装評価

### 2.1 主な成果

| 領域 | 今月の進展 | 評価 |
|---|---|---|
| AI チャット / 自動探索 | 未理解キーワードの境界管理、自動探索、停止・進捗表示、再検索抑止、外部問い合わせ、スラッシュコマンド群を追加 | **A-**: 探索から再利用までの導線が強化された。状態遷移が増えたため、E2E と失敗時復旧の明文化が次の課題 |
| Mention Editor | ユーザー単位保存、タブ並べ替え、typewriter、コマンド実行、Ruby の解析・保存・Markdown 表示を段階的に追加 | **A-**: 小さな改善をテスト付きで反復した点が良い。AI チャットと責務が重なり始めている |
| Ruby / Rust / Go WASM | Ruby サンプル・SQLx アダプター、`msb`、`gron`、`go-diff`、`sqlx` を追加・改善し、MIME/読み込み不具合も修正 | **B+**: ブラウザ内ツール群として差別化が進んだ。ビルド再現性、バイナリ来歴、互換性マトリクスの統一が必要 |
| D1 / Webhook / tree-view | webhook の署名診断・repository 記録・status index、tree-view の強制同期と失敗記録、外部キー検証を改善 | **B+**: 障害解析可能性が向上した。一時診断情報の撤去条件とログ秘匿化の確認が必要 |
| API / UI | API explorer、query builder、query pattern analysis、差分 API を追加し、テーマや表示崩れも修正 | **B**: 利用面は広がったが、認証・公開範囲・エラー形式を横断的に統一する余地が大きい |
| 文書化 | API、SPEC、NOTICE、EVAL、HISTORY を追加・更新 | **A-**: 判断経緯を残す文化は強い。類似文書の重複と最新版の発見性は改善余地あり |

### 2.2 良かった点

1. **実装と回帰テストが近い**
   `mention-editor`、Ruby WASM、tree-view、webhook、go-diff などで、機能追加後の不具合を個別テストで固定している。特に保存・削除・外部 API・WASM 読み込みといった壊れやすい境界を検証している点は良い。

2. **失敗を隠さない方向へ進んだ**
   tree-view 更新失敗の永続化、webhook 署名不一致の診断、GitHub API エラーの改善、外部キー整合性検証など、正常系だけでなく調査可能性を高める変更が増えた。

3. **WASM を単発デモから再利用可能な機能へ発展させた**
   UI、外部 API、AI チャットのコマンドから同じ能力を利用する流れができており、Ruby/Rust/Go の資産を Worker 上の体験へ接続できている。

4. **小刻みな変更でユーザー体験を磨いた**
   Mention Editor のドラッグ、クリア、表示形式、Ruby 実行などを小さい変更単位で積み上げたため、変更意図を追跡しやすい。

### 2.3 改善すべき点とリスク

| 優先度 | 課題 | 根拠 / 影響 | 改善方針 |
|---|---|---|---|
| P0 | 巨大な Worker エントリーポイント | `src/index.ts` が 25,182 行で、認証・API・HTML・D1・外部連携の変更が集中。変更競合、レビュー漏れ、意図しない公開範囲変更のリスクが高い | ドメイン別 Hono router と service/repository 層へ段階分割。1 PR で全面改修せず、ルート群ごとに移す |
| P0 | 自動リリースゲートが確認できない | `.github` 配下は PR テンプレートのみ。大量のテストがあっても、マージ時に必ず実行される保証がリポジトリ内にない | `typecheck`、全 Vitest、マイグレーション検証、WASM 生成物検証を必須 CI 化 |
| P0 | 認証・認可ポリシーの分散 | 公開 API、optional auth、ユーザー限定、管理者限定が多数のルートに広がる。今月も token expiry や access gate の回帰修正が発生 | ルート台帳に公開範囲を明記し、ポリシーを middleware に集約。未宣言ルートをテストで失敗させる |
| P1 | 外部連携の契約が暗黙的 | GitHub、Cloudflare、Slack、Resend、dynamicneko、AI provider を横断し、タイムアウト・再試行・部分失敗の扱いが機能ごとに異なる | 共通 client、typed error、timeout、retry/idempotency、contract test を導入 |
| P1 | D1 スキーマ管理が二重化 | SQL ファイルに加え `src/index.ts` 内にも migration SQL があり、欠番を含むため実際の適用順序が把握しづらい | migration manifest を単一の正とし、重複 ID・欠落・適用順・registry 不一致を CI 検証 |
| P1 | WASM の供給網と再現性 | 複数言語・複数生成物が増え、ブラウザ互換性や生成物とソースの対応確認コストが上昇 | toolchain を固定し、build/checksum/size budget/license を manifest と CI に記録 |
| P2 | 文書の発見性 | 日付付き SPEC/NOTICE/EVAL が増え、どれが現行仕様か判断しにくい | `docs/INDEX.md` に owner、status、supersedes、最終確認日を集約 |
| P2 | 成果指標が不足 | コミット数とテスト数は分かるが、利用率、成功率、p95、D1/WASM/AI コストが評価できない | 機能単位の SLI とダッシュボードを定義し、次回評価を運用データ中心にする |

## 3. 今後の拡張提案

### Phase 0: 安全網の整備（次の 1〜2 週間）

**目的:** 現在の機能を壊さずに構造改善できる状態を作る。

- CI を追加し、`npm run typecheck` と `npm test` を必須化する。
- migration の ID、registry、適用順、埋め込み SQL とファイルの整合性を検査するスクリプトを追加する。
- 全ルートを `method / path / auth policy / handler domain` で出力するルート台帳を生成する。
- GitHub・AI・webhook のログから token、secret、payload 内個人情報を除外するテストを追加する。
- 代表的な 5 フロー（OAuth、AI chat、Mention Editor、Ruby WASM、webhook）を smoke test として固定する。

**完了条件**

- デフォルトブランチへの全 PR で typecheck・unit/integration test・migration check が必須になる。
- 認証ポリシー未宣言のルートが 0 件になる。
- 同一コミットから WASM を再ビルドし、manifest の checksum と一致する。

### Phase 1: モジュール境界の分離（2〜6 週間）

**目的:** `src/index.ts` への変更集中を解消し、レビュー可能な単位を作る。

最初に変更頻度が高い領域から、以下へ移動する。

```text
src/
  app.ts                    # middleware と router の組み立てのみ
  routes/
    aichat.ts
    mention-editor.ts
    wasm-tools.ts
    webhooks.ts
    admin.ts
  services/                 # 外部 API とユースケース
  repositories/             # D1 の読み書き
  policies/                 # auth / visibility / ownership
```

- 既存レスポンスを snapshot/contract test で固定してから 1 ドメインずつ抽出する。
- HTML 文字列生成、入力検証、D1 query、外部 fetch を handler から分離する。
- API エラーを `{ code, message, requestId, details? }` に統一する。

**完了条件**

- `src/index.ts` を 5,000 行未満、個別 router を原則 1,000 行未満にする。
- ルート追加時に認証ポリシーと contract test が必須になる。
- 既存 smoke test のレスポンス互換性を維持する。

### Phase 2: AI ワークフローの製品化（4〜8 週間）

**目的:** 自動探索・コマンド・保存結果を、再実行可能で費用を制御できるワークフローへ育てる。

- 自動探索を `queued / running / waiting / completed / failed / cancelled` の明示状態で永続化する。
- provider/model ごとの timeout、token 上限、予算上限、fallback を設定可能にする。
- Mention Editor の文書を AI チャットで実行する際、入力・使用モデル・ツール・出力・所要時間を run として保存する。
- 再実行、途中再開、キャンセル、同一入力の重複排除を提供する。
- prompt / model / tool version を保存し、結果の再現性を高める。

**完了条件**

- 失敗した run の 95% 以上で、画面から失敗段階と再試行可否を特定できる。
- 二重送信による同一 run の重複作成がない。
- ユーザー・機能・モデル単位の token/費用を日次で確認できる。

### Phase 3: WASM Tool Registry（6〜10 週間）

**目的:** 増加した WASM ツールを同じ方法でビルド・配布・呼び出せるようにする。

- registry に `id / version / language / source / artifact / checksum / MIME / memory limit / supported browsers` を持たせる。
- UI と AI slash command が同じ tool adapter を利用する。
- Worker API で実行する機能には入力サイズ、CPU 時間、出力サイズの上限を設ける。
- Ruby/SQLx/go-diff について golden test とブラウザ smoke test を共通化する。
- 生成物のサイズ推移と依存ライセンスを CI artifact として残す。

**完了条件**

- 新規ツール追加が registry、adapter、contract test の追加だけで完了する。
- source と artifact の不一致を CI が検出する。
- 各ツールの cold start、実行時間、失敗率を計測できる。

### Phase 4: 外部連携とイベント基盤（8〜12 週間）

**目的:** webhook と外部 API の一時障害を利用者の失敗に直結させない。

- webhook は署名検証後にイベント ID で冪等化し、重い処理を Queue/Workflow へ移す。
- retry policy、dead-letter、再送 UI、処理履歴を共通化する。
- GitHub/Slack/Resend/Cloudflare client に correlation ID と構造化エラーを導入する。
- 一時的に追加した secret hash などの診断情報は、保持期間と削除条件を定める。

**完了条件**

- 同一 webhook の再送で副作用が重複しない。
- 外部サービス障害時も受信を失わず、復旧後に再処理できる。
- provider 別の成功率、p95 latency、retry、dead-letter 件数を可視化する。

## 4. 推奨バックログ

| 順位 | 提案 | 規模 | 期待効果 | 依存 |
|---:|---|---:|---|---|
| 1 | 必須 CI と migration/auth policy 検査 | M | 回帰と誤公開を早期検知 | なし |
| 2 | ルート台帳の自動生成 | S | 現状把握、認可レビュー、API 文書更新を一本化 | なし |
| 3 | `aichat` router/service の抽出 | L | 最大の変更集中領域を分離 | 1, 2 |
| 4 | `mention-editor` router/repository の抽出 | M | 保存・所有権・実行責務を明確化 | 1, 2 |
| 5 | 外部 API client と typed error の共通化 | M | エラー UX と運用調査を改善 | 1 |
| 6 | WASM manifest/checksum/size CI | M | 生成物の再現性と供給網を保証 | 1 |
| 7 | AI run 状態モデルと予算管理 | L | 中断・再開・コスト制御を実現 | 3, 5 |
| 8 | webhook queue/idempotency | L | 障害耐性と再処理性を向上 | 5 |
| 9 | ドキュメント索引と supersedes 管理 | S | 現行仕様への到達時間を短縮 | なし |
| 10 | SLI ダッシュボード | M | 次月以降の評価を定量化 | 5, 7, 8 |

## 5. 次月の評価指標

機能数やコミット数だけでなく、以下を月次で記録する。

| 分類 | 指標 | 初期目標 |
|---|---|---:|
| 品質 | デフォルトブランチの必須チェック成功率 | 100% |
| 品質 | 本番回帰につながった変更数 | 前月比減 |
| 構造 | `src/index.ts` の行数 | 20,000 行未満（次月）、最終 5,000 行未満 |
| セキュリティ | 認証ポリシー未宣言ルート | 0 |
| API | 5xx 率 / p95 latency | 機能別 baseline を確立 |
| AI | run 成功率 / cancel 成功率 / token・費用 | 機能別 baseline を確立 |
| WASM | cold start / 実行時間 / artifact size | ツール別 baseline を確立 |
| Webhook | 署名失敗 / retry / dead-letter / 重複排除 | ダッシュボード化 |
| 保守性 | 変更 PR のうち `src/index.ts` を触る割合 | 50% 未満 |

## 6. 実行原則

1. **新機能を止めず、先に安全網を置いてから段階分割する。**
2. **大規模リライトは行わず、既存の contract test を保ったままルート単位で移す。**
3. **公開範囲、所有権、入力上限、外部送信先を API ごとに明示する。**
4. **診断ログは有用性だけでなく、秘匿性と削除期限をレビューする。**
5. **次回の実装評価は Git 履歴に加え、SLO・利用率・費用・障害データで判断する。**

---

本計画は「機能の追加量」を抑えるものではなく、今月築いた AI・WASM・D1 の機能群を、継続的に拡張できる製品基盤へ移すための優先順位である。Phase 0 を次の機能開発より先に完了し、その後は各 Phase を独立した非スタック PR に分割して進める。
