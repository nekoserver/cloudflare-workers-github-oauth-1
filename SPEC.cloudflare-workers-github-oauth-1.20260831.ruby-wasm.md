# Ruby (WASM) 実行ページの追加

## 1. `/ruby-wasm` — ブラウザ上でRubyコードを実行するデモページ

**対象**: 新規ページ `GET /ruby-wasm`(`src/views/rubyWasm.ts`)と、そのルート登録
(`src/index.ts`)。公式のCRuby WASM(WASI)ビルドをブラウザ上のWebAssemblyで実行し、
ユーザーが入力したRubyコードの標準出力/例外を画面に表示する。

### 背景

既存の `/sha256-wasm` `/factor-wasm` 等は、自前で書いたRustクレートを
`wasm32-unknown-unknown` へビルドして `public/wasm/` に配置する構成
(`wasm/README.md` 参照)。しかしCRuby自体はC言語で書かれており、
`NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md` 3節に記録されている
とおり、この環境ではC言語のコード生成を含むクレートを `wasm32-unknown-unknown`
向けに自前ビルドできない(`stdlib.h` が見つからないエラーで失敗する)。

同NOTICEの教訓「そのツール自体がすでに公式にWASMビルドを配布していないか
確認する」に従い、Ruby公式プロジェクト `ruby/ruby.wasm` が npm で配布している
ビルド済みパッケージ(`@ruby/wasm-wasi` + `@ruby/3.4-wasm-wasi`)をそのまま使う
方針にした。

### 既存WASMモジュールとの構成の違い

| 項目 | 既存(`sha256-wasm`等) | 今回(`ruby-wasm`) |
|---|---|---|
| ソース | 自前Rustクレート(`wasm/<name>-wasm/`) | 公式配布パッケージ(`@ruby/wasm-wasi`) |
| バイナリの配置 | `public/wasm/`にコミット(数十KB) | リポジトリにコミットしない(本体は約30MB) |
| 読み込み元 | 自ドメイン(`/wasm/<name>.js`) | jsDelivr CDN(`cdn.jsdelivr.net`) |
| サーバー(Worker)側実行 | `initSync()`で対応 | 未対応(ブラウザ実行のみ) |
| `WASM_MODULE_REGISTRY`登録 | あり | なし(スキーマがRustソース前提のため不一致) |

バイナリを自ドメインに置かない理由: `ruby+stdlib.wasm` は約30MBあり、他の
WASMモジュール(数十KB)と比べて桁違いに大きい。リポジトリ肥大化とCloudflare
Workers assetsへの影響を避けるため、公式npmパッケージがすでに配信している
jsDelivr CDN経由でブラウザから直接取得する構成にした。

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `src/views/rubyWasm.ts` | `/ruby-wasm`ページ本体。CDNからDefaultRubyVMを動的import・fetchし、`StringIO`で`$stdout`を捕捉して実行結果を表示 |
| `src/index.ts` | `GET /ruby-wasm`ルート登録。CSPに`wasm-unsafe-eval`と`https://cdn.jsdelivr.net`(script-src/connect-src)を追加(このページのみ) |
| `src/ruby-wasm-page-20260831.test.ts` | ページHTMLの構造(動的import・エラー表示・XSSエスケープ)の単体テスト |
| `src/ruby-wasm-csp-20260831.test.ts` | `/ruby-wasm`のCSPヘッダー検証、他ページへの波及がないことの検証 |

## 2. 故障想定とテスト設計

| 故障シナリオ | 検出・対処 | テスト |
|---|---|---|
| CDN URLが誤っており読み込みに失敗する | `.catch`でエラーメッセージを表示、ボタンは無効のまま | `ruby-wasm-page-20260831.test.ts` |
| CSPが緩すぎ/足りず他ページへ波及する、または`/ruby-wasm`自体がブロックされる | `/ruby-wasm`のみ上書き、他ページ(`/heritage-access`)は変更なしを確認 | `ruby-wasm-csp-20260831.test.ts` |
| ユーザー名によるXSS | `escapeHtml`でエスケープ | `ruby-wasm-page-20260831.test.ts` |
| 入力したRubyコードが例外を投げる | try/catchで結果欄にメッセージ表示(握りつぶさない) | `ruby-wasm-page-20260831.test.ts` |
| vitest(Node)環境でWASMの実行結果自体を検証しようとして原因不明のエラーで詰まる | NOTICE 10節と同じ理由で、TS側はページ配線・CSPのみ検証し、実行結果の正しさはブラウザでの手動確認に委ねる | (方針のみ、テスト対象外) |

### 対処方針

- CDN取得の失敗は自動回復不能・軽微に分類し、エラー内容をそのまま画面に表示する
  (ユーザーが原因を判断できるようにする)。
- 実行時Ruby例外は自動回復不能・軽微に分類し、例外メッセージをそのまま結果欄に
  表示する(内容を握りつぶさない)。

## 3. 注意事項

- `WASM_MODULE_REGISTRY`(`src/data/wasmModuleRegistry.ts`)には登録していない。
  同レジストリは「自前Rustソース + `public/wasm/`配下の生成物」を前提とした
  スキーマ(`sourceDir`/`sourceFile`等)であり、今回のCDN配信構成とは前提が
  異なるため。将来的にRust自前実装へ移行する場合は改めて登録すること。
- サーバー(Worker)側からの実行(AIチャットの`/neko`サブコマンド等)には対応
  していない。CDN取得・約30MBのメモリ確保はWorkerのCPU時間/メモリ制限と
  相性が悪く、今回はブラウザ実行のみに限定した。
- ブラウザ手動確認は本セッションでは実施できていない(Cloudflareへのデプロイが
  必要なため)。デプロイ後、ユーザー側で `/ruby-wasm` の動作確認をお願いしたい。

## 4. 関連コミット

**対象**: 本仕様に対応する履歴 — コミット作成後にGitHub上のコミットリンクを追記する。

本変更のコミットで初回実装する。
