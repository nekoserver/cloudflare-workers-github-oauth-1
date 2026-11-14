# Rust 1.100.0の影響調査（2026-11-13 UTC）

ユーザーの「Rust 1.1」は、2026-11-12公開のRust 1.100.0として調査した。公式版数は https://doc.rust-lang.org/releases.html#version-11000-2026-11-12 で確認。Rust 1.1.0の更新という意味ではない。

## 調査対象

本体のRust製WASMクレート9件（dig/factor/gh/jev/ls/msb/sha256/sqlx/tree）と、接続GitHubで検索して見つかったnekoserver/rust-worker-sqlx-d1。後者はmainの1d61b81aeb5f7831ce236396f02718c03ccff871をローカルcheckoutし、Cargo.lock、wrangler.toml、Rustソース、README/NOTICEを確認した。検索で見つからないリポジトリまで調査したとの保証ではない。

既存public/wasmのRust製8バイナリのproducersを読むとrustc 1.94.1。現checkoutの成果物を確認した値であり、本番配信ファイルを取得して比較したわけではない。コンパイラの更新だけで既存のWASMが書き換わることはない。Go製WASM、Ruby WASM、npm等で取得する外部配布WASMは、このリポジトリのRustコンパイラで再コンパイルされない。

## Rust/Cargo 1.100の確認点

公式リリースノート（上記URL）に従い、never型安定化とInfallibleの別名化・推論fallback変更、if-letを含むclosureのcapture、Boxの型推論、orphan checkでの新trait solver、Cargoの中間成果物配置、cargo installの既定lockfile使用を確認対象にした。editionは2021のまま維持し、不要なedition移行は行わない。

WASI P3のTier 2化は、今回使うwasm32-unknown-unknown + wasm-bindgenをWASI componentへ変更する理由にはならない。対象・API・配信形式を維持する。

Cargo 1.100では中間build-dirの構造が変わるが、本体の3ビルドスクリプトが読むtarget/wasm32-unknown-unknown/release/<crate>.wasmは最終cdylib。この変更で参照先をdeps等へ変更する必要はない。根拠: https://doc.rust-lang.org/cargo/reference/build-cache.html 。環境側でCARGO_TARGET_DIRを変更する場合のパス解決は、従来から別の前提であり今回の中間配置変更とは区別する。

## 発見した不整合と修正

- 本体msb-wasmのCargo.lockはwasm-bindgen 0.2.128なのに、build-msb-wasm.shのCLI指定は0.2.127。0.2.128へ合わせた。Rust 1.100で生成した実msb WASMに旧CLIを適用するとschema mismatchで失敗することも再現した。
- rust-worker-sqlx-d1のcrate 0.2.129とCLI 0.2.128は、版番号が違ってもSCHEMA_VERSION=0.2.128を共有している。実生成とworkerdでの/pingも成功したため、CLI 0.2.128は維持する。版差だけで故障と断定してCLIを更新しない。worker 0.5/sqlx-d1 0.1の系統も維持。根拠: https://github.com/wasm-bindgen/wasm-bindgen/blob/0.2.129/crates/shared/src/lib.rs 。
- 本体tree/sqlxの未指定だったcargo test/buildに--lockedを追加し、検査・再生成時に依存の解決結果を勝手に変えない。Cargo.lock自体は更新していない。
- 両リポジトリへrust-toolchain.tomlを追加し、1.100.0/minimal/wasm32-unknown-unknownを固定。別Workerのwranglerの--default-toolchain stableも1.100.0に固定した。以後のstable更新を無検証で取り込まない。
- 本体scripts/wasm-build-contract.test.mjs、別Worker tests/build_contract_test.pyを追加。本体の不一致とWorkerのstable指定を修正前に検出。Worker側のスキーマ互換表も上流ソースと実生成で確認して記録した。最終の契約検査は6件＋2件成功（worker-contract-schema-final.log）。

本体MSBのCLI不一致はRust 1.100が新たに作った不具合ではなく、今回の再ビルド検証で見つかった既存の不整合である。別Workerの版差は互換と確認済みで、不具合とは扱わない。Rustアプリケーションの業務処理を推測で書き換えていない。

## 検証環境・成果物の扱い

Rustup-initは公式配布のSHA256を照合し、Rust 1.100.0の公式コンパイル済みツールチェーンを隔離した/opt/rust-compat-20261113へ導入した。ホストのCリンカーが無かったため、aptのgcc/libc6-devを導入。wasm-bindgen CLI 0.2.127/128/129も公式リリースのバイナリと上流sha256sumを照合して使用し、外部ツールのソースインストールは実施していない。

検証対象は今回のRust差分に関係するクレートのみ。本番D1のパッケージ版・ビルドキャッシュ台帳は照会していない。コンテナ用パッケージをソースから更新する作業ではなく、既存の公式コンパイラを使った自前WASMソースの互換性試験である。既存成果物の所在・生成版はcurrent-public-wasm.jsonに保存。ビルドキャッシュは開始時無し、共通の検証用targetディレクトリを使用し、ログに各工程の所要時間を記録した。

既存public/wasmとそのJSを上書きせず、再生成物は/tmpの検証用ディレクトリへ保存する。JS/WASMは一致するbindgenの組で扱う。Dockerビルド、Workerデプロイ、D1書き込み、git pushは行っていない。

根拠ログはartifacts/rust-1.100-20261113/。最終結果は以下。

## 最終検証結果

全対象のcargo test --lockedとcargo build --locked --release --target wasm32-unknown-unknownが成功。全10ロックファイルのハッシュ不変。アプリケーションのRustソースを修正する必要はなかった。

| 対象 | ネイティブ単体テスト | Rust 1.100 WASM release |
|---|---:|---|
| dig-wasm | 5 | 成功 |
| factor-wasm | 0 | 成功 |
| gh-wasm | 12 | 成功 |
| jev-wasm | 14 | 成功 |
| ls-wasm | 9 | 成功 |
| msb-wasm | 6 | 成功 |
| sha256-wasm | 0 | 成功 |
| sqlx-wasm | 2 | 成功 |
| tree-wasm | 6 | 成功 |
| rust-worker-sqlx-d1 | 150 | 成功 |

合計204ネイティブテスト成功。factor/sha256のネイティブテスト件数は0であり、関数の実結果は後述のWASM実行試験で確認した。工程ごとの所要時間はcompile-results.jsonへ記録。別Workerは初回ネイティブ試験約208秒、release約397秒。

- 本体9クレート: ロックに対応した公式CLIでJS/WASMを生成。Node 26.13.1、実Chrome、workerd 2026-11-10の各環境で9モジュールの実関数結果を検査し、すべて成功（node-wasm-smoke-fixed.log、browser-wasm-smoke.log、workerd-result.json）。workerdは両本体設定と同じcompatibility_date=2024-11-17で起動。
- 別Worker: 公式CLI 0.2.129で生成した場合に加え、維持する公式CLI 0.2.128でも生成とworkerd上の/ping HTTP200/本文okを確認（worker-bindgen-compat.json、rust-worker-ping-schema128.log）。したがってWorkerのCLI版差はスキーマ不一致ではない。
- msb-bindgen-mismatch.log: 旧CLI 0.2.127とMSB schema 0.2.128の実際の不一致を再現。対応CLI 0.2.128での生成と実行は成功。
- 初回node-wasm-smoke.logのtreeエラーは、試験データを必要なTSV形式にしていなかった試験側の誤り。foo\tblobへ訂正して全9件成功。Rustソースは変更していない。
- 契約検査は本体6件＋別Worker2件成功、shell/TOMLの構文とgit diff --checkも成功。

## 残る検証境界

本番Workerへの配備・本番の認証済み画面操作・実D1問い合わせは未実施。別Workerのローカル/pingは実コンパイルしたアプリのRust fetchを薄いJS shimから呼んでおり、mockの応答ではない。一方、worker-buildのインストールを伴うwranglerの公開ビルド工程全体は実行していない。今回の確認は現在のロックと機能構成に限り、将来の依存更新・未使用featureまで保証しない。

生成物と実行ハーネスは検証用領域へ保持し、本体public/wasmのJS/WASMは変更していない（public-assets-unchanged.log）。本番反映はなし。初回検証で作成した大きなtargetキャッシュは、ログと実行用生成物を保持したうえで削除する。
