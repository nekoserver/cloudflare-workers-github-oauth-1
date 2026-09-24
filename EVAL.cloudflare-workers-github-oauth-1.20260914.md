# EVAL: cloudflare-workers-github-oauth-1 CI監視警告（2026-09-14）

**対象**: CI監視が上げた `/cursor-agent` 回答キャッシュと履歴検索の中優先度2件 —
(1) PR #1794 マージ後の `cursor_agent_answer_cache` が実行途中の回答を永久保存しうること、
(2) PR #1795 が入力ごとに D1 の `answer_text` を全件走査しうること。
本評価は警告の是非、現行コードとの差分、大まかな方針とのズレ、アドホック回避、恒久修正の方向を整理する。実装そのものはこの文書では行わない。

関連:

- [`SPEC.cloudflare-workers-github-oauth-1.20260913.md`](SPEC.cloudflare-workers-github-oauth-1.20260913.md) セクション3・4
- [`NOTICE.cloudflare-workers-github-oauth-1.20260914.md`](NOTICE.cloudflare-workers-github-oauth-1.20260914.md)
- [`af7b23a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/af7b23a) 回答文Markdown表示とD1キャッシュ優先（#1794）
- [`245906c`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/245906c) 履歴検索を回答キャッシュ本文へ切替（#1795 初期）
- [`bc95820`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bc95820) インクリメンタルサーチ撤去と明示検索（#1795 後続）

---

## 総評

| 警告 | 警告の妥当性 | 現行コード | 方針との関係 | いま取るべき線 |
|---|---|---|---|---|
| 実行途中回答の永久キャッシュ | 妥当。現行の会話APIは完了判定なしで INSERT する | #1794 マージ済みのまま未修正 | 「キャッシュ優先で Cursor API を節約する」方針が、未完了データを正本にする副作用を見落としている | **恒久修正が必要**。完了前は保存しない |
| 入力ごとの D1 全件走査 | 警告時点の #1795 初期実装には妥当 | **後続コミットで前提が消えている** | 監視は debounce+Abort を求めるが、利用者方針は「インクリメンタルを撤去してキャッシュへ明示問い合わせ」 | **debounce を足して input 検索を復活させない**。残るのは走査コストの将来対策 |

2件を同じ「中」で並列に直すと、検索側は警告文面どおり debounce を足してインクリメンタルを戻す選択になりやすい。それは利用者が「インクリメンタルが邪魔なら撤去してでもキャッシュに問い合わせてほしい」とした方針と逆走する。キャッシュ永続化だけを欠陥、検索は警告の前提更新として扱う。

---

## 1. 実行途中の回答を D1 へ永久キャッシュする

**対象**: マージ済み PR #1794、`GET /api/cursor-agent/history/:id/conversation`（`src/index.ts`）、migration `0139` の `cursor_agent_answer_cache`。

### 警告内容

- Agent の完了状態を見ず、最初に取れた非空の assistant 文を保存する
- `launch_id` が UNIQUE で、以後は常にキャッシュを返す
- 実行途中でモーダルを開くと、部分回答のまま更新不能になる
- 次アクション: FINISHED / COMPLETED のときだけキャッシュし、未完了時は保存せず再取得可能にする

### 現行実装（事実）

会話APIは次の順で動く。

1. `cursor_agent_answer_cache` から `answer_text` を読む
2. 非空なら `source: 'cache'` で返し、Cursor API を呼ばない
3. ミスのときだけ会話APIを呼び、断片を1本に結合する
4. 結合結果が非空なら `INSERT` する（完了フラグ列は無い）
5. 空回答は INSERT しない（次回復帰で API 再試行できる）。ここだけは警告対象外

完了判定は入っていない。`cursor_agent_status_log` の最新 `agent_status` / `run_status` も見ていない。ページ側の `isTerminalStatus`（FINISHED / COMPLETED / ERROR / FAILED / CANCELLED）はモーダルの状態再取得にだけ使われ、キャッシュ INSERT には使われない。

UNIQUE 制約のため、部分回答が入ったあとは UPDATE 経路が無い。削除APIは履歴削除時にキャッシュ行も消すが、履歴を残したままキャッシュだけ差し替える操作は無い。

#1795 の検索は `answer_text` を正本にする。途中回答がキャッシュされると、検索ヒットも途中文のまま固定される。

### 大まかな方針とのズレ

| 方針 | 内容 | この実装との関係 |
|---|---|---|
| 利用者要求（#1794） | 非空の `answer_text` があれば Cursor API を呼ばず、回答文だけを1本キャッシュする | 遵守。API節約が目的 |
| CLAUDE.md ルール8 | catch で握りつぶすなら記録・通知・テスト | キャッシュ読み書き失敗は `cacheError` とログを残す。ここは準拠 |
| CLAUDE.md ルール12 | 推測せずデータで裏を取る | キャッシュを「最終回答」とみなす一方、完了イベントのデータは見ていない。**ここがズレ** |
| ページの状態方針 | 未終了は開くたびに refresh、終了後は読むだけ | 状態ログは追記型。回答キャッシュだけ「最初の非空で閉じて永久」になっており、**同じページ内で方針が割れている** |

「キャッシュ優先」自体は捨てない。捨てるのは「未完了の非空文も最終回答として閉じる」解釈である。空は再取得可、非空は永久、という分岐が警告の穴になっている。

監視の次アクションは FINISHED / COMPLETED のみ。ページの終端集合は ERROR / FAILED / CANCELLED も含む。失敗をキャッシュすると失敗文が永久化し、キャッシュしないと開くたびに会話APIを呼ぶ。推奨は **成功終端だけ保存**（FINISHED / COMPLETED）。失敗は保存せず再取得可能にする。失敗文を残したい場合は別列（`is_final` 等）で明示し、検索対象から外す。

### アドホック対応（今すぐ・コード変更なし）

本番で途中回答が固定されている行は、履歴ごと消さずキャッシュ行だけ消せる。0139 適用済みなら、対象 `launch_id` を指定してよい。

```sql
DELETE FROM cursor_agent_answer_cache WHERE launch_id = ?;
```

未完了のまま残っているキャッシュをまとめて落とす場合（最新 status が FINISHED / COMPLETED 以外、または status 無し）:

```sql
DELETE FROM cursor_agent_answer_cache
WHERE launch_id IN (
  SELECT l.id
  FROM cursor_agent_launch_log l
  LEFT JOIN cursor_agent_status_log s ON s.id = (
    SELECT id FROM cursor_agent_status_log
    WHERE launch_id = l.id
    ORDER BY fetched_at DESC, id DESC
    LIMIT 1
  )
  WHERE s.agent_status IS NULL
     OR upper(s.agent_status) NOT IN ('FINISHED', 'COMPLETED')
);
```

削除後に Agent ID を開き直せば会話APIが再実行される。UNIQUE なので、完了後の INSERT が新しい本文で入る。この SQL はチャットに貼って実行する前提であり、リポジトリへダウンロード用ファイルとしては置かない。

回避だけなら、実行中はモーダルを開かない運用でも部分キャッシュは防げる。ただし自動では防げない。

### 恒久の修正方針

1. **保存条件を関数に切り出す**（ルール15）。例: `shouldCacheCursorAgentAnswer({ agentStatus, runStatus, answerText })`。成功終端かつ非空のときだけ `ok: true`。文字列 prefix 判定は使わない（ルール32）
2. **INSERT の直前**に最新の `cursor_agent_status_log` を読む。無ければ conversation 応答の status を見る。未完了・不明は INSERT しない。応答の `source` は `api` のまま返し、次回も API に行けるようにする
3. **キャッシュヒット側**も、行があるだけで最終扱いしない。`is_final` を足すか、ヒット時に最新 status を見て未完了ならキャッシュを無視して API に行く。既存の途中行を残したままヒットを許すと、アドホック DELETE を忘れる限り再発する
4. **スキーマ**は必須ではない。まずは INSERT 条件とヒット条件のコード修正で足りる。残したいなら `is_final INTEGER NOT NULL DEFAULT 0` を足し、UNIQUE は維持したまま完了時だけ INSERT、または完了時 UPDATE。マイグレーションを足す場合は STATUS 系5箇所への登録と、コメント無しの実行SQLを提示する（ルール14・23）
5. **テストを先に書く**。RUNNING で非空 assistant が来ても行が増えないこと、FINISHED で増えること、途中行が残っていても未完了なら API に行くこと、他人の launch は 404 のまま
6. **検索との接続**。#1795 はキャッシュ本文だけを見る。途中行を残すと検索が途中文を正本にする。恒久修正後、必要なら上記一括 DELETE を一度だけ本番に流す

### やらないこと

- UNIQUE を外して途中文を積み上げる（検索とモーダルがどれを正本にするか不明になる）
- キャッシュ優先そのものを廃止して毎回 Cursor API を呼ぶ（#1794 の目的と衝突する）
- 途中行を黙って上書きし、失敗をログにも残さない

---

## 2. 履歴検索が入力ごとに D1 全件走査する

**対象**: 未マージ PR #1795、`GET /api/cursor-agent/history?q=`、`src/views/cursorAgent.ts`、`cursor_agent_answer_cache.answer_text`。

### 警告内容（警告が出た時点）

- 検索欄の `input` ごとに API を呼ぶ
- `lower(answer_text)` の部分一致で走査する
- デバウンスも先行リクエスト中止も無い
- 連続入力で D1 負荷が増え、応答順が逆転すると古い語の結果が新しい結果を上書きする
- 次アクション: マージ前に 300ms 程度のデバウンスと `AbortController` で旧リクエストを中止する

### 現行実装（警告後に変わっている）

[`bc95820`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bc95820) 以降、`input` では検索しない。検索ボタンと Enter だけが `?q=` を付ける。解除と再読み込みは検索語なしの一覧に戻す。

古い応答の上書き対策は `AbortController` ではなく世代番号 `historyFetchSeq` である。新しい検索または一覧取得が始まったあとで返った応答は DOM に載せない。E2E で「初期読み込みの遅延応答が検索結果を上書きしない」を確認している。

サーバ側は `q` があるときだけ `INNER JOIN cursor_agent_answer_cache` し、`instr(lower(a.answer_text), lower(?))` で絞る。LIKE の `%` / `_` は使わない。対象は自分の `user_id` に紐づくキャッシュ行だけである。テーブル全体の無条件 SELECT ではないが、ユーザーのキャッシュ行に対する関数走査であり、全文索引は無い。

### 警告との差分

| 監視が想定した実装 | 現行（#1795 先端） | 判定 |
|---|---|---|
| `input` ごとに API | しない | 警告の負荷シナリオは解消 |
| 300ms デバウンス | 未実装（不要になった） | 次アクションは採用しない |
| `AbortController` | 未実装。世代番号で描画だけ破棄 | 描画の逆転は抑止。D1 側の実行はキャンセルしない |
| `lower(answer_text)` 部分一致 | 残っている | 明示検索1回あたりの走査コストは残る |

監視の「マージ前に debounce + Abort を足せ」は、**インクリメンタルを残す前提の処方**である。現行は処方の前提を消している。ここへ debounce を足して `input` 検索を戻すと、利用者が「インクリメンタルが邪魔なら撤去してでもキャッシュに問い合わせてほしい」とした方針とズレる。前回の実害は D1 負荷というより、ページ初期読み込みの一覧応答が検索結果を上書きして「検索が全く効かない」ように見えたことだった。

### 大まかな方針とのズレ

| 方針 | 内容 | この実装との関係 |
|---|---|---|
| 利用者要求 | 画面上の列ではなく回答テーブルを検索する。インクリメンタルが邪魔なら撤去してよい | 遵守 |
| 監視の次アクション | インクリメンタルを残し、debounce と Abort で緩和する | **採用しない**。緩和より発生源撤去を選んでいる |
| CLAUDE.md ルール8 | 失敗を空成功にしない | `searchError` と「キャッシュ0件」表示で区別。準拠 |
| 負荷 | 無制限の D1 走査を避ける | 明示操作まで負荷は落ちた。行数が増えたあとの FTS は未着手 |

`AbortController` は HTTP の受信を止められるが、Worker が受けた D1 クエリはクライアント中止では止まらない。インクリメンタルを戻さない限り、ここを足す優先度は低い。連打対策が必要ならボタン disable か、同一語の再送無視で足りる。

### アドホック対応

- #1795 をマージする前に、debounce + `input` 復活をレビュー条件にしない
- 本番未デプロイなら、旧クライアント列フィルタのままなのでこの警告の負荷は起きない。代わりに回答本文では探せない
- キャッシュ表が大きくなったとき、応急は検索語の最大長（現行200文字）を維持し、連続クリックを避ける運用でよい

### 恒久の修正方針

1. **インクリメンタルは戻さない**。検索ボタン / Enter を正とする
2. **世代番号は維持する**。一覧取得と検索の競合はこれが本命。Abort を足すなら世代番号の代替ではなく、連打時の incoming を捨てる補助に留める
3. **走査コストは行数を見てから**。現状はユーザー単位のキャッシュ JOIN + INSTR で、件数表示（`cacheTotal`）がある。数百件規模なら追加索引は急がない。増えたら FTS5 か外部検索を別途設計する。そのときも「入力ごと」ではなく明示検索1回に載せる
4. **#1794 の途中キャッシュ修正を先に入れる**。検索がキャッシュを正本にする以上、途中文が残っていると検索品質が先に壊れる
5. **テスト契約を維持する**。`input` だけでは `?q=` を送らない、検索ボタンで送る、遅延一覧が上書きしない、プロンプト一致だけではヒットしない

### やらないこと

- 監視文面に合わせて `input` + 300ms デバウンスを処方どおり戻す
- 検索対象を再びプロンプト / レポート列に戻す
- 走査が怖いから検索API自体を落とす

---

## 推奨する着手順

1. **#1794 系のキャッシュ条件を直す**（未完了は INSERT しない、未完了キャッシュはヒットさせない）。必要なら本番で途中行を DELETE する
2. **#1795 は現行の明示検索のままレビューする**。監視の debounce / Abort をマージ条件にしない。警告票には「前提消滅（input 撤去済み）」と返す
3. キャッシュ修正のあと、検索 E2E が `source: 'answer_cache'` と `cacheTotal` を見たまま通ることを確認する

この順なら、検索が見る正本が途中文で固まらず、監視が心配した入力連打も再導入しない。
