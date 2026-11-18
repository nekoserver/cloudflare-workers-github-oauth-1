---
id: EVAL.cloudflare-workers-github-oauth-1.container-image-explicit-build
target: SPEC.cloudflare-workers-github-oauth-1.container-image-explicit-build
rules: LINT.spec-rules 版2
date: 2026-11-18
result: pass（error 0件 / warning 0件）
---

# EVAL: SPEC.cloudflare-workers-github-oauth-1.container-image-explicit-build 版2

## ルールごとの判定

| ルール | 判定 | 備考 |
|---|---|---|
| SPC001 | pass | front matter あり（id、repo、status、version、created、updated）。id はファイル名と一致。 |
| SPC002 | pass | 要求は REQ-EI-001〜005 で一意。 |
| SPC003 | pass | 要求は「しなければならない／してはならない」で記述。 |
| SPC004 | pass | AC-EI-001 が REQ-EI-003 と 005、AC-EI-002 が REQ-EI-001 と 002、AC-EI-003 が REQ-EI-002 を覆う。REQ-EI-004 は手順の固定であり、AC-EI-001（--check 通過が完了条件）の運用で担保する。 |
| SPC005 | pass | 曖昧語なし。範囲は対象・対象外の列挙で確定。 |
| SPC006 | pass | 外部参照は版・時刻固定（2026-11-18 14:28 のデプロイログ、digest c945ea026afa…）。 |
| SPC007 | pass | status に出典（2026-11-18、Okiraku の指示）を併記。 |
| SPC008 | pass | 例外は専用節（E1〜E3）: ビルド失敗、push 後デプロイ失敗、固定後の no changes の正常性。 |
| SPC009 | pass | 目的と範囲を明示し、対象と対象外を列挙。 |
| SPC010 | pass | 未決事項 U1 は版2 で決定済みとなり、決定事項の専用節に判断者・日付・内容を明記。未決事項は残っていない。 |
| SPC011 | pass | 前提は専用節（P1〜P4）に検証状態付きで列挙。P1・P2 は実証済み、P3・P4 は規則と明示。 |
| SPC012 | pass | 中止条件（ビルド / push 失敗）と復帰先（最後に実経路で確認できたイメージ = ロックの digest）を明記。 |
| SPC013 | pass | 故障モード FM1〜FM3 に影響範囲を明記。 |
| SPC014 | pass | AC-EI-002 と AC-EI-003 は実経路確認（再作成後のコンテナ報告版、mygw の応答）。 |
| SPC015 | pass | 状態を持つ対象（固定 digest とロックの整合）の復旧手順を、検知・切り分け・復旧・確認基準の4段で定義。 |
