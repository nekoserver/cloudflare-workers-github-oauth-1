# NOTICE: Dockerfile の版チェックを、表示のみから一致の断定へ（2026-11-18）

## 問題

demo コンテナの Dockerfile は、ツールの導入後に版を表示するだけの箇所と、固定した版と一致しなければビルドを失敗させる箇所が混在していた。一致を断定していたのは git、openssh、apache（configtest 含む）、codex、cf のみで、node、npm、claude、vitest、tsc は表示のみだった。npm の導入が意図しない版に解決されてもビルドは通り、/etc/image-versions.json には固定した版が「想定」として書かれるため、実物と想定がずれたままのイメージが出来上がる余地があった。2026-11-18 に更新した claude と vitest が、ちょうどこの表示のみの側にあった。

## 変更

containers/demo/Dockerfile の次の5か所を、既存の断定（git の test、codex の grep -Fx）と同じ流儀の一致チェックに変えた。

- node: `node --version` の表示 → `v${NODE_VERSION}` と等しいこと
- npm: `/opt/node22/bin/npm --version` の表示 → `${NPM_VERSION}` と等しいこと
- claude: `claude --version` の表示 → 行全体が `${CLAUDE_VERSION} (Claude Code)` であること
- vitest: `vitest --version` の表示 → 出力から取り出した最初の版番号が `${VITEST_VERSION}` と等しいこと（出力書式が「5.1.0」単体でも「vitest/5.1.0 …」でも当たる形にした）
- tsc: `tsc --version` の表示 → 行全体が `Version ${TYPESCRIPT_VERSION}` であること

版そのものは変えていない。チェックの書式は、実際の出力（この環境で導入済みの実物と、想定される両書式）で当てはめて確認した。Docker のビルド自体はこの環境では実行できないため、ビルドでの確認は未実施であり、本番ビルドがその確認を兼ねる。

## 副次的な目的

この変更はドキュメント（*.md）だけではないため、Workers Builds の本番ビルドが走る。2026-11-18 の版更新（PR #2639）は main に入っているが、稼働コンテナは 2026-11-11 のイメージのままであり、ビルドとコンテナ再作成をもって最新版へ戻る流れの、ビルド側のきっかけとしてこの変更を入れる。

## テスト

- 対象テスト（codex-cf 契約、tool-updates、ruby、gh-effective-rate）: 20/20 通過
- push ガード一式（npx vitest run src/cf-containers）: 336/337。失敗1件は cf-containers-t3-pwa-diagnose-browser で、この VM に Chromium が無いための環境要因であり、変更前から同じ失敗である。
