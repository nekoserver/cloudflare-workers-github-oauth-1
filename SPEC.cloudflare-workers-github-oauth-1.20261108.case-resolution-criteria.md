# SPEC: 議題の「解決」の条件と、論点の「止まる」の根拠（案・承認待ち）

作成日: 2026-11-08
状態: 案。利用者の承認待ち（7章）。D1・画面の変更は承認の後。

関連: D1`agent-inquiries`の議題`case-resolution-criteria-20261108`（問い合わせ`crc-e0`・`crc-e1`、論点`crc-k1`〜`crc-k4`、提案`crc-p1`・`crc-p2`）、[記録のSPEC](SPEC.cloudflare-workers-github-oauth-1.20261107.muse-inquiry-recording.md)、[発議のルールと8段の過程](SPEC.cloudflare-workers-github-oauth-1.20261108.proposal-rule.md)、[NOTICE](NOTICE.cloudflare-workers-github-oauth-1.agent-inquiries.20261107.md)。

## 1. 背景

**対象**: `inquiry_cases.status`、`inquiry_keys.blocking`、`/muse-inquiries`の「完了」 — 利用者の指摘（2026-11-08）「完了の妥当性がよくわからない」「止まる止まらないを決めてる根拠もよくわからない」。

調べて分かったこと:

| 項目 | 今の作り | 問題 |
|---|---|---|
| 議題の`resolved` | NOTICEの定義は「協議が終わったか」。人が手で付ける | 目的を満たしたかを表す欄が無い。条件の確認も無い |
| ボードの「完了」 | 問い合わせの`answered`・`failed`・`withdrawn`、閉じた論点、提案の`done`・`rejected`をまとめて数える（`src/views/museInquiries.ts:40-45`） | 失敗・取り下げ・不採用も「完了」に見える |
| 論点の`blocking` | 定義は「止まるか」の一語だけ（記録のSPEC 44行、`0001`） | 何が止まるのか、誰がなぜ付けたかの基準も記録も無い |
| マイグレーション | 0010〜0012はPRがマージ済み | 本番D1に`inquiry_case_steps`などが無い（2026-11-08確認）。「マージ＝反映」ではない（`tcl-k4`と同じ） |

解決済み5件を目的と照らした結果:

| 議題 | 判定 | 根拠・残り |
|---|---|---|
| `nix-packages-20261107` | 達成 | 利用者が画面で確認（`e20`）。論点9件・提案3件が開いたまま |
| `muse-vm-dashboard-20261107` | 達成 | SPECがある。残り無し |
| `job-queue-design-20261107-4ec8c0c5` | 達成 | 目的は要約の記録。提案5件は相談の要約で、採否の対象ではないのに採否待ち |
| `proposal-rule-20261108` | 一部 | 目的の「手順」のうち検索の記録用の表（`pr-p1`）が未定（SPEC 5章） |
| `muse-vm-reboots-20261108` | 一部 | 原因は「VMの外」まで。採用した`mvr-p1`は実施の記録が無く、`mvr-p2`は採否待ち |

## 2. 案A: 議題の解決の条件（提案`crc-p1`）

**協議の終了（`status`）と、目的の達成（`outcome`）を分けて持つ。**

| 欄 | 値 | 意味 |
|---|---|---|
| `status` | `open`・`resolved`・`abandoned` | 今のまま。協議が続いているか |
| `outcome`（追加） | `achieved`・`partial`・`not_achieved` | 目的をどこまで満たしたか。`resolved`のとき必須 |
| `resolution_entry_id`（追加） | 問い合わせのID | 達成を示す根拠（実測・利用者の確認など）。同じ議題の行 |
| `resolution_note`（追加） | 文 | `partial`・`not_achieved`のとき、残りをどの議題へ移したか |

`resolved`にできる条件（すべて満たすとき）:

1. `outcome`と`resolution_entry_id`がある。
2. 採否待ち（`proposed`）の提案が0件。採否を決めるか、別の議題へ移す。
3. 開いた論点が0件。答えが出たら閉じる。意味が無くなった落とし穴は、知識（`inquiry_knowledge`）にするか、理由の問い合わせを付けて閉じる。続きは別の議題へ移す。

- **D1のトリガーで拒否する**: `status`を`resolved`へ変える更新（と、最初から`resolved`で入れる追加）が条件を満たさなければ`case_not_resolvable`で止める。既存の解決済みは変えない（変える更新のときだけ働く）。
- **違反の一覧**: ビュー`inquiry_case_resolution_check`で、条件を満たさない解決済みの議題と理由を出す。既存の5件はここで見つけて直す。
- `abandoned`（中止）は、理由の問い合わせだけを必須にする。残った提案は`rejected`にする。

## 3. 案B: 論点の「止まる」の根拠（提案`crc-p2`）

**「止まる」＝その論点が閉じないと、議題の次の段（8段の過程）へ進めないこと、と定める。** 一語の0/1ではなく、どの段を止めるかと根拠を残す。

| 欄 | 値 | 意味 |
|---|---|---|
| `blocks_step`（追加） | 8段の名前（`alignment`〜`trial`） | この論点が閉じるまで進めない段。止めないなら空 |
| `blocking_entry_id`（追加） | 問い合わせのID | 止まると判断した根拠と判断者 |
| `blocking`（既存） | 0・1 | `blocks_step`があれば1。互換のため残す |

判断の基準（どれかに当たれば止まる）:

| 基準 | 例 |
|---|---|
| 目的の合格条件そのもの | `msw-k11`（WASMから8080へ届くか）は試験運用（`trial`）を止める |
| 利用者が決める事項で、決まらないとSPECが書けない | `tcl-k1`（主の単位）は`spec_approval`を止めた |
| 変更を伴い、承認が要る | 承認されるまで`implementation`を止める |
| 安全・セキュリティの欠陥で、そのまま入れると害がある | 入れる段（`implementation`・`trial`）を止める |

当たらないもの（止めない）: 落とし穴の注意書き、実装時に気をつければ済むこと、目的の外の改善。

- 判断の根拠は、論点を足した人が`blocking_entry_id`の問い合わせに書く。利用者が変えたら、その発言を新しい根拠にする。
- 今の`blocking=1`の論点（`msw-k11`・`ce-k5`、ほか今日閉じた4件）は、承認後にこの基準で見直し、`blocks_step`を埋める。
- `crc-k3`は、作成者（Claude Code）が基準無しで`blocking=1`にしたため、基準に従い0に直した（既存5件の扱いは、この案の承認や実装を止めない）。

## 4. 画面

- ボードの「完了」を「達成」（`answered`・`done`・`adopted`の実施済み・答えの出た論点）と「終了」（`failed`・`withdrawn`・`rejected`・意味が無くなった論点）に分ける。
- 議題のタイルに`outcome`を出す（「解決・一部」など）。
- 「止まる」のバッジに、止める段（例: 「止まる: SPEC承認」）を出す。

## 5. 実装の順番（承認後）

1. **0010〜0012を本番D1に当てる（利用者の作業、ルール14）**。0013はこの後でないと当たらない。
2. 0013（欄の追加、トリガー、ビュー）を、`scripts/agent-inquiries-migrations.test.mjs`に先に失敗するテストを書いてから作る。
3. 既存5件をビューで確かめ、直す（採否は利用者）。
4. 画面（4章）。

0013の要点（承認後にマイグレーションと、コピーして実行できるSQLを示す）:

```sql
ALTER TABLE inquiry_cases ADD COLUMN outcome TEXT CHECK (outcome IN ('achieved', 'partial', 'not_achieved'));
ALTER TABLE inquiry_cases ADD COLUMN resolution_entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL;
ALTER TABLE inquiry_cases ADD COLUMN resolution_note TEXT;
CREATE TRIGGER IF NOT EXISTS inquiry_cases_resolve_guard BEFORE UPDATE OF status ON inquiry_cases WHEN NEW.status = 'resolved' AND OLD.status <> 'resolved' AND (NEW.outcome IS NULL OR NOT EXISTS (SELECT 1 FROM inquiry_entries e WHERE e.id = NEW.resolution_entry_id AND e.case_id = NEW.id) OR EXISTS (SELECT 1 FROM inquiry_proposals p WHERE p.case_id = NEW.id AND p.status = 'proposed') OR EXISTS (SELECT 1 FROM inquiry_keys k WHERE k.case_id = NEW.id AND k.status = 'open')) BEGIN SELECT RAISE(ABORT, 'case_not_resolvable'); END;
```

## 6. Codex・Museの点検を受けた改訂

**対象**: 2章の案Aと3章の案B — 同じ質問に対するCodex（問い合わせ`crc-e3`）とMuse（`crc-e5`、最終案`crc-e6`）の点検で、両者が一致した指摘を取り込む。2〜3章の元の案は経緯として残す。

| 点 | 元の案 | 改訂（両者の一致） |
|---|---|---|
| 解決にできる条件 | 開いた論点が0件 | **止まる論点が0件**。止まらない論点は、処置（継続・延期・対象外・残存リスクとして受容・別議題へ移す）と理由を付けて残してよい |
| 採否待ちの提案 | 0件 | 0件のまま。残すなら別議題へ移す |
| 一部だけの達成 | — | `partial`でも、残りと移した先を記録すれば解決にしてよい |
| 判定 | 根拠の問い合わせID | 根拠の問い合わせIDに加え、**判定者**を必須にする |
| 止まる基準 | 4つ | 5つに絞る: (1) その段に進むのに必須で未充足の条件、(2) 仮置きできない利用者の決定、(3) 承認待ち（期限と上申の手順を付ける）、(4) データ損失・セキュリティ・主要な操作の不能に当たる欠陥、(5) 外部依存・資源・実現性・検証手段の不足 |
| 止める段 | 1つ | 複数持てる。段ごとに**解除の条件**を持つ |
| 止まらない論点 | 理由なし | `blocking=0`にも理由を書く |
| 解決の後の変化 | — | 解決の後に論点を開き直す・提案を足すときは、議題を協議中に戻す（Codex: 終了後の変更で条件が崩れる） |

### 列の形（Museの直し`crc-e8`を受けて。5章のSQLを置き換える）

- 止まる根拠は区分の1列、止める段は別の表（区切り文字にすると集計と検索が崩れる。Museの指摘）。
- Museの直しは区分の値を`block_release`・`block_deploy`などにすり替えていたため、値は6章の5つの基準に合わせて直した。

```sql
ALTER TABLE inquiry_keys ADD COLUMN stop_basis TEXT CHECK (stop_basis IN ('stage_requirement', 'user_decision', 'approval_pending', 'critical_defect', 'feasibility_gap', 'none'));
ALTER TABLE inquiry_keys ADD COLUMN disposition TEXT CHECK (disposition IN ('continue', 'defer', 'out_of_scope', 'accept_risk', 'moved'));
ALTER TABLE inquiry_keys ADD COLUMN unblock_condition TEXT;
ALTER TABLE inquiry_keys ADD COLUMN basis_entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS inquiry_key_stop_stages (key_id TEXT NOT NULL REFERENCES inquiry_keys(id) ON DELETE CASCADE, step TEXT NOT NULL CHECK (step IN ('alignment', 'issues', 'similar', 'abstraction', 'spec_approval', 'implementation', 'trial')), PRIMARY KEY (key_id, step));
ALTER TABLE inquiry_cases ADD COLUMN outcome TEXT CHECK (outcome IN ('achieved', 'partial', 'not_achieved'));
ALTER TABLE inquiry_cases ADD COLUMN decided_by TEXT;
ALTER TABLE inquiry_cases ADD COLUMN resolution_entry_id TEXT REFERENCES inquiry_entries(id) ON DELETE SET NULL;
ALTER TABLE inquiry_cases ADD COLUMN resolution_note TEXT;
```

解決にできない条件（トリガーで`case_not_resolvable`を返す）:

1. `outcome`・`decided_by`・`resolution_entry_id`（同じ議題の問い合わせ）のどれかが無い。
2. 開いた論点のうち、`stop_basis`が`none`以外（止まる論点）のものがある。
3. 開いた論点のうち、`stop_basis`が`none`なのに`disposition`が無いものがある。
4. 採否待ちの提案がある。
5. `outcome`が`partial`・`not_achieved`なのに`resolution_note`（残りと移した先）が無い。

`stop_basis`が空（未判定）の開いた論点は、止まる論点として扱う（判定を済ませるまで解決にしない）。

## 7. 提案の標準項目（因果・目的・効果・測り方）

**対象**: `inquiry_proposals`と、Muse・Codexへの問い合わせ — 提案の目的や効果が後から分からず、聞き直しになった（2026-11-08、flockとハッシュ記録の提案）。利用者の指定「因果関係や目的や効果は標準仕様でないとおかしい」。

| 項目 | 内容 | 列の案 |
|---|---|---|
| 問題 | 何が起きているか | `problem` |
| 原因と因果 | なぜ起きるか、何が何を引き起こすか | `cause` |
| 根拠 | 実物の形跡（ファイルと行、ログ、時刻、件数）。無ければ「形跡無し」 | `evidence`・`evidence_entry_id` |
| 目的 | 何のためにするか | `purpose` |
| 期待する効果 | 何がどれだけ良くなるか | `expected_effect` |
| 測り方 | どの数字がどう変われば効いたと言えるか | `metric` |
| 費用と危険 | 手間、壊れ方、取り消せるか | `cost_risk` |

- **問い合わせ側（実施済み）**: `~/.claude/tools/inquiry.py`が、すべての問い合わせの末尾に、この項目で答えるよう求める文を付ける（`--raw`のときだけ付けない）。分からない項目は推測で埋めず「不明」と書かせる。
- **記録側（承認待ち）**: 上の列を`inquiry_proposals`に足し、7項目がそろわない提案は`adopted`にできないようトリガーで止める。「不明」は値として認めるが、`evidence`が「形跡無し」の提案は画面で目立たせる。
- **効果の確認**: `done`にするときは、`metric`で測った結果を問い合わせとして残す（効いたか、効かなかったか）。これは貢献の評価（`contribution-evaluation-20261108`）の台帳とつなげる。

## 8. 解決済みの議題に新しい知見が出たときの扱い

**対象**: `status`が`resolved`・`abandoned`の議題と、その論点・提案 — 解決済みでも、別の作業の途中で新しい知見が得られることがある（利用者の指定、2026-11-08「解決済みでも何か新しい知見が得られるかもしれないから、その時はその時で適切な対処をする」）。同じ日に、解決済みの`nix-packages-20261107`について利用者が「もう解決してるし触らなくていい」と述べた。

| 場面 | 扱い |
|---|---|
| ふだん | 解決済みの議題には、こちらから手を入れない（論点の開閉、提案の採否、段階・状態の変更をしない）。整理のためだけの書き換えもしない |
| 別の作業の途中で、その議題に関わる新しい知見が出た | 知見を捨てない。まず、それが議題の結論（達成・判断の前提）を変えるかを確かめる |
| 結論を変えない知見（補足、再発の形跡なし、数値の更新など） | 予備知識（`inquiry_knowledge`）か、今の作業の議題の問い合わせとして記録する。解決済みの議題そのものは変えない |
| 結論を変えうる知見（前提が誤っていた、同じ問題が再発した、危険が見つかった） | 利用者に、根拠と影響を添えて知らせる。議題を協議中に戻すか、新しい議題を起こすかは、利用者が決める。決まるまで、解決済みの議題は変えない |
| 利用者が触らないと決めた議題 | 上と同じ。知見が出ても記録と報告にとどめ、議題には手を入れない |

- 「触らない」は、記録を書き換えないことを含む。採否待ちのまま残った提案を、こちらの判断で閉じない（2026-11-08、閉じようとして止められた）。
- 新しい議題を起こすときは、発議のルール（重複の検索、`seq = 0`の記録）に従い、元の議題を関連として書く。

## 9. 決めること（利用者）

| 項目 | 案 |
|---|---|
| 案A（`outcome`・根拠・判定者・トリガー）を採るか | 採る（6章の改訂後） |
| 開いた論点を「0件」にするか、「止まる論点が0件」で足りるとするか | 止まる論点が0件（6章。Codex・Museとも同じ意見） |
| 案B（止める段・解除の条件と5つの基準）を採るか | 採る（6章の改訂後） |
| 既存5件の直し方（`outcome`、残りの提案10件・論点9件の採否） | 承認後に1件ずつ示す |
| 0010〜0012の本番適用 | 利用者が実行（5章の1） |
