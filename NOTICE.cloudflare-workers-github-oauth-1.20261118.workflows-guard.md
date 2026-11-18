# NOTICE: GitHub Actions ワークフローのガードテスト

日付: 2026-11-18
対象: `src/workflows-guard.test.ts`（新規）

## 背景

- 利用者指示により GitHub Actions は使わない。container-image.yml が main への push のたびに demo コンテナのフルビルドを空転させ、成果物（lock 更新 PR）が 2026-11-15 以降一度も出なかったため、2026-11-18 に利用者が削除した（main a426183）。
- 再発を防ぐため、許可リスト以外のワークフローファイルが置かれたらテストで失敗させる（利用者承認 2026-11-18）。

## 内容

- `.github/workflows/` の *.yml / *.yaml を列挙し、許可リスト（現在は手動実行のみの demo-packages.yml のみ）以外があれば失敗する。
- demo-packages.yml も将来消えたら、許可リストを空にする旨をテスト内のコメントに明記した。

## 検証

- 現行 main（demo-packages.yml のみ）で通過。
- 試験ファイル sneaky.yml を置くと「未許可のワークフロー: sneaky.yml」で失敗することを確認し、除去後に再び通過。
