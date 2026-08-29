# ghコマンド Rust/WASM移植プロトタイプ

## 1. 移植可能範囲と実装境界

**対象**: `wasm/gh-wasm/` — Go製GitHub CLIをCloudflare Workers向けの
Rust/WASMへ段階的に移植できることを、`gh repo view`相当の入力検証と出力整形で
確認する。

### 背景

GitHub CLI全体はローカルGit、端末、OSキーチェーン、エディタ、対話入力に依存する。
これらのAPIを持たないWorkersへ完全移植するのではなく、GitHub REST/GraphQL APIで
完結するサブコマンドだけを選び、純粋ロジックをRust/WASMへ移す。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `wasm/gh-wasm/src/lib.rs` | `owner/repo`検証とリポジトリ概要のMarkdown整形 |
| `wasm/gh-wasm/Cargo.toml` | `wasm-bindgen`による`cdylib`クレート定義 |
| `wasm/README.md` | Workerとの責務分担、ビルド手順、段階移植方針 |

## 2. 故障想定とテスト設計

**対象**: `gh-wasm`の入力・出力境界 — 不正入力やAPI応答の不整合を黙って
受け入れず、Workerが利用者へ具体的なエラーを返せるようにする。

| 故障シナリオ | 検出・対処 | テスト |
|---|---|---|
| `owner/repo`でない入力 | Rust側で拒否し、理由をエラーとして返す | 区切り不足、過剰な区切り、相対パス風入力 |
| API必須値の欠損 | Markdownを捏造せず明示的なエラーを返す | URL・既定ブランチ・公開範囲の欠損 |
| 説明文に表区切りや改行が含まれる | Markdownセル用にエスケープする | `Rust | WASM`の整形 |
| GitHub APIの401/403/404 | 将来のWorker配線でHTTPステータスとmessageを利用者へ返す | 配線実装時にfetchモックで追加 |
| WASM成果物を生成できない | ソースとネイティブテストを先に保ち、未生成のままアプリへ配線しない | リポジトリ全体のtypecheckで未配線を確認 |

### 対処方針

現環境では`wasm32-unknown-unknown`標準ライブラリの取得がネットワークプロキシで
拒否されたため、壊れた生成物や代替バイナリはコミットしない。WASMターゲットを
利用できる環境で生成物を作成してから、OAuth付き`fetch`、dynamic import、
WASMモジュールレジストリを別変更として配線する。

## 3. 関連コミット

**対象**: 本仕様に対応する履歴 — コミット作成後にGitHub上のコミットリンクを
追記する。

本変更のコミットで初回実装する。
