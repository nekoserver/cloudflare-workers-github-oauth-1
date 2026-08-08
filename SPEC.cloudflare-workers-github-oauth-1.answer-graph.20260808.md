# SPEC.cloudflare-workers-github-oauth-1.answer-graph.20260808.md

## 1. 回答文をベクタ化し、予備知識キーワードを回答文IDに紐付けて自動登録できるようにした

**対象**: `/answer-graph`ページの回答モーダル(`src/views/answerGraph.ts`)、
`POST /api/aichat/vectorize-answer`、`GET /api/aichat/answer-keywords`、
D1の`aichat_answer_vectors`・`aichat_answer_keyword_vectors`テーブル ——
既存回答文からのキーワード抽出・ベクタ化・過去ログ検索・キーワード登録
という一連の作業を、`/answer-graph`ページ内で回答文単位に完結させる。

### 背景

もともと`/answer-graph`には「この回答文をベクタ化する」ボタン
([`a2d85a5`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a2d85a5))
があり、回答文のベクタ化と予備知識キーワードの抽出(表示のみ)はできたが、
抽出したキーワードをAIチャットの検索キーワードとして実際に登録するには、
別途AIチャットページの左サイドパネル検索窓にキーワードを打ち込み、
📋ボタンから「検索ログ: 」モーダルを開き、「承認して登録」を押す、という
**完全手動**の作業が必要だった。本セッションでは、この一連の作業のうち
「キーワード抽出→回答文への紐付け登録」と「未登録キーワードの過去ログ検索
→登録」の2つを、`/answer-graph`ページ内から実行できるようにした。

途中でユーザーから「これはRAGの要件を満たしていると言えるか」という
問いがあり、以下のように整理した(会話メモとして記録):

- 満たしている部分: 回答文・キーワードのベクタ化(Indexing)、キーワードに
  よる過去ログ検索(Retrieval、ただしベクタ類似検索ではなくINSTR部分一致)
- 満たしていない部分: 検索結果をプロンプトに埋め込んで新しいAI応答へ
  反映する「Augmented Generation」の配線が無い。つまり現状は
  「セマンティック検索基盤(vector store)+キーワード全文検索」であり、
  RAGの前提条件は揃っているが、RAGそのものではない
- 次の一歩(未着手): ベクタ類似検索→上位N件の過去回答をプロンプトに
  埋め込み→AIがそれを踏まえて回答する、という最後の配線を追加すること

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/index.ts` | `aichat_answer_keyword_vectors`テーブル新設(マイグレーション`0095`)。`isAnswerKeywordVectorized`/`getOrComputeAnswerKeywordEmbedding`/`vectorizeAnswerKeywords`で、抽出したキーワードを1件ずつループし回答文ID(share_id)に紐付けてベクタ化・登録する処理を追加 |
| `src/index.ts` | `hasAnswerKeywordVectors`/`listAnswerKeywordVectors`/`getKeywordOccurrenceCounts`/`buildKeywordOccurrenceList`/`getKeywordCategoryColors`/`mergeKeywordOccurrenceWithCategory`を追加。`GET /api/aichat/answer-keywords`で、回答文に登録済みのキーワード一覧を、AIチャットのキーワードテーブル(`aichat_search_log`)内での出現回数の多い順・分類カテゴリ色付きで返せるようにした |
| `src/views/answerGraph.ts` | ベクタ化済みの回答は「ベクタ化済み」バッジ+「キーワード一覧」(登録済みキーワードがある場合)/「キーワード抽出」(まだ無い場合)ボタンを表示するよう出し分け |
| `src/views/answerGraph.ts` | 「キーワード一覧」モーダルの表示をAIチャットページの🔑分類モーダルと同じ丸バッジスタイルに統一し、出現回数・分類色(分類済みはカテゴリ色、未分類は未分類色)を表示 |
| `src/views/answerGraph.ts` | 未登録キーワード(出現回数0件)が1件でもあれば「一括登録」ボタンを表示。押すと未登録キーワードごとに「検索(`/api/aichat/shares/search`)→open-modal(`/api/aichat/search-log/open-modal`)→承認して登録(`/api/aichat/search-log/approve`、未登録shareIdのみ)」を自動実行する。処理中のキーワードバッジへ外枠(中抜き)強調表示を移動させて進行状況を可視化 |

### 関連コミット

- [`5a9748f`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/5a9748f) 予備知識キーワードを回答文IDに紐付けてベクタ化・登録するループ処理を追加
- [`b7a7c9d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b7a7c9d) 予備知識モーダルにベクタ化結果モーダル(新規/スキップ/総数・了解ボタン)を追加
- [`3437d24`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3437d24) ベクタ化済み回答にキーワード登録状況で出し分ける「キーワード一覧」「キーワード抽出」ボタンを追加
- [`ae29605`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/ae29605) 「キーワード一覧」モーダルにAIチャットキーワードテーブル内の出現回数を表示
- [`34d8f62`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/34d8f62) 「キーワード一覧」を丸バッジ表示に変更しカテゴリ色で外枠を塗る
- [`c49b2cc`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c49b2cc) 「キーワード一覧」モーダルに未登録キーワードの一括登録ボタンを追加
- [`bc53ee0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bc53ee0) 一括登録処理の重複再登録排他を確認し、再入防止ガードを明示的に追加(PR未マージ)

### 注意事項

- **「まだ完全自動には早い」という位置づけ**: 今回自動化したのは
  「抽出済みキーワードを過去ログ検索して登録する」部分のみ。以下は
  引き続き人が介在する設計のままにしてある。
  - どのキーワードを抽出するか自体はAI(gemma-4-26b-a4b-it)の
    `extractPrerequisiteTerms`任せで、人による取捨選択が入らない
  - 「一括登録」は既に抽出されたキーワード群に対する検索→登録の自動化
    であり、抽出結果そのものを承認/却下する操作は用意していない
  - RAGの最終段(検索結果をプロンプトへ注入してAIに回答させる)は未実装
- 重複登録の排他は、クライアント側の`isNew`フィルタとサーバー側の
  `ON CONFLICT ... DO NOTHING`の二重構成で担保している
  (`bc53ee0`で再入防止ガードも追加済み)。
- `/api/aichat/shares/search`は1キーワードあたり最大30件、
  `search-log/open-modal`/`approve`は1回あたり最大50件の`shareId`までしか
  扱わない上限が既存実装にある。「一括登録」もこの上限をそのまま継承する。
