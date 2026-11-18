# NOTICE: CLAUDE_NATIVE_SHA256 を 2.1.327 の実バイナリに合わせて修正

日付: 2026-11-18

## 問題

- `containers/demo/Dockerfile` の CLAUDE_NATIVE_SHA256（604d29a6…）が、CLAUDE_VERSION=2.1.327 の実バイナリと一致しない。PR #2639 で CLAUDE_VERSION を 2.1.326→2.1.327 に上げたとき、対の SHA が付いてこなかった。
- Dockerfile は入れたバイナリを `sha256sum -c` で照合するため、この不一致でイメージのビルドは必ず失敗する。select-demo-container-image.mjs のフォールバックにより、失敗しても旧イメージ（2026-11-11 ビルド）のままデプロイが成功して見える。

## 実測（実物での照合）

- Dockerfile と同じ入れ方（`npm install -g @anthropic-ai/claude-code@2.1.327`）を隔離環境で再現し、照合先のパス（node_modules/@anthropic-ai/claude-code-linux-x64/claude）の実値を測定: 343c744baa14bfd38286a7cb90871051f04379956da6c5b803a9e66019a76ac9。
- 旧値 604d29a6… は 2.1.326 の tarball の実値（b6b3647d…）とも一致しない。

## 変更

- Dockerfile の CLAUDE_NATIVE_SHA256 を 343c744b… に更新。
- 契約テスト（src/cf-containers-tool-updates.test.ts）の期待値も同じ値に更新（実物で照合してから直す、の順序で実施）。

## 検証

- 対象テスト 9/9 通過（テストを先に書き換えて失敗を確認してから Dockerfile を修正）。
- ガードスイート（src/cf-containers）: 355 通過 / 2 失敗（前提チェック = 新しいイメージが記録されるまで設計どおり赤、t3 ブラウザ = 環境依存）。新規の失敗なし。
- 未検証: Builds 環境でのフルビルド。通過すればタグ ctx-aa2fd971a811 のイメージが作られ、前提チェックも次回ロック記録で緑になる。
