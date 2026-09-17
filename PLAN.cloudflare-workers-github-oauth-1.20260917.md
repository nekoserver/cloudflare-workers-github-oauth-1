# Jev(TypeSafe AI System One Model)によるAI回答モデル比較計画

## 1. 目的

**対象**: dynamicnekoの`/ai-cache`ページ、cloudflare-workers-github-oauth-1側のAIチャット回答
キャッシュ(`aichat_answer_vectors`等)、新規D1テーブル`jev_labels`/`jev_evaluations` —
キャッシュ済みのAI回答を1件ずつ読み返すことなく、モデルごとの大まかな精度・傾向を把握
できるようにする。

Jevは文章生成・要約向けの通常のLLMとは異なり、あらかじめ決めた候補・尺度に対して
高速・低コストに確率的な判定(`noul`=Yes/No確率、`choice`=候補選択、`score`=段階評価)
だけを返すモデル(2026年9月15日アーリーアクセス公開、$0.042/100万入力トークン)。
本計画では「回答を全部読まなくても、モデルごとにどれだけ優れているかの粗い指標が欲しい」
というニーズに対し、Jevを個々の回答の確定ラベル付け役、既存のベクトル埋め込みを類似検索・
重複スキップ役として役割分担させる。

**現状のステータス**: Jev APIキー取得済み(`wrangler secret put JEV_API_KEY`で設定)。
実装に着手する。

## 2. 全体フロー

```
① dynamicneko /ai-cache の回答カード(CardChrome、ai-cache-question-row.tsx)
   titleRightに一括処理ボタンを追加
        ↓ クリック
② cloudflare-workers-github-oauth-1側のAPIへリクエスト
   (対象範囲: 今開いている質問グループ分のみ)
        ↓
③ 未処理分だけ抽出
   jev_evaluationsに(target_type, share_id, model, jev_label_id)が
   無い組み合わせ = 未処理、として重複を防ぐ
   (任意の最適化: aichat_answer_vectorsでほぼ同一の回答が既に
    評価済みならJev呼び出し自体を省略し、そのラベルを流用する)
        ↓
④ 未処理分だけJev APIへ投げる(score中心、20ラベルを並列評価)
        ↓
⑤ 結果を保存
   jev_labels(ラベルは追記専用・不変)
   jev_evaluations(target_type, share_id, model, jev_label_id, value)
        ↓
⑥ モデルごとにGROUP BY集計 → 比較表示(グループ平均→詳細20ラベル→元キャッシュ本文)
```

**`share_id`が全ての紐付けの起点**であることが重要。ai-cacheの回答文は
既に`(質問ID, モデル名)`で一意に識別されており、その質問IDは過去ログ検索の
キーワードとも結びついている。分析結果をこの`share_id`にそのまま
紐付けることで、既存の「検索キーワード→質問ID→モデル→回答本文」という鎖に
Jevの分析結果が輪として加わるだけになり、迷子になるデータが生まれない。

LLMへの再エスカレーション(疑問点を埋めるために別のAIへ聞き直す)は、
「モデル比較の粗い指標が欲しいだけ」という目的には不要と判断し、対象外とした。
CI監視(GitHub webhook→Slack通知の判定)へのJev導入も、ChatGPT通知で既に
高精度にカバーできているため優先度を下げた。

## 3. テーブル設計

**対象**: 新規テーブル`jev_labels`・`jev_evaluations` — ラベルを追記専用にし、
ラベルが増えても過去の評価データと矛盾しないようにする。「ai-cacheの質問ID」と
「JevのラベルID」が同じ`question_id`という言葉で混同しないよう、列名を
`share_id`(ai-cache側の質問ID)と`jev_label_id`(JevのラベルID)に分けて
明確に区別する。

```sql
CREATE TABLE jev_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_type TEXT NOT NULL,      -- noul / choice / score
  question_text TEXT NOT NULL,
  options_json TEXT,                -- choice/scoreの候補一覧
  group_name TEXT NOT NULL,         -- 表示グループ(下記4分類)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE jev_evaluations (
  target_type TEXT NOT NULL,        -- 'answer' または 'source_question'
  share_id TEXT NOT NULL,  -- ai-cache側の質問ID(AiCacheQsearchRow.id)
  model TEXT,                       -- source_questionの場合はNULL(モデル非依存)
  jev_label_id INTEGER NOT NULL REFERENCES jev_labels(id),
  value REAL NOT NULL,              -- 0〜1のscore/probability
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (target_type, share_id, model, jev_label_id)
);

CREATE INDEX IF NOT EXISTS idx_jev_evaluations_share_id ON jev_evaluations(share_id);
```

### 設計判断のポイント

- **`jev_labels`は追記専用(UPDATE禁止)**。質問文を変えたくなったら新しい行を追加する。
  同じ`jev_label_id`が指す質問文は永久に変わらないため、過去の`value`と矛盾しない
- **集計は必ず`jev_label_id`で明示的にJOINする**。score列を1本にまとめて雑平均しない
- **`share_id`が全ての紐付けの起点**。ai-cacheの回答文は既に
  `(share_id, model)`で一意に識別されており、その質問IDは過去ログ検索の
  キーワードとも結びついている。分析結果を同じ`share_id`に紐付けることで、
  既存の「検索キーワード→質問ID→モデル→回答本文」の鎖にそのまま乗る(片方だけ
  持ち回るコードは書かない)
- **`target_type`で「回答」と「元の質問文」を同じラベルで評価できる**。回答が曖昧なとき、
  モデルの問題か質問の聞き方の問題かを、同じラベルを両方に適用して切り分けられる
  (質問の具体性が高いのに回答の具体性が低い→モデルの問題、質問の具体性自体が
  低い→聞き方の問題)
- ベクトル埋め込み(`aichat_answer_vectors`)とJevは役割分担: ベクトルは類似検索・
  重複スキップ用、Jevは固定ラベルへの確定ラベル付け用

## 4. ラベル(初期セット・20ラベル・4グループ)

**対象**: `jev_labels`への初期投入行 — 「良し悪し」を2値ではなく0〜1の連続score
(両極を明示)として表現し、質問側の原因切り分けにも同じラベルを使い回す。

| グループ | ラベル | 悪い状態(0側) | 良い状態(1側) |
|---|---|---|---|
| 事実の正確さ | 事実性 | 事実誤認(あり得ないことを言っている) | 事実として正しい |
| 事実の正確さ | 根拠 | 根拠・出典が不足 | 根拠が明示されている |
| 事実の正確さ | 出典品質 | 出所不明・低信頼 | 一次情報・適切な資料 |
| 事実の正確さ | 出典整合性 | 出典が主張を支えていない | 主張が出典で裏付けられる |
| 事実の正確さ | 検証可能性 | 確認不能な主張 | 第三者が検証可能 |
| 事実の正確さ | 鮮度 | 情報が古い可能性 | 最新情報に基づいている |
| 論理・整合性 | 整合性 | 文中で矛盾する | 前後で一貫している |
| 論理・整合性 | 論理性 | 結論と根拠がつながらない | 推論関係が成立 |
| 論理・整合性 | 完全性 | 必要事項が欠落 | 必要事項を網羅 |
| 論理・整合性 | 網羅性 | 重要な例外・条件を落とす | 主要な条件・例外を含む |
| 伝わりやすさ | 明確性 | 曖昧・多義的 | 意味が一意に取れる |
| 伝わりやすさ | 具体性 | 一般化しすぎ | 具体的事象を説明している |
| 伝わりやすさ | 簡潔性 | 冗長・重複が多い | 必要十分 |
| 伝わりやすさ | 定量基準 | 大小・遠近・重軽・広狭・長短等の比較表現に基準が無い | 比較の基準・単位が明示されている |
| 応答姿勢・手続き | 関連性 | 質問から逸れている | 質問に直接答えている |
| 応答姿勢・手続き | 文脈適合性 | 条件・対象を取り違える | 与えられた条件に沿う |
| 応答姿勢・手続き | 指示遵守 | 指定形式・条件を無視 | 指示を満たす |
| 応答姿勢・手続き | 不確実性の明示 | 推測を断定する | 不明・推定を区別 |
| 応答姿勢・手続き | 客観性 | 主観・憶測が混ざる | 客観的・検証済み |
| 応答姿勢・手続き | 再現性 | 同条件でも判定基準が揺れる | 同一基準で再判定可能 |

ラベルは今後いつでも追加できる(`jev_labels`への追記のみ、スキーマ変更不要)。

## 5. UI設計

**対象**: dynamicneko `/ai-cache`(`ai-cache-question-row.tsx`)の回答カードと、
新規のモデル比較画面(場所未定) — 「普段は数字とグループ平均だけ見て、
気になった時だけ実際の回答本文まで潜れる」3階層構成にする。

1. **一覧(モデル比較のトップ)**: モデル×4グループの平均scoreを表として表示
   (Markdownテーブル形式、罫線文字は使わない)
2. **モデル行クリック→詳細**: 20ラベルの内訳と、score/フラグが低かった回答だけの一覧
3. **回答行クリック→本文**: `/ai-summary/{id}`と同じパターンで元のキャッシュ本文へ
   リンク(rule 22相当)

一括処理ボタンは`/ai-cache`の回答カード(`CardChrome`)の`titleRight`propに配置する
(タイトル文字列右側に任意コンポーネントを埋め込む既存の仕組みをそのまま使える)。

**左サイドパネルの質問文リストの色分け**(優先度低・いつでも実装可): `/ai-cache`
左サイドの質問文一覧(`ai-cache-question-row.tsx`)で、その質問の回答に既にJev
評価結果(`jev_evaluations`に該当行)がある場合は、リスト項目の背景色を緑にして
一目で区別できるようにする。判定は`share_id`の存在チェックだけで済む
(qsearch結果を返す際に`jev_evaluations`をJOINして`has_jev_result`フラグを
一緒に返す形が実装しやすい)。

## 6. 決定事項・残タスク

- Jev APIキー: **取得済み**(`JEV_API_KEY`という名前で`wrangler secret put`設定)
- 一括処理ボタンの対象範囲: **今開いている質問グループ分のみ**(キャッシュ全体の
  一括処理は行わない)
- モデル比較結果の表示場所: **`/ai-cache`側にモーダルで簡易表示**(専用ページは後回し)
- Jev呼び出しのタイミング: **オンデマンドのみ**(ボタン押下時。cron等の定期実行なし)
- 過去分の回答へのラベルバックフィル: **なし**(今後の新規評価分から対象。新しいラベルを
  追加しても既存データと矛盾しない設計のため、後から気が向いた時にバックフィル
  ジョブを別途書けばよい)

### 実装タスク

1. D1マイグレーション: `jev_labels`(初期20ラベルをINSERT)・`jev_evaluations`
2. コピペ用SQL(CLAUDE.mdルール14: `wrangler d1 execute`でそのまま実行できる形)
3. cloudflare-workers-github-oauth-1にJev呼び出し用APIエンドポイントを追加
   (未処理分だけ抽出→Jevへ→D1保存。`share_id`/`model`/`jev_label_id`の
   紐付けを崩さないこと)
4. dynamicneko `/ai-cache`の回答カード(`CardChrome`の`titleRight`)に
   一括処理ボタンを追加
