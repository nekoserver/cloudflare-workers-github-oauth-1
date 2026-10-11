# SPEC.cloudflare-workers-github-oauth-1.20261011.judgment-models-overview

## 判断特化型AI(Jev・Clef)の総論: 何が同じで何が違うか

**対象**: Jev(TypeSafe AI System One Model、`api.typesafe.ai`)と
Clef(Cloudflare Workers AI決定モデル、`@cf/cloudflare/clef`・
`clef-flash`)——本リポジトリで実際に使っている「自由生成せず、
state(評価対象)+questions(型付き質問)を受け取り、各質問の確率を
返す」タイプのAIモデル全般について、設計思想・機能・コスト・運用面の
違いを比較する。実装の現状(呼び出し箇所一覧)は
[`EVAL.cloudflare-workers-github-oauth-1.20261011.judgment-models-current-state.md`](EVAL.cloudflare-workers-github-oauth-1.20261011.judgment-models-current-state.md)、
今後の方針は
[`PLAN.cloudflare-workers-github-oauth-1.20261011.judgment-models.md`](PLAN.cloudflare-workers-github-oauth-1.20261011.judgment-models.md)
を参照。

---

## 1. 共通する設計思想: 「判断特化型AI」とは何か

両モデルとも、一般的なLLM(自由形式のテキスト生成)とは異なるカテゴリに
属する。

- **入力**: `state`(判定対象の本文・データ)+ `questions`(型付きの質問の集合)
- **出力**: 自由形式の文章ではなく、各質問に対する**確率・分類・順序尺度**
- **型付きの質問タイプ**: 「Yes/No」「複数選択肢から1つ」「順序尺度(程度)」の
  3種類という組み合わせ自体が両モデルで共通している(Jev=`score`型1種類に
  統一して使っているのに対し、Clefはこの3種類をネイティブにサポートする
  違いはある。詳細は3節)
- **1回の呼び出しで複数質問を一括処理**できる(本リポジトリのJev利用は
  ほぼ全て「1つのstateに対して最大20件のラベルを一括問い合わせ」する形)
- 自由生成ではないため、**出力フォーマットが安定していて後続のコードで
  パースしやすい**(LLMの自由文からJSONを抜き出すような脆さがない)

この設計思想自体が両者で一致しているため、本リポジトリの既存コード
(`jev_labels`+`jev_evaluations`のような「ラベル定義+評価結果」の
テーブル設計、`computeJevEvaluationPlan`のような「未評価分だけ問い合わせる」
ロジック)は、プロバイダがJevからClefに変わってもほぼそのまま使える
(呼び出し層だけの差し替えで済む可能性が高い)。

---

## 2. 比較表

| 項目 | Jev(TypeSafe AI) | Clef(Cloudflare Workers AI) |
|---|---|---|
| 搬送路 | 外部HTTPS(`api.typesafe.ai`)+ Bearer APIキー | Workers AIバインディング(`env.AI.run()`)、APIキー不要 |
| 課金 | TypeSafe AI側の契約・`JEV_API_KEY` | Cloudflareアカウントの Workers AI 利用料 |
| ネットワーク依存 | 外部サービスへの到達性が必要(本番Worker外からの障害の影響を受ける) | 同一アカウント内のバインディング呼び出し(外部到達性が不要) |
| モデルの可用性 | TypeSafe AI社のサービス稼働状況に依存 | Cloudflare Workers AIの稼働状況に依存(既存の`AI_CHAT_MODEL`等と運命を共にする) |
| 質問タイプ | 本リポジトリの利用では`score`型(2要素criteria)に統一 | `noul`(Yes/No)・`choice`(複数選択肢)・`score`(2〜10段階)をネイティブ区別 |
| 1リクエストの質問数上限 | 未公開(本リポジトリでは最大20件運用) | 公式仕様で1〜64件 |
| マルチモーダル対応 | 未確認(本リポジトリではテキストのみ利用) | `clef-flash`は`images`拡張フィールドで画像(PNG/JPEG/WebP、最大4枚)を状態に含められる。`clef-omni`は音声・動画も含む想定(本リポジトリでは未検証) |
| モデルの選択肢 | `jev-latest`固定 | `clef`(高精度)・`clef-flash`(低レイテンシ・低コスト)・`clef-omni`(マルチモーダル)から選択可 |
| スキーマの厳密さ | 本リポジトリの実測では、余分なフィールドをある程度許容する(`instructions`フィールドを含めても拒否されなかった) | `additionalProperties`が無い(未知のフィールドがあると`questions`全体を拒否する)。スキーマに厳密に従う必要がある(詳細は[`NOTICE.cloudflare-workers-github-oauth-1.20261011.md`](NOTICE.cloudflare-workers-github-oauth-1.20261011.md)) |
| オープンソース性 | 非公開(APIのみ) | モデル重みがHugging FaceでApache 2.0公開(セルフホスト可能) |
| 本リポジトリでの既存実績 | 2026年初頭から本番稼働中(AIチャット評価・脆弱性診断・テスト充足度診断・クエリパターン判定) | 2026-10-11にPlaygroundページのみ試験導入(本番の判定フローには未使用) |

---

## 3. 優位点の整理

### Jevが優位な点

- **既に本番で実績がある**。`jev_labels`・`jev_evaluations`・
  `jev_vuln_evaluations`・`jev_test_evaluations`・
  `jev_country_keyword_evaluations`・`jev_table_pattern_scores`と、
  複数のD1テーブル・複数の機能(AIチャット評価・コミット脆弱性診断・
  テスト充足度診断・国名キーワード評価・テーブル設計判定)で実運用され、
  スコアの意味論(0〜1の値がどう使われているか)が既存コード全体で
  確立している
- Cloudflareのサービス状況と**独立した**障害ドメインを持つ
  (Workers AI側で障害があってもJev評価は継続できる、逆も然り。
  単一障害点の分散という観点で意味がある)

### Clefが優位な点

- **外部APIキー管理が不要**(`JEV_API_KEY`のようなsecretのローテーション・
  失効管理から解放される)
- **ネットワーク到達性の問題が原理的に発生しない**(同一Cloudflareアカウント
  内のバインディング呼び出しのため、外部HTTPSの障害・レート制限・
  タイムアウトの影響を受けない)
- **質問タイプがネイティブに3種類ある**ため、現在Jevでは全部`score`型に
  押し込んでいる判定(実質Yes/Noに近い2段階score)を、本来の`noul`型で
  より自然に表現できる可能性がある(ただし意味論が完全に同じかは未検証、
  4節参照)
- **マルチモーダル(画像)に将来拡張しやすい**。例えばAIチャットの画像添付
  機能と組み合わせて「添付画像込みで判断させる」ような用途が将来出てきた
  場合、Clefなら`images`フィールドで直接渡せる(Jevでこれが可能かは
  未確認)
- **モデルの重みが公開されている**ため、最悪Cloudflare Workers AIの
  提供が終了してもセルフホストで移行する余地がある(Jevは完全に
  ベンダーロックイン)
- 1リクエストあたりの質問数上限が64件と明示されており(Jevは未公開)、
  将来「1つのstateに対してラベルを増やす」方向の拡張に対して仕様上の
  見通しが立てやすい

---

## 4. 未検証の論点(優劣を断定できない部分)

- **スコアの数値的な意味論が同じか**: Jevの`score`型(本リポジトリの
  全ラベルがこの型で、criteriaは2要素の「0側/1側」の説明)と、
  Clefの`score`型(2〜10段階の順序尺度、`score`フィールドは
  「確率加重された段階のインデックス」)は、2段階に限定した場合に
  数値的に同じ分布になるとは限らない。Clefの回答フィールド名が
  偶然`score`と一致している(既存の`extractScoreValue()`が素通りで
  拾ってしまう)ため、**ロジック上はすぐに動いてしまうが、出てくる
  数値の意味が変わっている可能性がある**。実データでの比較検証が
  必須(PLAN参照)
- **レイテンシ・コストの実測比較**: Jevの実측値は本リポジトリに記録が
  見当たらず、Clef(`clef-flash`)も本番負荷での実測がまだ無い
  (Playgroundでの単発確認のみ)
- **大量データでの挙動**: 本リポジトリのJev運用は基本1〜20ラベル/呼び出しの
  規模。Clefの64件上限付近での挙動(レイテンシ・精度)は未検証
