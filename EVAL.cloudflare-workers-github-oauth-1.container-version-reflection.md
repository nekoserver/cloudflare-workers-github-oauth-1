---
id: EVAL.cloudflare-workers-github-oauth-1.container-version-reflection
target: SPEC.cloudflare-workers-github-oauth-1.container-version-reflection
rules: LINT.spec-rules 版2
date: 2026-11-18
result: pass（error 0件 / warning 0件）
---

# EVAL: SPEC.cloudflare-workers-github-oauth-1.container-version-reflection 版1

## ルールごとの判定

| ルール | 判定 | 備考 |
|---|---|---|
| SPC001 | pass | front matter あり（id、repo、status、version、created、updated）。id はファイル名と一致。 |
| SPC002 | pass | 要求は REQ-CR-001〜007 で一意。 |
| SPC003 | pass | 要求は「しなければならない／してはならない」で記述。 |
| SPC004 | pass | 受け入れ条件 AC-CR-001〜004 が全要求を覆う（001 が CR-001〜004 と 007、002 が CR-006、003 が CR-005、004 が CR-004）。 |
| SPC005 | pass | 曖昧語なし。範囲は対象・対象外の列挙で確定。 |
| SPC006 | pass | 外部参照は版固定（container-versions.md の記録時刻 2026-11-11T21:31:38.343Z、PR #2639 / #2642）。 |
| SPC007 | pass | status に出典（2026-11-18、Okiraku の指示）を併記。 |
| SPC008 | pass | 例外は専用節（E1〜E4）: 申告の不在、記録時刻の欠落、片側だけのパッケージ、到達不能。 |
| SPC009 | pass | 目的と範囲を明示し、対象と対象外を列挙。 |
| SPC010 | pass | 未決事項は専用節に分離し、各項目に判断者（Okiraku）と「判断期限は定めない」の明記あり。 |
| SPC011 | pass | 前提は専用節（P1〜P5）に検証状態付きで列挙。P2 と P4 は「文書のみ」と明示し、その前提に依拠する判定（REQ-CR-004）では、記録の古さを「ビルドが走らなかった証明ではない」と前提側で限定している。 |
| SPC012 | pass | 本 SPEC は移行手順を含まないこと、対処側の中止条件と復帰先（最後に実経路で確認できたイメージ = image.lock.json の digest）を明記。 |
| SPC013 | pass | 故障モード FM1〜FM3 に影響範囲を明記。 |
| SPC014 | pass | AC-CR-001 は実データでの実経路確認（2026-11-18 に実行済み、下記）。 |
| SPC015 | pass | 状態を持つ対象（稼働コンテナ）の復旧手順を、検知・切り分け・復旧・確認基準の4段で定義。 |

## AC-CR-001 の実行記録（2026-11-18）

入力: main の Dockerfile 固定版（PR #2639 / #2642 マージ後）、container-versions.md の記録（2026-11-11T21:31:38.343Z）、image.lock.json（builtFrom は 2026-11-11 のビルド）。

結果: **未反映**。REQ-CR-003（申告の記録時刻が固定版の変更 commit より古い）でも独立に未反映。

食い違い 9 件（固定版 / 申告）:
- node: 26.13.1 / 26.13.0
- apache: 2.4.71 / 2.4.70
- git: 2.56.1 / 2.56.0
- claude: 2.1.327 / 2.1.322
- codex: 0.169.1 / 0.167.1
- cloudflared: 2026.11.1 / 2026.10.7
- gh: 2.104.0 / 2.103.3
- tailscale: 1.104.7 / 1.104.5
- t3: 0.1.10 / 0.1.7

一致 4 件: jj、openssh、preprint、ruby。

## 不足

- AC-CR-002（再作成後の反映済み判定）は、コンテナの再作成が済んでいないため未実施。実施可能になった時点で同じ手順で確認する。
