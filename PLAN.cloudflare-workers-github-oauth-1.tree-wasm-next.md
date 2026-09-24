# tree-wasm 完成後の展開案

日付: 2026-09-21

## 完成条件

tree-wasmの「完成」は、Rustロジックが存在するだけでなく、次をすべて満たす状態とする。

1. `npm run wasm:build:tree`で固定バージョンのツールから成果物を再生成できる。
2. RustとTypeScriptのパリティテストが、通常表示・部分一致・glob・種別限定・隠しパス・
   名前/時刻ソート・逆順・不正入力を同じfixtureで検証する。
3. `public/wasm/tree_bg.wasm`をWorkerから`initSync`し、`/neko tree`の整形処理が実際に
   `tree_format_with_options`を呼ぶ。
4. モジュールレジストリのサイズとビルド日を生成物の実測値へ更新する。

## 次にできること（優先順）

### 1. TypeScriptパリティ実装をフォールバックへ降格する

WASM生成物をコミットした後、既存のTypeScript整形器は障害時の明示的なフォールバック、
またはパリティテスト用の参照実装に限定する。通常経路がどちらを実行したかをログ/メトリクスに
記録すれば、「WASMという名前だがTypeScriptが動いている」状態へ戻る退行を検知できる。

### 2. GitHub Trees APIの時刻不足を解消する

Trees APIは各エントリの更新時刻を返さないため、現状の`--sort time`は入力にtimestampを
付与できた場合だけ意味を持つ。Commits APIによる最終更新時刻の補完はAPI呼び出し数が増える。
まず対象件数の上限、キャッシュ、レート制限時の名前順フォールバックを設計し、時刻の出典も
レスポンスに表示してから導入する。

### 3. tree-viewとのデータ契約を共有する

dynamicnekoの`/tree-view`へ直接結合する前に、`path`・`type`・`timestamp?`のTSV（または
同等のJSON Schema）を共有契約にする。表示UIはJSON、チャットはMarkdownを必要とするため、
WASMへJSONツリー出力を追加すれば、静的スナップショットと`/neko tree`が同じ構築ロジックを
利用できる。認証・CSP・rawファイル取得は引き続き各サーバー側に残す。

### 4. 大規模リポジトリで計測する

10万エントリ級のfixtureでWASM初期化時間、整形時間、メモリ、TypeScript版との差を計測する。
WASMは常に高速とは限らないため、計測結果に応じてインスタンス再利用、入力形式のJSON化、
ストリーミング不可時の件数制限を判断する。

### 5. CIで生成物のドリフトを検出する

CIでビルド後の`git diff --exit-code -- public/wasm/tree*`を実行し、Rust変更時の生成忘れを防ぐ。
あわせて生成物サイズの急増に上限を設定し、`wasm-opt`導入は再現性と効果を計測してから決める。
