# SPEC: /cf-containers のApacheモジュール一覧に説明のモーダルとヘルプ(iframe)を付ける

作成日: 2026-11-15
ブランチ: `feat/cfc-apache-module-help-20261115`

---

## 1. グレーアウト中の表示を変える

**対象**: `src/views/cfContainers.ts` のApacheモジュール一覧(Apache(本体)行のトグルで▼にしたときの、🔐でない行) — グレーアウトしても緑の表記は薄くせず、モジュール名は読める色にする。

### 背景

▼の状態では🔐でない行を`opacity: 0.45`で行ごと薄くしていたため、緑の「有効」「導入済み」まで薄くなり、モジュール名も読みにくかった(ユーザー指定、2026-11-15)。

### 修正内容

| 変更前 | 変更後 |
|---|---|
| `.module-unlocked { opacity: 0.45; }`(行全体) | `.module-unlocked td:not(.module-active):not(.module-first)`だけを薄くする。緑のセル(`.module-active`)は薄くしない |
| モジュール名の列も薄くなる | モジュール名の列に`.module-first`を付けて薄くしない。チェックボックス(`.module-lock-cell`)だけ薄くする |
| 無効なモジュール名は`var(--muted)` | グレーアウト中の行では`var(--text)`(ダークテーマでは白`#e6edf3`) |

「白色」の指定は、`var(--text)`で実現している。ライトテーマで固定の白にすると背景と同化して読めなくなるため、固定色は使わない(CLAUDE.CSS.md「色は必ずCSS変数を使え」)。ダークテーマでは白、ライトテーマでは通常の文字色になる。

---

## 2. モジュール名のタップで説明のモーダルを開く

**対象**: `src/views/cfContainers.ts` の`<script id="apache-modules-panel">`、`#apache-module-modal` — モジュール名をボタンにし、押すと最上位のモーダルに状態・説明・設定項目を出す。

### モーダルの中身

| 項目 | 出どころ |
|---|---|
| 有効状態(`#apache-module-state`) | コンテナの`apache2ctl -M`(既存の`apacheModules`)。導入済みで有効なら緑(`.module-active`)の「有効」 |
| 導入・Apache版 | 既存の`apacheModules` |
| 説明・区分・識別子・ソース・互換性 | 静的アセットの`modules.json`(マニュアルから抽出) |
| 設定項目(ディレクティブ)の名前・説明・構文・既定値・使える場所 | 同上。名前を押すとヘルプのその節を開く |
| ヘルプへのリンク(`a.apache-help-link`) | `modules.json`にそのモジュールがあるときだけ出す |

- 重ね順は、開く直前に画面のすべての要素のz-indexの最大値+100にする(CLAUDE.md ルール26。ページ内の既存の`getNextZ()`と同じ方式)。ヘルプはモジュールのモーダルよりさらに上に開く。
- `modules.json`は初めて開いたときに1回だけ読む。読めなければ「説明を読み込めませんでした(HTTP 404)」のように理由を出し、状態の表示は続ける。失敗した場合は次に開いたときに読み直す。
- `modules.json`に無いモジュールは、リンクを出さず「静的アセットにこのモジュールの説明がありません」と書く。
- 閉じるボタン・背景のクリック・Escapeで閉じる。Escapeは上のモーダル(ヘルプ)から順に閉じる。ヘルプを閉じたらiframeを`about:blank`に戻す。
- 「設定内容」は、マニュアルにある設定項目(ディレクティブ)として出している。コンテナで実際に書かれている設定(`/etc/apache2/mods-enabled/*.conf`)は出していない。出すにはコンテナの`server.js`の変更と再ビルドが要る(未決事項)。

---

## 3. ヘルプを最上位のiframeで表示する

**対象**: `#apache-help-modal`、`#apache-help-frame`、`public/_headers` — リンクを押すと、静的アセットのヘルプを最上位のモーダルの中のiframeで表示する。

- iframeは`sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"`で分離する。マニュアルのインラインscript(コードの色付けと言語切替)は動くが、本体ワーカーのページと同じオリジンとしては扱われない(Cookieや画面に触れない)。
- 静的アセットはWorkerより先に配信されるため、Workerが全応答に付ける`X-Frame-Options: DENY`は付かない。`public/_headers`で`/apache-manual/*`に`X-Frame-Options: SAMEORIGIN`と`frame-ancestors 'self'`を付け、同じオリジンのページからだけ埋め込めるようにした。
- `/cf-containers`のCSPは既定の`default-src 'self'`のままで、同じオリジンのiframeは表示できる。

---

## 4. 最新Apacheのソースからヘルプを静的アセットへ展開する

**対象**: `scripts/extract-apache-manual.py`、`public/apache-manual/2.4.71/`、`src/data/apacheManual.ts` — Apacheのソースアーカイブからモジュールのマニュアルを取り出し、本体ワーカーの静的アセットに置く。

### 取得物と照合

| 項目 | 値 |
|---|---|
| 最新版(2026-11-15、`downloads.apache.org/httpd/`で確認) | 2.4.71(コンテナの`ARG APACHE_VERSION`と同じ) |
| 取得元 | `https://downloads.apache.org/httpd/httpd-2.4.71.tar.bz2` |
| 照合 | 配布元の`httpd-2.4.71.tar.bz2.sha512`と一致(`b0eca269…ed167e`)。スクリプトも照合し、違えば何も書かずに止まる |

### 展開する物

| 物 | 内容 |
|---|---|
| `mod/*.html` | `docs/manual/mod/*.html.en`(138ページ)。拡張子を`.html`に変える |
| `style/`・`images/` | 表示に要るCSS・script(`prettify`)と、ページが参照する画像だけ |
| `LICENSE`・`NOTICE` | Apache License 2.0の表記 |
| `modules.json` | モジュール名(識別子から`_module`を除いたもの。`apache2ctl -M`の表記と同じ)ごとの説明・区分・識別子・ソース・互換性・ディレクティブ。130モジュール。`mpm_event`は`mod/event.html`に対応する |

合計約4.6MB・159ファイル。リンクの扱いは次のとおり。

- `mod/`の中のリンクはそのまま。
- `mod/`の外(用語集・howtoなど)への相対リンクは、公式のオンライン版`https://httpd.apache.org/docs/2.4/`に張り替える。
- 外部リンクには`target="_blank"`と`rel="noopener noreferrer"`を付け、iframeの中で外部サイトへ移らないようにする。既存の`rel`(言語切替の`alternate`)には追記する。

### 版を上げるとき

1. `containers/demo/Dockerfile`の`ARG APACHE_VERSION`と`src/data/apacheManual.ts`の`APACHE_MANUAL_VERSION`を揃える(`src/apache-manual-assets.test.ts`が食い違いを検出する)。
2. 新しい版のアーカイブと`.sha512`を空のディレクトリに取得し、`python3 -I scripts/extract-apache-manual.py <dir>/httpd-<版>.tar.bz2 <dir>/httpd-<版>.tar.bz2.sha512 public/apache-manual`を実行する。
3. 古い版のディレクトリを消す。

`bzip2`コマンドが無い環境でも動くよう、展開はPythonの`tarfile`で行う。ソースのコンパイルはしない(CLAUDE.md コンテナビルドのルール8に触れない)。

---

## 5. 故障想定と確認状況

| 故障シナリオ | 対処 | 検証 |
|---|---|---|
| 行全体のopacityで緑の表記まで薄くなる | 薄くするセルを限定 | 画面テスト(CSSの規則) |
| モーダルが既存の要素の裏に出る | 開く直前に最大z-index+100 | 画面テスト(z-index 5000の要素より上) |
| 無効なのに緑の「有効」を出す | 導入済みかつ有効のときだけ`.module-active` | 画面テスト |
| 説明の無いモジュールでリンク切れ | `modules.json`に無ければリンクを出さない | 画面テスト |
| 説明の読み込み失敗でモーダルが開かない | 状態を先に出し、失敗は理由を書く | 画面テスト(HTTP 404) |
| ヘルプのscriptがページと同じ権限で動く | iframeを`sandbox`で分離 | 画面テスト(属性) |
| コンテナのApacheの版とマニュアルの版が食い違う | 契約テスト | `src/apache-manual-assets.test.ts` |
| `modules.json`が指すファイルが無い・外部scriptを読む・外部リンクがiframe内で開く | 契約テスト | 同上 |

### 確かめていないこと

- 本番で、`/apache-manual/*`に`_headers`のヘッダーが付くことと、iframeに実際に表示されること(デプロイ後に確認が要る)。
- 実際のブラウザでの見た目(テストはJSDOM。CSSは規則の文字列で検査した)。
- `sandbox`のiframeの中で、マニュアルのCSS・scriptが読み込まれること(同じURLのオリジンから読むので動く想定だが、実ブラウザでは未確認)。

---

## 6. 未決事項

- コンテナで実際に書かれている設定(`/etc/apache2/mods-enabled/<名前>.conf`)もモーダルに出すか。出すにはコンテナの`server.js`の変更とイメージの再ビルドが要る。

---

## 7. コンテナ

- 再ビルド: 不要(`src/views/`・`src/data/`・`public/`・`scripts/`の変更で、`containers/**`・`src/containers/**`・`wrangler.toml`の`[[containers]]`に触れていない)
- 再起動: 不要(Worker側だけの変更)
