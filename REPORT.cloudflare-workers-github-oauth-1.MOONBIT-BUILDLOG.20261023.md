# REPORT: 本体WorkerへのMoonBit導入と、本番ビルド失敗(code 10021)の原因（2026-10-23）

**対象**: `moonbit/buildlog/buildlog.mbt`、`scripts/build-moonbit.mjs`、`src/generated/moonbit/buildlog.js`、
`src/utils/moonbitBuildLog.ts`、PR [#2453](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/2453)
— ビルドログ解析をMoonBitへ移したときに得た知見と、最初の本番ビルド(Workers Builds)が失敗した原因・対処をまとめる。

## 1. 何が起きたか

PR #2453の最初のpush([`0010a89d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0010a89d))で、Workers Buildsが失敗した。

| 時刻(UTC) | 出来事 |
|---|---|
| 11:01:32 | push |
| 11:01:52 | `wrangler versions upload` がアップロード(gzip 3054.63 KiB) |
| 11:01:54 | Cloudflare APIが検証で拒否 |
| 11:01:57 | GitHubのチェックが失敗 |

ビルド開始から失敗まで約25秒で、**タイムアウト(20分)ではない**。

ビルドログ(ビルド `e64640e7-2d71-4af0-9597-1badb85b4f8f`)の該当部分:

```text
X [ERROR] A request to the Cloudflare API (.../workers/scripts/cloudflare-workers-github-oauth-1/versions) failed.
  Uncaught Error: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()),
  setting a timeout, and generating random values are not allowed within global scope.
    at ... src/generated/moonbit/buildlog.js:14:23 in _M0FPB12random__seed
    at ... src/generated/moonbit/buildlog.js:108:21
   [code: 10021]
```

## 2. 原因

- MoonBitの `Map`(ハッシュ表)は、ハッシュの乱数シードを**モジュールの読み込み時**に作る。生成されたJSでは、`const _M0FPB4seed = _M0FPB12random__seed();` がトップレベルにあり、`crypto.getRandomValues` を呼んでいた。
- Workersは、グローバルスコープ(リクエスト処理の外)での乱数生成・タイマー・非同期I/Oを禁止している。この検証は**Cloudflareへのアップロード時**に行われる。
- 解析処理で `Map[Int64, Step]` を使っていたため、`Map` を使っただけで読み込み時の乱数生成が入った。

## 3. 手元で見つけられなかった理由

| 確認したこと | 結果 | 検出できなかった理由 |
|---|---|---|
| `npx vitest run` | 通過 | Node.jsではグローバルスコープでの乱数生成が許される |
| `wrangler deploy --dry-run` / `wrangler versions upload --dry-run` | 通過 | バンドルまでしか行わず、Cloudflare側の起動検証をしない |
| 生成物のバンドル確認(関数名のgrep) | 含まれていた | 中身の挙動は見ていない |

**`--dry-run` が通っても、本番のアップロードで落ちることがある。** モジュール読み込み時の挙動は、別途確かめる必要がある。

## 4. 対処

| ファイル | 変更 |
|---|---|
| `moonbit/buildlog/buildlog.mbt` | `Map` をやめ、`Array[Step]` を番号で線形に探す形にした(ステップは最大500件なので十分速い) |
| `scripts/build-moonbit.mjs` | 生成物に `getRandomValues` / `Math.random` / `setTimeout` / `setInterval` / `fetch(` が含まれていたら、生成を失敗にする |
| `src/utils/moonbitBuildLog.test.ts` | `crypto.getRandomValues`・`Math.random`・`setTimeout` を呼ぶと例外になるNode.jsで生成物を読み込み、読み込み時に乱数を作らないことを確かめるテストを追加。修正前の生成物ではこのテストが失敗し、修正後は通ることを確認した |

## 5. 今後MoonBitを使うときの知見

### 5.1 ツールチェイン

- 公式インストーラー(`cli.moonbitlang.com`)・`try.moonbitlang.com`・`download.moonbitlang.com` は、Claude Codeのサンドボックスから接続できない(プロキシが拒否)。
- npmの `@moonbit/moonc-worker` は公式のブラウザ向けmoonc(JSに変換したもの)で、Node.jsでもそのまま動く。API は `buildPackage`(パッケージを.coreへ)と `linkCore`(.coreをリンクしてJS/wasmへ)。
- 標準ライブラリの `.mi` / `.core` は、**コンパイラと同じビルドで作られたもの**が必要。今回は `@marianoguerra/tutuca-playground-payload@0.23.0`(`@moonbit/moonc-worker@0.1.202608195` とペア)を使った。版を混ぜると誤った診断(`[E4018] ... no impl is defined` など)が出る。
- 標準ライブラリのリンクに必要なcoreは `abort` と `bundle_core` の2つだけ。payloadにあるtutuca固有のcoreは不要。
- `github.com/moonbitlang/core` は git のプロキシ経由ならcloneできる(HTTPSの直接取得は403)。ただし、コアを自分でビルドする方法は試していない。

### 5.2 JSバックエンドの出力

- `linkCore` に `target: 'js'` と `exportedFunctions` を渡すと、`export { ... as analyze_build_log }` 形式の**ESモジュール**が出る。Workersのバンドルにそのまま入る。
- `Int64` はJSの `BigInt` で表される。`Int` で足りるところは `Int` にすると軽い。
- `extern "js" fn f(x : String) -> Double = "(s) => Number(s)"` のように、JSの関数を直接呼べる。今回は秒数の変換をJSの `Number()` に合わせるために使った。
- 構造体などを直接JSへ返すと、名前が変換されたフィールドになる。TypeScriptとの受け渡しは、**JSON文字列で返し、TypeScript側で形を検証する**方式にした(`src/utils/moonbitBuildLog.ts`)。
- 生成物は決定的(同じソースなら同じ出力)で、`--check` で差分を確かめられる。

### 5.3 Workers固有の注意(今回の失敗)

- **MoonBitの `Map` / `Set` など、ハッシュを使う標準ライブラリの型はWorkersで使わない。** 読み込み時に乱数シードを作り、デプロイが code 10021 で失敗する。番号で引くなら配列、並べ替えが必要なら `Array::sort_by_key` を使う。
- 新しい型や関数を使ったら、生成物のトップレベル(関数の外)に、乱数・タイマー・I/Oを呼ぶコードが出ていないかを確認する。`scripts/build-moonbit.mjs` の検査とテストで、主なものは自動で止まる。

### 5.4 運用

- 生成物 `src/generated/moonbit/*.js` はコミットする。Workers BuildsではMoonBitをコンパイルしない。
- `moonbit/` を変更したら `npm run moonbit:build`、確認は `npm run moonbit:check`。
- 本番ビルドの失敗理由は、GitHubのチェックには表示されない。Cloudflareダッシュボードのビルドログか、`/api/cf-containers/build-log?build=<ビルドUUID>` で確認する。

## 6. 関連コミット

- [`0010a89d`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/0010a89d) 本体WorkerにMoonBitを導入し、Workers Buildsのビルドログ解析をMoonBitで行う(本番ビルドが code 10021 で失敗)
- 本REPORTと同じコミット: `Map` をやめ、読み込み時の乱数生成を検査・テストで止める
