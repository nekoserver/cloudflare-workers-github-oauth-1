# NOTICE: Ruby/WASM 3.4 → 4.0 移行の知見

日付: 2026-09-17

**対象**: `/ruby-wasm`ページ、`/kimi-code/markdown/:id`ページ、
`/neko rubyver`スラッシュコマンド、`POST /api/ruby-wasm/snippets`が使う
公式CRuby WASM(WASI)バイナリを`@ruby/3.4-wasm-wasi`から`@ruby/4.0-wasm-wasi`へ
切り替えた2026-09-15の作業(実装はCursor Agent、以下は既存コミット・SPEC/NOTICEを
読んで確認した内容)。前提となるRuby/WASM導入自体の知見は
[`NOTICE.cloudflare-workers-github-oauth-1.20260831.md`](NOTICE.cloudflare-workers-github-oauth-1.20260831.md)
の「`/ruby-wasm`」節を参照。

## コミットログを元にした作業内容と得られた知見

| 日時(UTC) | コミット | 何をやったか | 何を得たか(知見) |
|---|---|---|---|
| 2026-09-15 12:14 | [`f0c6138`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/f0c6138) 「Ruby/WASMの読み込み先を公式4.0バイナリに切り替える」 | `/ruby-wasm`と`/kimi-code`が共有する`RUBY_WASM_BINARY_URL`を`@ruby/3.4-wasm-wasi@2.10.1`から`@ruby/4.0-wasm-wasi@2.10.1`に変更。JSグルー(`@ruby/wasm-wasi@2.10.1`、esm.sh経由)はバージョン据え置き。`getRubyWasmVersionInfo()`のパーサ・`/neko rubyver`表示・スニペット保存時の`ruby_version`列も4.0を返すように追随 | **バイナリ本体のURLだけ差し替えれば良い設計になっていた**(1節参照)ため、切り替え自体は1ファイル(`src/views/rubyWasm.ts`)の定数変更で済んだ。ただし「表示・保存・パース」の3箇所がこの1つの定数に依存しているため、**定数を変えたらこの3箇所すべてのテストを同時に更新しないと古いバージョン文字列が混在する**ことが分かった(実際`aichat-slash-rubyver.test.ts`・`kimi-code-markdown-page.test.ts`・`ruby-wasm-page-20260831.test.ts`・`ruby-wasm-snippets.test.ts`・`ruby-wasm-version-info.test.ts`の5ファイルを同時修正している) |
| 2026-09-15 12:19 | [`730cf43`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/730cf43) 「SPECとNOTICEにRuby/WASM 4.0切り替えを追記する」 | `SPEC.cloudflare-workers-github-oauth-1.20260915.md`4節・`NOTICE.cloudflare-workers-github-oauth-1.20260915.md`にドキュメント化 | 切り替え前に想定した故障シナリオ5件(4.0パッケージ不在によるCDN 404、`/ruby-wasm`と`kimi-code`の不一致、`/neko rubyver`表示の取り残し、新規スニペットの`ruby_version`取り残し、旧3.4 URLのパース不能化)を明文化。**過去に保存済みのスニペットの`ruby_version='3.4'`は書き換えず、新規保存分だけ`4.0`になる**という「過去データは不変、新規から新仕様」という移行方針を採った |
| 2026-09-15 12:49 | [`1ba7163`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/1ba7163) 「Ruby/WASM 4.0の読み込みをcompileStreamingから外し進捗とバージョン検証を入れる」 | バイナリが3.4(約30MB)→4.0(約32MB)になったことで顕在化した`WebAssembly.compileStreaming`のモバイル(iOS Safari)でのハング・失敗に対処。`WebAssembly.compile(arrayBuffer)`方式へ変更、ダウンロード進捗表示、Cache APIでのバイナリキャッシュ、起動後に`RUBY_VERSION`をevalして期待ビルドライン(`4.0`)と前方一致するか検証する`assertRubyBuildLine()`を追加。共有ローダー`src/utils/rubyWasmLoader.ts`を新設し`/ruby-wasm`・`/kimi-code/markdown/:id`の両方から使う形に統一 | **バイナリサイズが数十MB級になると、`compileStreaming`が「たまたま動いていただけ」の状態から実際に壊れる閾値を超えることがある**(3.4=約30MBでは問題化せず、4.0=約32MBで表面化)。サイズ増加を伴うバージョンアップでは、ローディング方式自体の耐性を疑う必要がある。また**「バイナリを差し替えた」ことの成功判定を、HTTPステータスやファイルサイズだけでなく、実際にWASM上で`RUBY_VERSION`を評価して確認する**設計にしたことで、「URLは4.0を指しているのに実体は古いキャッシュ/CDNミラーの3.4だった」というケースも検出可能にした |
| 2026-09-15 12:50 | [`556f7ad`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/556f7ad) 「SPECとNOTICEにRuby/WASM 4.0読み込み修正を追記する」 | `NOTICE.cloudflare-workers-github-oauth-1.20260915.md`に、上記`1ba7163`で得た`compileStreaming`回避・Content-Length不整合・Cache API失敗時のフォールバック・バージョン検証の知見を追記 | `Content-Length`ヘッダは圧縮後サイズを指すことがあり、`body.getReader()`で受信する実バイト数(展開後)がそれを上回る場合がある。**進捗表示は「受信量が総量を超えたら%を出さず受信量だけ表示する」形にしないと、進捗が100%を超えて表示される**。また`jsDelivr`のHEAD/Rangeで先頭4バイトを見ても`Content-Encoding`付きだと`\0asm`(WASMマジックナンバー)にならないことがあり、**Range取得結果の先頭バイトだけでバイナリ破損を判定してはいけない** |
| 2026-09-15 21:51 (JST) | [`b29e8c0`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/b29e8c0) 「Merge pull request #1830 from nekoserver/cursor/ruby-wasm-4-0-0a8f」 | 上記4コミットをまとめてmainへマージ | 一連の変更が単一のPR(#1830)・単一のブランチ(`cursor/ruby-wasm-4-0-0a8f`)にまとまっていたため、後から「4.0移行の一式」として追跡しやすかった |

## まとめ(移行そのものから得られた知見)

**対象**: 今後Ruby/WASMのビルドラインを再度上げる(例: 4.1や5.0)場合、または類似の
「公式配布済みWASMバイナリのバージョンを差し替える」作業全般に適用できる教訓。

1. **バイナリURLを1つの定数(`RUBY_WASM_BINARY_URL`)に集約していたことが移行コストを
   最小化した**。表示・保存・パースのロジックはすべてこの定数由来の値を参照する設計に
   なっていたため、切り替え自体は定数1行の変更で済んだ。今後も「バージョン文字列を
   各所に決め打ちで埋め込まない」設計を維持すること
2. **バイナリのサイズが増えるバージョンアップでは、読み込み方式(`compileStreaming`等)の
   前提が崩れていないかを疑う**。3.4→4.0は容量差が小さかった(約30MB→約32MB)にも
   関わらず、モバイルブラウザでの動作が「たまたま動く」から「ハングする」へ変わった。
   次のバージョンアップでも同様の再検証が必要
3. **バージョン切り替えの成功判定は、URL文字列の変更だけでなく実行時の実測値
   (`RUBY_VERSION`のeval結果)で検証する**。CDN・キャッシュ経由で古いバイナリが
   紛れ込むケースを、この検証が唯一検出できる
4. **過去に保存済みのデータ(スニペットの`ruby_version`列)は書き換えず、新規保存分から
   新しいバージョン表記にする**という移行方針は、過去データの意味を保持したまま
   段階移行できる点で妥当だった。全件マイグレーションが必要な場面と、この
   「新規から適用」で足りる場面を区別して判断すること
5. **ドキュメント化(SPEC/NOTICE)を実装コミットと同じ日のうちに追記するコミットへ
   分離していた**ため、後から「いつ・何を・なぜ変えたか」を`git log`だけで正確に
   再構成できた。本ファイルもその記録を元に作成している
