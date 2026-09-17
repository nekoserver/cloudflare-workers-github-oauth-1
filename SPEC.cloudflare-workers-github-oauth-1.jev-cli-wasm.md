# Jev CLI WASM化の実現可能性

日付: 2026-09-17

## 結論

**可能。ただし、Jev CLIの実行ファイルを丸ごとWASMへ変換するのではなく、CLIの
純粋な処理だけをWASMへ移し、HTTP通信とシークレット管理はWorker/JavaScriptに残す。**

このリポジトリで必要なJev処理は、現時点では
`POST https://api.typesafe.ai/v1/systemone`へのリクエストで完結している。したがって、
既存CLIを移植しなくても同じ機能を提供できる。WASM化の主な候補は次の処理になる。

- `state`とラベルからJev APIの`questions`辞書を組み立てる
- CLI引数・入力JSONを検証する
- APIレスポンスから`score`、`confidence`、`probabilities`を検証・抽出する
- 人間向けの表やJSONへ整形する

一方、次の処理はWASMへ入れない。

- `JEV_API_KEY`の保持
- Jev APIへの`fetch`
- HTTPステータス、タイムアウト、リトライの制御
- D1への評価結果の保存

APIキーをブラウザへ渡してはいけないため、ブラウザWASMからJev APIを直接呼ぶ構成は
採用しない。ブラウザから実行する場合も、認証済みのWorkerエンドポイントを経由する。

## 推奨する責務境界

| 層 | 責務 |
|---|---|
| Rust/WASM | 入力検証、`questions`辞書の構築、レスポンス検証、出力整形 |
| Worker/TypeScript | APIキー、`fetch`、タイムアウト、HTTPエラー、D1、ユーザー認可 |
| ブラウザ | 入力UIと結果表示。Jev APIキーは受け取らない |

既存の`src/utils/jevEvaluation.ts`はすでにこの境界に近く、APIペイロードの構築と
レスポンス解析が通信処理から関数として分離されている。最初のプロトタイプでは、
それらの純粋関数だけをRustで再実装し、TypeScript版との同一性テストを行う。

## 「既存Jev CLIをそのままWASM化」できる条件

CLIのソースと依存関係がこのリポジトリには含まれていないため、既存バイナリを
そのままビルドできるかは未確認である。判断には最低限、実装言語、ライセンス、
ソース公開の有無、依存ライブラリ、ファイルシステム・プロセス・端末への依存を
確認する必要がある。

- Rust製で、純Rust依存が中心なら`wasm32-unknown-unknown`へ比較的移植しやすい
- Go製なら`GOOS=js GOARCH=wasm`で移植可能だが、Goランタイム分だけ成果物が大きくなる
- Node/Python製CLIの丸ごとの移植はランタイム同梱が必要で、薄いAPIクライアントには
  過剰になる可能性が高い
- 子プロセス、任意ファイルアクセス、生ソケット、OSキーチェーン、対話TTYへの依存は
  Workers/ブラウザ向けにアダプターまたは機能削減が必要

## 最小プロトタイプ案

`wasm/jev-wasm/`をRustの`cdylib`クレートとして作り、最初は次の2関数だけを公開する。

```text
build_request(state_json, labels_json) -> request_json
parse_response(response_json) -> normalized_result_json
```

ネットワークアクセスを持たないこの形なら、秘密情報がWASMメモリやブラウザへ流れず、
ネイティブの`cargo test`で境界条件を検証できる。Worker側ではWASMモジュールをdynamic
importし、生成されたリクエストだけを既存の`fetch`処理へ渡す。

ただし、現在のTypeScript実装は同じ仕事を十分小さいコードで行っているため、性能改善は
ほぼ期待できない。WASM化の価値は「CLIとWebで検証・整形ロジックを共有したい」場合、
またはJev公式CLIにローカル推論などAPI呼び出し以外の再利用可能なロジックがある場合に
限られる。単にJev評価をWorkerから呼ぶことが目的なら、現行TypeScript実装を維持する方が
小さく、運用も容易である。

## 採用判断

1. Jev CLIのソースURLとバージョンを固定する
2. ライセンスと依存関係を棚卸しする
3. CLI固有ロジックが`jevEvaluation.ts`を上回るか確認する
4. 上回る場合だけ、ネットワークなしの純粋関数1個をWASM化する
5. ネイティブテスト、TypeScript版とのゴールデンテスト、WASMサイズを比較して継続を決める

したがって現段階の回答は、**技術的には可能だが、CLI本体の情報なしに丸ごと移植を始めず、
まず純粋なペイロード変換部分だけでPoCを作るのが妥当**となる。
