# SPEC: /kimi-codeページの構造・機能・モデル・DBリレーション

## 1. 概要

**対象**: `/kimi-code` ページ(`src/views/kimiCode.ts`)、`POST /api/kimi-code/generate`・
`POST /api/kimi-code/gemma-review`・`GET /api/kimi-code/token-usage`(`src/index.ts`)、
D1 `kimi_code_generate_log`・`kimi_gemma_reviews`テーブル、AIチャット左サイドパネル
検索対象(`target=kimi-gemma`)への統合部分。

`kimi-k2.7-code`(従量課金のコード生成モデル)にプロンプトを送ってコードを
生成し、生成結果を`gemma-4-26b-a4b-it`(無料枠のレビューモデル)にレビュー
させて保存・検索できるページ。「コードレビュー」機能のうち、
[`EVAL.cloudflare-workers-github-oauth-1.code-review.md`](EVAL.cloudflare-workers-github-oauth-1.code-review.md)
でいう**B系統**(kimi-gemmaコードレビュー)の実体にあたる。

## 2. 使用モデルとその役割

**対象**: `src/index.ts` の `KIMI_CODE_MODEL`・`GEMMA_CODE_REVIEW_MODEL` 定数。

| 定数 | モデルID | 役割 | 課金 |
|---|---|---|---|
| `KIMI_CODE_MODEL` | `@cf/moonshotai/kimi-k2.7-code` | プロンプトからのコード生成(1次生成) | 従量課金(入力$0.95/1Mトークン・出力$4.00/1Mトークン、画面上に警告表示) |
| `GEMMA_CODE_REVIEW_MODEL` | `@cf/google/gemma-4-26b-a4b-it` | 生成済みコードへの外部レビュー(2次評価) | Workers AI無料枠 |

2つのモデルは常に**直列**で使われる(kimi-k2.7-codeの生成結果が
gemma-4-26b-a4b-itの入力になる)。並列比較や多数決のような使い方はしていない。
GitHub PR要約パイプライン(A系統)で既定モデルとして使われている
`gemma-4-26b-a4b-it`と、レビュー用途で同一モデルを再利用している点は
A/B系統間の数少ない共通点である(ただしテーブル・IDは完全に独立)。

## 3. ページ構造(UI)

**対象**: `src/views/kimiCode.ts`。

上から下へ、生成→レビュー→集計の順に並ぶ縦1カラム構成。

1. **システムプロンプト欄**(任意、`#kimiSystemPrompt`)
2. **プロンプト欄**(必須、`#kimiPrompt`)+ 従量課金の警告バナー(`.cost-note`)
3. **「生成する」ボタン**(`#kimiGenerateBtn`)→ `POST /api/kimi-code/generate`
4. **生成結果パネル**(`#kimiOutput`、コピー ボタン付き)+ このリクエストの
   トークン数表示(`#kimiTokenNote`)
5. **「🔎 Gemmaにレビューさせる」ボタン**(`#kimiGemmaBtn`、生成成功まで
   `display:none`)→ `POST /api/kimi-code/gemma-review`
6. **Gemmaレビュー結果パネル**(`#kimiGemmaPanel`、レビュー成功まで
   `display:none`)。「保存済み。左サイドパネルの検索対象で
   『kimi-gemma』を選ぶと後で検索できます」という導線文言を明記
7. **トークン利用量パネル**(`#kimiUsageBody`、直近6か月・モデル別合計。
   ページを開くたびに自動読み込み、再読み込みボタンあり)

生成・レビューのいずれも失敗時は専用のエラー表示領域(`.error-msg`)に
サーバーからのエラーメッセージをそのまま表示する(HTTPステータス+
本文冒頭200文字のフォールバック表示も持つ)。

## 4. DBスキーマとリレーション

**対象**: `migrations/0117`〜`0119`。

| テーブル | 主なカラム | 用途 |
|---|---|---|
| `kimi_code_generate_log` | `id`(PK, AUTOINCREMENT), `user_id`, `model`, `input_tokens`, `output_tokens`, `total_tokens`, `created_at` | `kimi-k2.7-code`への生成リクエスト1件ごとのトークンログ。生成した時点で、この後Gemmaレビューに進むかどうかに関わらず必ず1件残す |
| `kimi_gemma_reviews` | `id`(PK, TEXT/UUID), `user_id`, `kimi_prompt`, `kimi_code`, `gemma_prompt`, `gemma_response`, `gemma_model`, `gemma_input_tokens`, `gemma_output_tokens`, `gemma_total_tokens`, `created_at` | Gemmaレビューを実行した場合のみ1件作成。生成コード・レビュー結果を1行にまとめて保存 |

**リレーションの特徴**: `kimi_code_generate_log`と`kimi_gemma_reviews`の間に
**外部キー・共有IDは無い**。両者は独立したテーブルで、`user_id`でしか
結びつかない(同一ユーザーの行を`created_at`の近さで人間が類推することは
できるが、DB上のJOINキーは存在しない)。これは意図的な設計というより、
「生成は毎回記録するが、レビューは任意操作なので別テーブル」という
機能追加の順序をそのまま反映した結果である。

`ai_chat_shares`(通常のAIチャット履歴)とも接続していない。`kimi_gemma_reviews`
は完全に独立したデータソースであり、AIチャット側の検索・表示ロジックは
「target=kimi-gemmaの場合だけ`kimi_gemma_reviews`を参照する」という
分岐で後付けされている(後述5節)。

## 5. AIチャット検索統合(target=kimi-gemma)の特殊設計

**対象**: `searchKimiGemmaReviews()`・`getAichatShareDetail()`(`src/index.ts`)、
AIチャット左サイドパネルの検索対象切替(`src/views/aichat.ts`)。

AIチャット左サイドパネルの検索対象アイコンは
`llama-4 → moondream3.1 → kimi-gemma` の3択循環式で、kimi-gemmaを選ぶと
`kimi_gemma_reviews`をキーワード検索できる([`225430d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/225430d)で
「切り替わっていることに気づけない」問題を解消し、アイコン+ツールチップを導入)。

この検索結果を通常の質問/回答バブルの型(`question`/`answer`)にどう
割り当てるかが設計上の要点で、以下のルールを一貫させている。

- `question` ← `kimi_prompt`(生成指示そのもの)
- `answer` ← `kimi_code`(実際に生成されたコード。**gemma_responseではない**)
- `review_note` ← `{ label: 'Gemma(<model>)によるレビュー', text: gemma_response }`
  という専用フィールドに分離

これは[`109010f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/109010f)で
明確化された設計判断で、コミットメッセージの通り「kimi-gemmaの回答/レビューを
1問1答の型に無理に押し込めず別要素として表示する」ことを目的とする。仮に
`gemma_response`を`answer`に割り当てると、質問(生成指示)に対する回答が
「別モデルによるレビュー文」になってしまい、実際に生成されたコード自体が
どの画面にも表示されなくなるバグを避けるための設計である。

[`b343e12`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b343e12)で
`getAichatShareDetail()`(応答バブルモーダル用)にも同じ`review_note`分離
ロジックが適用され、検索一覧・詳細モーダルの両方で一貫した表示になった。

## 6. トークン利用量集計

**対象**: `getKimiCodeTokenUsage()`(`src/index.ts`)、`GET /api/kimi-code/token-usage`。

`kimi_code_generate_log`(生成)と`kimi_gemma_reviews`(レビュー、
`gemma_*_tokens`列)の2テーブルを`UNION ALL`し、`period`(月 or 日)・
`model`別に`SUM`する。トークン数が記録されていない行(呼び出し失敗時や
この機能追加前の既存データ)は`input_tokens IS NOT NULL`条件で合算対象から
除外する。[`90816a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/90816a2)で
追加され、ページ側では直近6か月をデフォルト表示する。

## 7. 機能追加の時系列

| 日時 | コミット | 内容 |
|---|---|---|
| 2026-08-31 08:19 | [`531de70`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/531de70) | kimi-k2.7-codeにプロンプトを送ってコード生成する新ページを追加(初版) |
| 2026-08-31 08:26 | [`0664730`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0664730) | 生成APIで応答が空になる不具合を修正(choices形式に未対応だった) |
| 2026-09-01 00:11 | [`2101493`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2101493) | 生成コードをgemma-4にレビューさせた結果を保存・検索できるようにする(kimi_gemma_reviews新設) |
| 2026-09-01 00:52 | [`225430d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/225430d) | サイドパネル検索対象がkimi-gemmaに切り替わっていることを常時視認できるようにする |
| 2026-09-01 02:07 | [`b343e12`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b343e12) | kimi-gemmaレビュー詳細に生成コード本文も含めて返すよう修正 |
| 2026-09-01 03:51 | [`109010f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/109010f) | kimi-gemmaの回答/レビューを1問1答の型に無理に押し込めず別要素として表示する |
| 2026-09-01 07:10 | [`90816a2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/90816a2) | リクエストごとのトークン数を記録・集計できるようにする(kimi_code_generate_log新設、token-usage API追加) |

初版から約8時間で「生成のみ」から「生成→レビュー→検索→トークン集計」まで
一気通貫の機能が揃っている。バグ修正(choices形式未対応)は初版公開の
直後に発生・即日対応されている。

## 8. 注意事項

- `kimi-k2.7-code`は従量課金モデルであるため、`kimi_code_generate_log`は
  レビューに進むかどうかに関わらず**生成した時点で必ず1件記録する**設計に
  なっている。この記録を欠かすとコストの実態把握ができなくなるため、
  `/api/kimi-code/generate`のロジックを変更する際は記録処理を削らないこと。
- `kimi_gemma_reviews.id`はUUID(TEXT)、`kimi_code_generate_log.id`は
  AUTOINCREMENT(INTEGER)と主キー型が異なる。将来この2テーブルを
  外部キーで結びつける場合は型の統一が必要になる。
- AIチャット側の検索結果・詳細モーダルで`target=kimi-gemma`を扱う分岐
  (`searchKimiGemmaReviews`・`getAichatShareDetail`)は、他の検索対象
  (`llama-4`・`moondream3.1`)と実装場所は共通だが、内部的にはテーブルも
  行の意味づけ(`answer`＝生成コード、レビューは別フィールド)も全く別物
  である。新しい検索対象を追加する際は、このtarget分岐パターンに倣うか
  どうかを都度判断すること(このリポジトリでは「後から見た目だけ揃える」
  設計を意図的に避け、実データの意味に応じて表示側の型を変えている)。
