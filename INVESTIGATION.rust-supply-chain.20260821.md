# Rustサプライチェーン攻撃の影響調査（2026-08-21）

## 結論

**現時点で、このリポジトリが影響を受けたことを示す証跡は確認できない。**

- Rustプロジェクトは `wasm/` 下の3クレートだけである。
- ロックされた依存グラフに、公開済みの悪性Rustクレートとして確認対象にした
  `faster_log` / `async_println` / `string2` / `hexavi` / `cde` / `unicode` / `xcb`
  は含まれていない。類似名やGit直接依存もない。
- 3つの `Cargo.lock` は全てcrates.ioのchecksum付き依存に固定され、
  `cargo metadata --locked --offline` で整合性を確認できた。
- 本番で配信するWASMはリポジトリ内のビルド済み成果物で、Cloudflareの
  deploy時にCargoがクレートを取得する構成ではない。

ただし、これは「侵害が絶対にない」ことの証明ではない。攻撃キャンペーンのIOCに追加クレート/
追加バージョンが公表された場合は、そのリストで再評価する必要がある。

## 調査範囲と方法

1. リポジトリ内の `Cargo.toml` / `Cargo.lock` / Rustソース / `.wasm` を全検索。
2. `cargo tree --locked` で、直接・間接依存を展開。
3. 上記の悪性クレート名と、Git/path依存の混入をマニフェストとロックファイルで照合。
4. `cargo metadata --locked --offline` を各クレートで実行し、ロックを書き換えず
   ローカルキャッシュから解決できることを確認。
5. 配信中WASMのSHA-256を記録し、WebAssembly importを列挙。
6. Git履歴でRust/WASMファイルの導入経緯を確認。

## 実際の依存グラフ

| クレート | 直接依存（lock後） | 用途 |
|---|---|---|
| `dig-wasm` | `wasm-bindgen 0.2.127` | DNSワイヤ形式の組み立て・解析 |
| `factor-wasm` | `wasm-bindgen 0.2.127` | 素因数分解 |
| `sha256-wasm` | `wasm-bindgen 0.2.127`, `sha2 0.10.9` | SHA-256 |

間接依存のユニーク集合は次の通りで、すべてcrates.io由来である。

`block-buffer 0.10.4`, `bumpalo 3.20.3`, `cfg-if 1.0.4`, `cpufeatures 0.2.17`,
`crypto-common 0.1.7`, `digest 0.10.7`, `generic-array 0.14.7`, `libc 0.2.189`,
`once_cell 1.21.4`, `proc-macro2 1.0.107`, `quote 1.0.47`, `rustversion 1.0.23`,
`syn 2.0.119`, `typenum 1.20.1`, `unicode-ident 1.0.24`, `version_check 0.9.5`,
`wasm-bindgen-macro 0.2.127`, `wasm-bindgen-macro-support 0.2.127`,
`wasm-bindgen-shared 0.2.127`.

`unicode-ident` は正規のRustエコシステム依存であり、確認対象の悪性クレート
`unicode` とは別物である。

## 影響判定

### 1. 開発者/CIのシークレット漏えい: 現状の証跡なし

悪性crateがbuild scriptやproc macroで実行されると、ビルドホスト上のSSH鍵、
GitHub token、Cloudflare token等は竃取対象になり得る。このリポジトリでは該当IOCは
ロックグラフになく、GitHub Actions内にCargoビルド手順もないため、その経路での
影響は確認できない。

### 2. Worker/ブラウザ実行時: 低リスク

WASM成果物のimportは生成された `*_bg.js` のwasm-bindgenヘルパーのみだった。
WASI、ファイルシステム、ソケットのimportはない。ただしWASMはホストJSが与えた
権限で動くため、今後のビルドで依存が改ざんされれば「WASMだから安全」とは言い切れない。

### 3. 将来の再ビルド: 要対策

`Cargo.lock` があるため、`--locked` を使う限り依存が無言で新バージョンに
上がることはない。一方、マニフェストの `wasm-bindgen = "0.2.127"` と
`sha2 = "0.10"` はCargo上は互換バージョン範囲である。ロック更新時には差分と
advisory/IOCをレビューする必要がある。

## 配信中成果物のベースライン

| ファイル | SHA-256 |
|---|---|
| `public/wasm/dig_bg.wasm` | `9c4422464546fc2710ea767972f24259df30f0d8a03b7b26416f84278b5b2ea6` |
| `public/wasm/factor_bg.wasm` | `c835bd99cd8e2a30a55b24959967e7d90eeb3503b956a8340e87783934007c17` |
| `public/wasm/sha256_bg.wasm` | `547793e7bcbd1a9ff5c7fe11260f02b48a15701899e5f4e16d229e99ee32ccb1` |

今後、Rustソースを変更していないのにこれらが変わった場合は、成果物の
差し替えまたはビルド環境の変化として調査する。

## 推奨アクション

1. Rustビルドで常に `cargo build --locked` / `cargo test --locked` を使う。
2. `Cargo.lock` 更新は独立PRにし、追加されるcrate、source、checksumをレビューする。
3. CIにRustSec/OSV系の依存監査と、上記WASMハッシュの意図した変更確認を追加する。
4. 再ビルドはシークレットを持たない隔離環境で行い、ビルドとdeployを分離する。
5. 今回の攻撃の確定IOC（crate名、バージョン、checksum、C2ドメイン）が更新されたら
   ロックファイルと開発/CIホストのネットワークログを再照合する。

