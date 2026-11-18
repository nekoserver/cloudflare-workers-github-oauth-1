# muse-statusの接続先修正（2026-11-07 UTC）

## 変更

`muse` は組み込み側の外向き専用ノードで、8080番への着信を受けない。従来の `/muse-status` は `muse` と `muse-vm` の両方へ `/health` と Nix 一覧を要求し、オンラインの `muse` に接続拒否を表示していた。

Tailscale の接続状態は引き続き両ノードを表示し、HTTP のシグナルと Nix 一覧はブリッジ `muse-vm` に限定した。`muse` のカードには外向き専用・検査対象外と表示し、シグナル、再取得、絞り込みを無効化する。初回・定期・手動のどの操作でも `muse:8080` へ接続しない。

Worker の共通処理も、`node=muse` の旧 API 呼び出しを `not_applicable` として返し、コンテナの状態取得や fetch をしない。`muse-vm` の成功を `muse` の健康状態として表示する転用はしない。コンテナの中継は `muse-vm` の2パスだけを許可し、旧 `muse` パスや不正なパスは404で接続前に拒否する。`tailscale nc` の送り先も `muse-vm:8080` に固定した。

Cookie の ON/OFF と間隔、キーの確認、停止中コンテナを起動しない制約、推論を実行しない health 検査は維持する。

## 検証

ログは [artifacts/muse-status-20261107](artifacts/muse-status-20261107/) に保存。

- 変更前に新しい仕様のテストを実行し、8件の失敗を確認（before.log）。実装後に関連3ファイル78件成功（after.log）。
- 最終検査は `museNodeStatus.test.ts`、`museStatus.test.ts`、`cf-containers-muse-proxy.test.ts`、`museDirectAsk.test.ts`、`museTailscalePreflight.test.ts` の **5ファイル124件成功**（final.log）。
- 初回/定期/手動操作で外向き専用ノードへ要求しないこと、旧 API からも接続しないこと、VM の応答検査、停止時・キーなし・失敗時の扱いを検証。
- 生成 HTML の全 script を `node --check` で検査するテストが成功。server.js の構文と `git diff --check` も成功。
- 修正した中継関数を隔離した localhost HTTP サーバーで動かし、実際の `tailscale nc muse-vm 8080` を通して `/health` の **HTTP200 / status=ok** を確認（live-relay-health.json）。推論要求はしていない。
- 初回の Python subprocess.run による nc 検査は stdin を閉じたため応答を取得できず（live-muse-vm-health.json）。exit=0 を健康確認成功と扱わず、上記の実中継で確認し直した。
- 検証用依存は `/tmp/muse-status-tests` に配置し、package.json/lockfile は変更していない。

## 反映範囲

変更は作業ツリーのみ。本番 Worker の `/muse-status`、ログイン済み本番画面、既存の常駐 server.js にはまだ反映していない。live-relay-health.json は現コンテナから VM への実到達を確認したもので、本番ページ反映の証拠ではない。

Docker ビルド・イメージ更新・Worker デプロイ・全体テスト・Git push は実施していない。AGENTS.md/AGENT.md の制約に従い、コンテナビルドを伴うデプロイ操作は行わない。Worker の検査対象制限は既存の中継 `/admin/muse/muse-vm/health` に対応するため、既存コンテナにも適用できる。コンテナ側の旧パス拒否と接続先固定はイメージへの反映が別途必要。
