# NOTICE — WebGL地球儀ページの z-index / ツールチップ埋没トラブルに関する知見

日付: 2026-07-28

---

## 1. `position:fixed` の要素は「DOM順序」ではなく「z-index」だけで前後関係が決まる

### 現象

活断層ページ(`/webgl-faults`)で、ピン留めした断層/火山ツールチップが偶然
別のUI要素(ボタン・サイドバー・ドロワー・メニュー)の上に重なると、そのUI要素を
クリックしたつもりが実際にはツールチップ側がクリックを奪ってしまい、
「ボタンが反応しない」「タップした地点にツールチップ自身が移動してしまう」という
不具合になっていた(関連PR: [#1193](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/1193), [#1195](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/1195), [#1197](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/1197))。

### 原因(CSSの基本だが見落としやすい)

- `#fault-tooltip` / `#mk-tooltip` はいずれも `position:fixed` + 明示的な `z-index`
  を持ち、**独自のスタッキングコンテキスト**を形成する。
- 一方、ボタンやサイドバーなど「触られる側」の要素に `z-index` が
  **未設定(= auto)** だと、DOM上でどれだけ後に書かれていても、
  明示的な `z-index` を持つ `position:fixed` 要素には常に負ける。
  「HTML内で後に書いた方が上に来る」という直感は、相手が
  `position:fixed`+`z-index` 持ちの場合は通用しない。
- 実際、`.side`(右サイドバー本体。断層リスト・タイプフィルターボタン・
  自転速度スライダー・設定パネルをすべて含む唯一のコンテナ)には
  `z-index` が一切設定されていなかった。ツールチップの `z-index:60〜65` に
  対して常に埋没していたが、通常はツールチップがサイドバーの上に重なる位置に
  来ないため気づかれていなかった。

### 教訓

- **「クリックできない」系の不具合を疑ったら、まず `document.elementFromPoint(x, y)`
  で実際に何がその座標を受け取っているかを確認する。** CSSを読んで頭の中だけで
  スタッキング順を推論すると、今回のように誤った仮説(「負のmarginがヒット領域を
  拡張しているのでは」等)に飛びついて時間を浪費する。Playwrightで
  `page.evaluate(() => document.elementFromPoint(x,y).id)` を叩けば一発で分かる。
- **z-indexがらみの修正は「今触っている1要素」だけでなく、そのページの
  `z-index` を持つ要素を`grep`等で全部洗い出してから直す。** 今回は
  ツールバー(`.canvas-ctrl-btns`)だけを直すPR(#1195)→サイドバー・
  エリアメニュー・ドロワーを直すPR(#1197)と2回に分けて出す羽目になった。
  最初から `grep -n "z-index" src/views/webglFaults.ts` で全量を洗ってから
  直せば1回で済んだはず。
- CSS Grid/Flex の子要素は `position:relative` を明示しなくても
  `z-index` が効く(仕様上 `position:relative` を指定したのと同じ扱いになる)。
  `.side` は `.body { display:grid }` の子なので、`z-index:110;` を
  追加するだけで直せた(`position` の追加は不要)。

---

## 2. このリポジトリのWebGL地球儀ページにおける z-index の目安

活断層ページ(`webglFaults.ts`)で最終的に落ち着いた値。今後
同種のページ(`webglHeritage.ts` 等)に手を入れる際もこの並びを踏襲すること。

| 用途 | z-index目安 | 備考 |
|---|---|---|
| キャンバス本体・マーカー・矩形選択オーバーレイ | 0〜60 | `#box-select-overlay` は60 |
| フローティングのツールチップ(ホバー・ピン留め) | 60〜70 | `#mk-tooltip`(60)、`#fault-tooltip`/`#vol-tooltip`(65) |
| 永続的なUIコントロール(ツールバー・サイドバー・ドロワー・メニュー) | 110 | クリック操作の対象となるものは**必ずツールチップより高くする** |
| ドロワー内の個別ツールチップ(例: 空港ドロワー内の`#apt-tooltip`) | 115 | 「格納先のドロワー(110)より上」を維持すること |
| 動的モーダル(`getNextZ()`で生成されるもの) | 200以上 | `getNextZ()` は既存要素の最大z-index+100を返すため自動的にこの範囲に収まる |

**ポイント**: 「ツールチップ」と「クリックして操作するUI」は必ずこの順序
(操作UI > ツールチップ)にする。ツールチップは情報表示専用であり、
サイドバーやボタンより手前に出る必要は本来ない。

---

## 3. 未対応の既知リスク: `webglHeritage.ts`(世界遺産ページ)にも同じ構造の危険がある

`grep -n "z-index" src/views/webglHeritage.ts` で確認したところ、以下の
**未修正の懸念**が見つかっている(本セッションでは修正していない、今後の
対応候補として記録)。

- `#mk-tooltip` の `z-index` が **`10000`** という極端な値になっている。
- `.canvas-ctrl-btns` は `z-index:5`(activeFaultsページの旧バグと同じ値)。
- `.side` は `z-index` 未設定(activeFaultsページの旧バグと同じ)。
- `.airport-drawer` は `z-index:20`。
- しかも `#mk-tooltip: 10000` は `.landing-overlay`(150)・`.f1-side`(90)・
  `stats-overlay`(200)・`.cities-modal-overlay`(250)・`.ch-overlay`(300)・
  `.city-fly-panel`(300) など**多くのモーダル・ドロワーより高い**ため、
  ピン留めされたツールチップがこれらモーダルの操作すら妨げる可能性がある
  (`webglFaults.ts` 側の不具合より潜在的に深刻)。

`webglHeritage.ts` 側でユーザーから同種の不具合報告があった場合は、
本NOTICEの「2.」の目安に沿って z-index を洗い出し、一括で直すこと。
`#mk-tooltip:10000` のような突出した値がある場合はまずそこを疑う。

---

## 4. 一見無関係に見えたが実は同根だった不具合の見分け方

同じセッション内で以下3つの不具合報告が続けて来た。表面上は別々の現象に
見えるが、いずれも「エリアズーム(巡回)完了時にユーザーの既存状態を
強制的に上書きしてしまう」という**共通のバグパターン**だった。

1. 巡回完了後にズームが勝手に既定値へ戻る(`zoomTarget = 3.2` の強制上書き)
2. 巡回完了後に地球儀が勝手に自動回転を再開する(`autoRot = true` の強制上書き)

`stopAreaTour(completed)` の `if (completed) { ... }` ブロックに
「ユーザーが元々何を設定していたか関係なく特定の値へ戻す」処理が複数
埋め込まれていたのが原因。**「完了時クリーンアップ」処理を書くときは
「ユーザーが操作前に設定していた状態を尊重し、明示的に指定されていない限り
上書きしない」を原則にする。** 同種のクリーンアップ処理を追加する際は、
この2件をリファレンスとして「これもユーザー設定を勝手に上書きしていないか」
を確認すること。

関連PR: [#1196](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/1196)(自動回転)、[#1195](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/1195)(ズーム)
