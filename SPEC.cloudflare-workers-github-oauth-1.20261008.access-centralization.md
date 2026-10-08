# SPEC.cloudflare-workers-github-oauth-1.20261008.access-centralization

## 1. 現状の接続経路の棚卸し(集中制御・集約の観点での検討の出発点)

**対象**: 本体Worker(`nekoserver/cloudflare-workers-github-oauth-1`)が関わる外部接続経路のうち、
Cloudflare Zero Trust（Tunnel/Access/WARP）を経由するかどうかが経路ごとに異なっている3系統
（SSH・HTTPS・Cursor Background Agent API）。それぞれ実験的な開発を優先して個別に立ち上げてきた
経緯があり、個々の判断は妥当だが、集中制御・集約の観点では一元化されていない状態にある。
この章はその現状を事実ベースで記録し、一元化構想の検討材料とする。

### 背景

`/access-verify`ページ(SPEC参照: 本リポジトリの別日NOTICE)の運用中、以下が判明した。

- SSH経由の接続はTunnel/Access/WARPを経由しており、現状問題なく機能している
- HTTPS経由の接続は、Access Applicationがまだ新設されていないため`/access-verify`で
  効果を確認できない(2026-10-08 NOTICE参照)
- 本体WorkerからCursor Box内のClaude/Codexへの接続（`/cursor-agent`機能、
  `src/utils/cursorAgentLaunch.ts`、`https://api.cursor.com/v1/agents` 他へのfetch）は
  **オリジン直**であり、Tunnel/Access/WARPのいずれも経由しない

これらは個別には「動いている」状態だが、経路ごとに認証・経由ゲートウェイの方針が異なっており、
全体を見たときの一貫性（集中制御）が取れていない。

### 現状の経路一覧

| 経路 | 現状の経由状況 | 認証方式 | 備考 |
|---|---|---|---|
| SSH（本体Worker運用者のアクセス） | Tunnel/Access/WARP経由 | Zero Trust Access（SSH用Application） | 現状問題なく機能中 |
| HTTPS（Worker公開エンドポイント全般） | Workers Route直、Access Application未設置 | なし（`/access-verify`で検証待ち） | `/access-verify`ページ自体もこの経路に乗る |
| Cursor Background Agent API（`/cursor-agent`） | オリジン直fetch（`api.cursor.com`） | `CURSOR_API_KEY`（Bearer、Cursor側のAPIキー） | Tunnel/Access/WARP未経由 |
| Worker間連携（dynamicneko・cf-auth等） | Service Binding（`DYNAMICNEKO`・`CF_AUTH`等のFetcher） or 静的Bearer | 機能ごとに異なるシークレット（`AICHAT_EXTERNAL_SECRET`等）。CF-Worker HMAC方式はルール38で方針化済みだが実装はまだ無い | 既存分の移行は個別タスク（ルール38参照） |

### 一元化を検討する際の論点

1. **ゲートウェイの統一方針をどこに置くか**
   SSHはZero Trust Access、HTTPS公開エンドポイントもZero Trust Accessで統一できる可能性があるが、
   Cursor Background Agent APIのような「このWorkerから外部SaaSへの直接呼び出し」はTunnel配下に
   置く設計にはそもそもなり得ない（Cursor側がTunnel越しの着信を受ける側になるわけではなく、
   本体Workerが発信側）。経路の性質（着信か発信か）によって一元化の手段が異なることを前提にする。

2. **発信側（Cursor API等）の集約**
   発信系の経路はAccess/Tunnelの対象ではなく、ルール38の「CF-Worker HMAC」方針や、APIキーの
   一元管理（シークレットの命名規則統一・ローテーション手順の統一）で集約する方向になりうる。

3. **着信側（HTTPS公開エンドポイント）の集約**
   Webhook/OAuth callbackのように未認証であるべきエンドポイントと、`/access-verify`のように
   認証を要求すべきエンドポイントが同一Worker・同一ホストに混在しているため、ホスト全体への
   Access Application適用はできない。パス単位のスコープ設計（既にNOTICEで提案済み）か、
   エンドポイントの分離（別Worker・別サブドメインへの切り出し）が論点になる。

4. **優先順位**
   実験的機能を素早く立ち上げる価値と、集中制御による運用の見通しやすさはトレードオフになる。
   現時点ではどの経路も「動いている」ため緊急の修正課題ではなく、次にこの種の経路を追加する前に
   設計を一度まとめておく、という位置づけで進める。

### 注意事項

- 本章は現状の棚卸しのみであり、具体的な実装方針（どの経路をいつどう変更するか）はまだ決定していない。
- 本セッションには`CLOUDFLARE_API_TOKEN`が無く、Zero Trustダッシュボードの設定確認・変更は
  ユーザー側の作業である。この章の内容もダッシュボードの実データを見ながら更新していく前提。
