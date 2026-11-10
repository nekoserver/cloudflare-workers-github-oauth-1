# Claude CLI / T3 の固定版更新

2026-11-10 UTC、利用者の指示により Dockerfile の更新データを追加した。既存の未コミット変更と合わせて PR へ保存する。Docker ビルド、稼働 CLI の上書き、コンテナ再起動、Worker 配備はこの作業では行っていない。

| 対象 | 変更前 | 更新後 | 根拠 |
| --- | --- | --- | --- |
| Claude Code | 2.1.318 | 2.1.321 | [公式 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.321) と npm の latest が一致 |
| T3 Code | 0.1.7 | 0.1.8 | [公式 release](https://github.com/pingdotgg/t3code/releases/tag/v0.1.8) と npm の latest が一致 |

## 配布物・契約の確認

- 公式のコンパイル済み Linux x64 アーカイブを取得し、GitHub release asset が公開する SHA-256 digest と照合。取得 URL の HEAD は200。
- Claude の npm ネイティブパッケージも公開 SHA-512 integrity と照合し、そのバイナリが公式 release のバイナリと同一 SHA-256 であることを確認した。Dockerfile の `CLAUDE_NATIVE_SHA256` を更新。
- T3 の npm ランチャーは release の `SHA256SUMS` を取得してアーカイブを照合する実装を確認。さらに取得済み公式アーカイブ由来のバイナリ SHA-256 を `T3_NATIVE_SHA256` として固定し、ビルド時の検査を追加した。
- 両 CLI を隔離した環境で `--version` のみ実行し、`2.1.321 (Claude Code)` / `t3 v0.1.8` を確認。T3 は同梱 `lib/libatomic.so.1` とバイナリの最小レイアウトで検査した。最初の memfd 単体実行と容量を制限した全展開は成功しなかったため、それを CLI 非対応の根拠とはしていない。
- T3 `v0.1.8` の認証・Cookie 名・ペアリング・期限・URL bootstrap・待機のソースを9項目再照合した。重複 Cookie のパース順序と、新版の実サーバー・ブラウザによる認証フローは別途未検証。旧版の実機結果を新版の実機成功とはしない。
- `server.js` と `t3-pwa-auth.cjs` に残っていた旧バイナリの絶対パスを更新し、Dockerfile の固定版との一致テストを追加した。

配布物・ネイティブ版表示・ソース照合の根拠は `artifacts/container-cli-update-20261110/` に保存。取得した大きいバイナリはリポジトリへ追加していない。

## 検証

- Muse / tailnet / route 関連8ファイル230テスト成功。
- 協議作業記録・改善イベントのローカル SQLite テスト15件成功。
- 必須の `scripts/claude-push-guard.js` を、実際の差分一覧と `npx vitest run src/cf-containers --maxWorkers=1` の全対象で実行し、310テスト成功。全体テストは禁止条件に従い実行していない。
- ブラウザ検査では、既存のテストが期待する `/opt/pw-browsers/chromium` からインストール済み `/usr/bin/google-chrome` を参照させた。これは検証ホストの一時的な設定で、イメージへの追加変更ではない。
- 変更した Node スクリプトの構文検査、ソース・設定・文書の差分空白検査、認証情報の混入検査を実施。過去の raw 検証ログは証跡として保存し、末尾空白を整形して改変していない。

## 反映に必要な作業

再ビルド: **必要**。Dockerfile と `containers/demo` 内のランタイムファイルを変更したため。

再起動: **必要**。新しいイメージで動かす必要があるため。今回の確認を Docker イメージのビルド・実起動成功の代わりにはしない。
