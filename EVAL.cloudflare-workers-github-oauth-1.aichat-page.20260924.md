# EVAL.cloudflare-workers-github-oauth-1.aichat-page.20260924

## 対象

**対象**: `/aichat`ページ(`src/views/aichat.ts`、AIチャット本体)を中心に、
メッセージ送信フロー・モデル選択とフォールバック・レート制限・画像添付・
共有機能・「探索の境界線」/自動探索・キーワード分類システムについて、
あるべき設計と現状実装を突き合わせて評価する。

チャート機能とスラッシュコマンド(`/neko ...`)一覧は既存の
[`EVAL.cloudflare-workers-github-oauth-1.ai-chat.20270917.md`](EVAL.cloudflare-workers-github-oauth-1.ai-chat.20270917.md)
で調査済みのため本書では扱わない。「探索の境界線」/自動探索の詳細な
仕様は[`SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md`](SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md)
を参照し、本書ではその設計と現状実装のギャップだけを評価する。

対象コード: `src/index.ts`(`/api/aichat`まわり)、`src/views/aichat.ts`、
`src/views/aichat-share.ts`、`src/utils/aichatImage.ts`、
`src/utils/vectorizeAndBulkRegister.ts`。

---

## 0. 全体像

`/aichat`は「1人のユーザー向け個人用AIチャット」として、単発の質問応答に
留まらず、共有リンク発行・回答のベクタ化とキーワード抽出・キーワードの
カテゴリ分類・分類の自動化(自動探索)・日次統計・画像添付(Moondream連携)
まで一体化した多機能ページになっている。中核の送信フロー自体は
モデルフォールバック(primary→fallback→secondFallback)・レート制限・
画像/テキスト両対応と、堅牢に作られている。一方で、機能が積み重なった
結果として以下2種の問題が見られる。

1. **エラーの握りつぶし方がCLAUDE.mdルール8(記録・通知・テストの3点セット)を
   満たしていない箇所が残っている**(1節)
2. **機能同士の相互作用が想定されていない**(自動探索とレート制限、2節)

---

## 1. メッセージ送信フロー・モデル解決・レート制限

**対象**: `POST /api/aichat`(`src/index.ts`約6180-6280行台)、
`resolveAichatModelsForRequest`(`src/utils/aichatImage.ts`)、
`checkAiChatRateLimit`(`src/index.ts`3645-3662行)。

### あるべき設計

- 選択中モデルが使えない・失敗する場合でも、ユーザーに何も返らないことは
  避け、フォールバックモデルで自動的に応答する
- レート制限は「制限がかかっていること」自体が目的ではなく、Workers AIの
  過剰呼び出しを防ぐための保険。保険が壊れている(判定ロジックが例外で
  落ちている)場合はその事実が分かるようにしておく必要がある(CLAUDE.md
  ルール8: 握りつぶすなら記録・通知・テストの3つを満たす)

### 現状実装

- `resolveAichatModelsForRequest`は、画像添付時は
  vision対応2モデル(`llama-4-scout-17b-16e-instruct`/`gemma-4-26b-a4b-it`)+
  `moondream3.1`の3モデルで完結させ、テキスト専用モデルには送らない設計
  になっている。画像なし時はユーザー選択モデルが`AICHAT_ALLOWED_MODELS`に
  含まれなければ`configuredModel`(環境変数)→`textFallbackModel`
  (`llama-3.3-70b-instruct-fp8-fast`固定)の順にフォールバックする
- `checkAiChatRateLimit`(D1ベース、1ユーザーにつき1分あたり
  `AICHAT_RATE_LIMIT_PER_MIN = 10`件)は、以下の2つのフェイルオープン経路を持つ:
  - `db`が渡されない場合 → `return false`(制限しない)。これは
    `src/aichat-rate-limit.test.ts`で「安全側フォールバック」として
    **意図的な仕様としてテストされている**
  - `db.prepare(...).run()`自体が例外を投げた場合(D1障害・SQLエラー等)
    → `catch { return false }`で**同じく制限しない側へ倒れるが、こちらは
    ログ出力もテストも無い**。CLAUDE.mdルール8の「記録」「テスト」の
    どちらも満たしていない

### 評価

- モデルフォールバックの設計・実装は妥当で、テストも揃っている
  (`resolveAichatModelsForRequest`はページ非依存の純粋関数として切り出され、
  単体テスト可能な形になっている)
- レート制限の**「DBはあるが問い合わせ自体が失敗した」ケース**は、
  「意図的にフェイルオープンにする」のか「本来は検知すべき障害」なのかが
  コード上区別できない。`catch {}`だけで`logger.error`すら呼んでいないため、
  D1側で断続的な障害が起きていても`/aichat`のレート制限だけが静かに
  効かなくなり、誰も気付けない。CLAUDE.mdルール8に沿って、最低限
  `logger.error`でエラー内容を記録し、「DB例外による無制限フォールバック」
  を検証するテストケースを追加すべき

---

## 2. 「探索の境界線」/自動探索とレート制限の相互作用

**対象**: [`SPEC...auto-explore.md`](SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md)
で詳述した自動探索機能と、1節のレート制限の組み合わせ。

### あるべき設計

自動探索が「入力待ちを挟まず連鎖的に問い合わせる」機能である以上、
1分間に発行しうる`POST /api/aichat`の件数の上限(レート制限)を
意識した設計になっているべきである。上限に達したときにユーザーへ
分かりやすく伝わるか、あるいは上限を踏まえた速度調整がされているべき。

### 現状実装

- 自動探索は`AUTO_EXPLORE_MAX_LEVELS = 3`・`AUTO_EXPLORE_LEVEL_LIMIT = 20`で、
  理論上は1回の実行で最大60キーワード分の`POST /api/aichat`を**間隔調整なしで
  直列に**発行しうる
- 一方`checkAiChatRateLimit`は1ユーザー1分あたり10件で429を返す
- 自動探索の`autoExploreProcessKeyword`は「AI問い合わせ」段階で
  `res.status`が2xx範囲外なら即座に例外を投げ、`autoExploreRunCandidates`の
  Promiseチェーンはその時点で**自動探索全体を打ち切る**(4-3節参照)設計

### 評価

- 選択・入力したキーワードが数件程度(1階層目だけ)なら10件/分の枠に
  収まるため問題にならないが、**2階層目以降で新たに抽出されたキーワードへ
  自然に掘り下がっていく設計**(`autoExploreNextLevelCandidates`)は、
  「1分間に10件」という上限に対して何の考慮もしていない。1分間に
  11件目の問い合わせが発生した時点で429となり、自動探索は
  「自動探索を途中で停止しました(リクエストが多すぎます。しばらく
  待ってから再試行してください。) 分類済み◯件 / 未分類◯件」という
  **やや不親切なエラー文言**(429であることはトーストからは分からない)で
  停止する。ユーザーから見ると「なぜか自動探索がすぐ止まる」という
  体験になりうる
- 対処案としては、(a) 自動探索側で1リクエストごとに一定間隔(例: 6秒)を
  空けてレート制限内に収める、(b) 429エラーだけは特別に検知し
  「レート制限に達したため一時停止しました。1分待って再開してください」
  のような専用文言を出す、のいずれかが考えられる。現状はどちらも
  実装されていない

---

## 3. 画像添付(Moondream連携)

**対象**: `src/utils/aichatImage.ts`、`buildMoondream3RunParams`。

### あるべき設計

- 対応外フォーマット・サイズ超過は明確なエラーメッセージでユーザーに伝える
- 実験的・不安定なモデル呼び出しは、失敗しても他の手段でカバーされる
  (単一障害点にしない)

### 現状実装

- `validateImageDataUrl`がMIMEタイプ(png/jpeg/webp/gifのみ)とサイズ上限
  (base64換算で約6MB相当)をその場で検証し、理由付きのエラーを返す設計は
  素直で妥当
- `moondream3.1`(`AICHAT_MOONDREAM3_MODEL`)はコード内コメントで
  「入力スキーマが不安定」「この形式で解消するかは未検証」と**実装者自身が
  明記した上で**、画像添付時のfallback/secondFallbackの一部としてのみ
  使う設計になっている。primaryモデル(vision対応2モデル)が失敗した場合の
  保険であり、moondream3.1自体が失敗しても`secondFallbackModel`
  (もう一方のvisionモデル)へさらにフォールバックするため、画像分析全体が
  単一障害点になることは避けられている

### 評価

- 不確実な外部モデル呼び出しを「保険の一枚」として扱い、失敗を前提に
  設計している点は評価できる。追加の指摘事項は無い

---

## 4. 共有機能(`GET /s/:userHash/:shareToken`)

**対象**: `src/index.ts`の`POST /api/aichat`内`autoSave`(shareId生成)と
`GET /s/:userHash/:shareToken`(認証不要の公開ページ)。

### あるべき設計

- 共有リンクは「知っている人だけ」がアクセスできる想定なら、
  URLトークンは推測困難であるべき
- 削除済み・存在しない共有は404で扱い、内部エラーと区別できるべき

### 現状実装

- `shareId`は`crypto.getRandomValues`による8バイト(64bit)のランダム値を
  16進文字列化したもの。総当たりは現実的に不可能な強度
- クエリは`id = ? AND user_hash = ? AND deleted_at IS NULL`で、
  論理削除済み・存在しないトークンは`getAiChatShareNotFoundPage()`
  (404)を返す。アクセスのたびに`access_count`をインクリメントし
  `accessed_at`を更新する

### 評価

- 認証不要で公開する設計自体は「共有」機能としての要件を満たしており、
  トークン強度・削除済みの扱いともに妥当。追加の指摘事項は無い

---

## 5. 今後の課題(まとめ)

**対象**: 本評価で判明した、対応を検討すべき項目の一覧。

| # | 項目 | 深刻度 | 対応案 |
|---|---|---|---|
| 1 | `checkAiChatRateLimit`のDB例外握りつぶし(1節) | 中 — レート制限が静かに無効化されても気付けない | `catch`内で`logger.error`を追加し、DB例外時のフェイルオープンを検証するテストケースを追加する(CLAUDE.mdルール8) |
| 2 | 自動探索がレート制限(10件/分)を考慮していない(2節) | 中 — 複数階層に及ぶ自動探索が途中で不親切に停止しうる | リクエスト間隔の調整、または429エラー専用の案内文言を追加する |

上記いずれも、本書執筆時点(2026-09-24)では未着手。

---

## 6. 関連ドキュメント

- [`SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md`](SPEC.cloudflare-workers-github-oauth-1.20260924.auto-explore.md) — 「探索の境界線」/自動探索の詳細仕様
- [`EVAL.cloudflare-workers-github-oauth-1.ai-chat.20270917.md`](EVAL.cloudflare-workers-github-oauth-1.ai-chat.20270917.md) — チャート一覧・スラッシュコマンド一覧
- [`EVAL.cloudflare-workers-github-oauth-1.code-review.md`](EVAL.cloudflare-workers-github-oauth-1.code-review.md) — 「あるべき設計/現状実装/評価」フォーマットの先例
