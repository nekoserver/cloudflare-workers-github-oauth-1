# NOTICE.cloudflare-workers-github-oauth-1.20260806.md

## D1への問い合わせ時のクエリ最適化(answer-graphのN+1問題)

### 症状

`/answer-graph` のグラフ取得(`POST /api/aichat/answer-propagation-graph`)で
断続的に503エラー(Cloudflareのエッジ側エラーページ、Workerのコードにすら
到達していないか、CPU/D1負荷超過でクラッシュしている状態)が発生した。
ユーザー報告により「D1への負荷がかなりかかっている」ことが判明。

### 原因(N+1クエリ)

`buildAnswerPropagationGraph`(`src/index.ts`)は起点回答からBFSでグラフを
広げる際、各層のキーワードごとに`ai_chat_shares`を`INSTR(question,?)>0
OR INSTR(answer,?)>0`で部分一致検索する個別クエリを、**キーワード1件に
つき1回**発行していた(旧`findSharesContainingKeyword`)。

`INSTR`はインデックスが効かない部分一致検索のため、1クエリ自体が
ユーザーの全共有行をフルスキャンする重いクエリである。さらに第1層
(起点回答直下)のキーワード数は仕様上無制限([起点回答自身の全キーワード
を欠落なく見せる]という別の意図的な仕様のため)なので、キーワードが多い
起点だと1回のグラフ取得リクエストで数十〜数百回のフルスキャンが積み
重なり、D1負荷が跳ね上がっていた。

### 教訓: 「ループ内でDBクエリを1件ずつ発行していないか」を疑う

- 一覧・BFS・ページネーションなど「複数の項目を順に処理するループ」の
  中に`db.prepare(...).bind(...).all()`が入っていたら、まずN+1を疑う
- 特に`INSTR`/`LIKE`のような**インデックスが効かない検索**をループ内で
  繰り返すと、1回あたりのコストも大きい分だけ被害が大きい
- 「1件あたりの負荷が小さいから大丈夫」ではなく、**ループの反復回数が
  ユーザーの入力(この場合はキーワード数)に応じて増減する**設計は、
  データが増えた特定ユーザーだけで突然重くなる/落ちる、という形で
  遅れて顕在化するため気づきにくい

### 対処: バインド上限に収まる単位でバッチ化する

個別クエリを、同じ層のキーワードをまとめた1回(またはD1のバインド
パラメータ上限`D1_MAX_BOUND_PARAMS=90`に収まる少数回)のクエリに変更した
(`findSharesContainingKeywords`、複数形)。

```
WHERE user_id = ? AND deleted_at IS NULL AND (
  (INSTR(question, ?) > 0 OR INSTR(answer, ?) > 0) OR
  (INSTR(question, ?) > 0 OR INSTR(answer, ?) > 0) OR
  ...
)
```

1キーワードにつきquestion用・answer用の2バインド値を使うため、
`chunkBindValues(keywords, Math.floor((D1_MAX_BOUND_PARAMS - 1) / 2))`で
分割してからクエリを発行する。取得結果はJS側で「どのキーワードに
マッチしたか(`row.question.includes(kw) || row.answer.includes(kw)`)」を
判定して`Map<keyword, rows[]>`に振り分け、既存の
`maxAnswersPerKeyword`(キーワードごとの取得件数上限)もJS側の
`list.length < limitPerKeyword`チェックで維持した。

このパターン(バインド上限チャンク分割によるバッチ化)は既に
`findKeywordsForShares`(`src/index.ts`)で先行実装されていたので、
同じ考え方を流用した。

### テストでの検証方法

D1クエリの発行回数そのものをアサートするテストを追加した
(`src/aichat-answer-propagation-graph.test.ts`)。`node:sqlite`の
`DatabaseSync`をラップするテスト用D1アダプタの`prepare()`にカウンタを
仕込み、「キーワード数を増やしてもINSTR検索クエリの発行回数がキーワード数に
比例して増えない」ことを直接検証する。単に結果の正しさ(件数・内容)だけを
見るテストだと、N+1のような「結果は正しいが遅い/重い」バグは検出できない
ため、パフォーマンス上の劣化を防ぎたい箇所ではクエリ発行回数のカウントを
テストに含めるのが有効。

```ts
function wrapD1CountingInstrQueries(db, counter) {
  return {
    prepare(sql) {
      if (sql.includes('INSTR(question')) counter.count++;
      // ...
    },
  };
}
```

### 関連コミット

[`7dd83f7`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7dd83f7b92b2544a595692f170e0bf240ad63964) (answer-graph: 回答伝播グラフ構築のキーワード検索をバッチ化してD1負荷を削減、PR [#1279](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/1279))
