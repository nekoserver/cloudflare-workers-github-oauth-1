# SPEC: 本体WorkerへのMoonBit導入(ビルドログ解析)（2026-10-23）

## 1. ビルドログ解析をMoonBitへ移す

**対象**: `moonbit/buildlog/buildlog.mbt`(解析本体)、`src/generated/moonbit/buildlog.js`(生成物)、
`src/utils/moonbitBuildLog.ts`(TypeScriptからの呼び出し)、`src/utils/containerBuildTimings.ts` の `parseBuildTimings`
— Workers Builds(本番ビルド)のログから、BuildKitのステップごとの処理名・状態・秒数を取り出す処理をMoonBitで実装し、
既存のD1保存(`cf_container_build_measurements` / `cf_container_build_steps`)と管理画面の表示にそのままつなぐ。

### 背景

本体WorkerでMoonBitを使えるようにし、最初の用途として実際のビルドログ解析に組み込む。

### 処理の流れ

| 順 | 担当 | 内容 |
|---|---|---|
| 1 | TypeScript(`src/utils/cfBuildsApi.ts` の `fetchLatestBuildLog`) | Cloudflare APIからビルドログを取得する(変更なし) |
| 2 | MoonBit(`analyze_build_log`) | ログを解析し、結果をJSON文字列で返す |
| 3 | TypeScript(`src/utils/moonbitBuildLog.ts` の `analyzeBuildLog`) | JSONの形を検証し、成功/失敗を判別可能な型(`ok` / `errorCode`)にする |
| 4 | TypeScript(`storeBuildTimings`) | 既存のD1保存・`/cf-containers/planner` の表示へつなぐ(変更なし) |

### 修正内容

| ファイル | 変更概要 |
|---|---|
| `moonbit/buildlog/buildlog.mbt` | 旧TypeScript実装と同じ規則の解析(ANSI除去、タイムスタンプ、`#N`、DONE/CACHED/ERROR/CANCELED、処理名1500文字、番号の再使用・500件超過の検出)。正規表現は使わない |
| `scripts/build-moonbit.mjs` | MoonBitをJSバックエンドでコンパイルし、`src/generated/moonbit/<pkg>.js` を書き出す。`--check` で生成物とソースの一致を確認 |
| `src/generated/moonbit/buildlog.js` / `.d.ts` | 生成物(コミットする)と型 |
| `src/utils/moonbitBuildLog.ts` | MoonBitの出力を検証する。想定外の形は `invalid_output` として返す |
| `src/utils/containerBuildTimings.ts` | `parseBuildTimings` の中身をMoonBit呼び出しに置き換え。失敗時は従来どおり例外にする |
| `src/utils/moonbitBuildLog.test.ts` | 旧TypeScript実装との突き合わせ(実ログ形式・境界値・ランダム300件)、エラーコード、出力検証のテスト |
| `package.json` | `npm run moonbit:build` / `npm run moonbit:check` を追加 |

### エラーの扱い

| errorCode | 意味 |
|---|---|
| `step_id_reused` | 同じ `#N` が別の処理名で再使用された(複数ビルドのログが混ざっている) |
| `too_many_steps` | ステップが500件を超えた |
| `invalid_output` | MoonBitの出力がJSONでない、または形が想定と異なる(TypeScript側で判定) |

### 注意事項

- **生成物はコミットする**。Workers Buildsのビルドコマンドでは MoonBit をコンパイルしない。`moonbit/` を変更したら `npm run moonbit:build` を実行し、`src/generated/moonbit/` も一緒にコミットすること。
- コンパイラは `@moonbit/moonc-worker@0.1.202608195`、標準ライブラリは同じビルドで作られた `@marianoguerra/tutuca-playground-payload@0.23.0`(.mi/.core)を使う。**この2つは必ず同じビルドの組み合わせで使う**(混ぜると誤った診断が出る)。版を上げるときは両方を揃えて上げる。
- 標準ライブラリはサードパーティ(tutuca)がnpmに置いた公式ビルドの出力を使っている。公式の `moon` CLI(cli.moonbitlang.com)はこの環境から届かないため。`moon` CLIが使える環境に移るなら、置き換えを検討する。
- ツールチェインは `.moonbit-toolchain/`(gitignore済み)にインストールされ、本番の依存(`package.json` の dependencies)には入らない。
- 警告が1件でもあれば生成を失敗にしている。
