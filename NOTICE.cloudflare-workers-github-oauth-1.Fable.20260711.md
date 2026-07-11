# NOTICE — 空港深リンク不具合の原因分析（Sonnet実装 vs Fable修正）

**対象**: 世界遺産ページ `/webgl-heritage?airport=<空港コード>` の深リンク機能
（`src/views/webglHeritage.ts` 内 `setupAirportRoutes()` の深リンク処理）。
heritage-access ページの空港ランキングモーダルから空港コードリンクで遷移した際に、
カメラが空港座標へ移動しツールチップを表示する機能が **4回の修正を経ても動かなかった**
原因と、最終的にどう解決したか・最初からどう解決すべきだったかの記録。

---

## 1. 時系列（何が起きたか）

| # | コミット | 実装内容 | 結果 |
|---|---|---|---|
| 1 | [`96d08bf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/96d08bf) | 深リンク初期実装。IIFE をスクリプト最後尾（`setupAirportRoutes()` の外側）に設置 | **動かない**（ReferenceError で無反応） |
| 2 | [`e583cfd`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/e583cfd) | `setAirportMarkers(true)` を追加（マーカー非表示によるツールチップ早期return対策） | **動かない**（そもそも #1 のスコープ外で実行されないため、この修正も実行されない） |
| 3 | [`a7bb812`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/a7bb812) | 深リンク IIFE を `setupAirportRoutes()` の内側へ移動（スコープ修正） | 半分動く。ただし `zoom = 10`（最大ズーム**アウト**）＋ FLY_DUR ホイスティングバグが残存 |
| 4 | [`bd0fa60`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/bd0fa60) | `zoom = 10` → `zoom = 1.2`（ズーム方向の意味の取り違えを修正） | ズームは正しくなったが「スクロールもツールチップも出ない」は継続 |
| 5 | [`4099da9`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4099da9) | FLY_DUR 未代入による `setTimeout(fn, NaN)` を実ブラウザ計測で特定し、`setTimeout(fn, 0)` で1マクロタスク遅延 | 動くようになった（ただし2.5秒の飛行待ちあり） |
| 6 | [`7da92ff`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/7da92ff) | 深リンクは初期表示なので飛行アニメーション自体を省略し即着地に設計変更 | **解決**（ツールチップ表示: スクリプト完了+約2.6秒 → +14ms） |

---

## 2. 原因は何だったのか（バグは1つではなく4つの複合）

### 原因A: スコープ違反（最初の「まったく動かない」の正体）

`aptByCode` / `flyToAirport` / `setAirportMarkers` / `showAptTooltip` はすべて
`setupAirportRoutes()` の**関数ローカル変数**。深リンク IIFE をスクリプト最後尾
（関数の外側）に置いたため、実行時に ReferenceError となり、uncaught エラーは
コンソールにしか出ないので**画面上は「何も起きない」**という最悪の症状になった。

### 原因B: ドメイン変数の意味の取り違え（`zoom = 10`）

このページの `zoom` は**カメラ距離**（`trans(view, 0, 0, -zoom)`）であり、
値が**小さいほど拡大**。ホイール／ボックスズームは `Math.max(1.2, Math.min(10, ...))`
でクランプされ、`1.2` が最大ズームイン・`10` が最大ズームアウト。
「最大ズーム」の指示に対し `zoom = 10` と書いたのは真逆だった。
さらに悪いことに、**回帰テストが `expect(block).toContain('zoom = 10')` とバグを
そのまま固定**しており、テストがバグの正当化装置になっていた。

### 原因C: var ホイスティングによる `setTimeout(fn, NaN)`（「ズームは効くのに何も起きない」の正体）

`flyToAirport` 内部の `setTimeout(fn, FLY_DUR + 100)` が参照する `FLY_DUR` は
`setupAirportRoutes()` **呼び出し行より後方**で `var FLY_DUR = 2500;` と宣言されている。
深リンク処理を `setupAirportRoutes()` 呼び出し中に**同期実行**していたため、
ホイスティングにより `FLY_DUR` は `undefined`、`undefined + 100 = NaN`、
`setTimeout(fn, NaN)` は**即座に発火**する。結果、カメラが1ミリも動かないうちに
`showAptTooltip` が呼ばれ、マーカー未描画で早期 return → 何も表示されない。
JS はここで一切エラーを出さない（NaN delay は仕様上有効）ため、静的解析では見えない。

### 原因D: 設計の問題（そもそも2.5秒の飛行が不要）

深リンクは**ページの初期表示**であり「出発地点」が存在しない。どこかから飛んでいく
2.5秒（FLY_DUR）の演出は、既に地球儀を見ているユーザーの巡回操作には意味があるが、
URL を開いた直後のユーザーには**純粋な待ち時間**でしかなかった。

---

## 3. Sonnet実装とFable修正の決定的な違い

| 観点 | Sonnet側の進め方（#1〜#3） | Fable側の進め方（#4〜#6） |
|---|---|---|
| 検証方法 | ソーステキストの静的確認と「ソースに文字列が含まれるか」テストのみ | ローカル `wrangler dev` + Playwright（実Chromium）で実際にページを開いて挙動を観測 |
| 原因特定 | 「おそらく〜だろう」で修正に着手（マーカー非表示説→スコープ説） | `window.setTimeout` をフックして**実際に渡された delay 値（NaN）を計測**で確定 |
| テストの質 | `zoom = 10` を含むか等、**書いたコードをそのまま追認する**文字列テスト | 修正前に落ち修正後に通ることを git stash で確認＋実測値（表示までのms）で裏取り |
| 変数の理解 | `zoom` の意味（距離か倍率か）を周辺コードで確認せず使用 | クランプ範囲・`trans()` での使われ方から意味を確認してから修正 |
| 設計への疑問 | 既存の `flyToAirport` をそのまま流用 | 「深リンクに飛行演出は必要か？」を問い直し、即着地に変更 |

要するに、**コードを書く能力の差ではなく「動かして確かめたかどうか」の差**。
原因A〜Cはどれも、一度でも実ブラウザで開いてコンソールと実測値を見ていれば
その場で発見できた（Aは ReferenceError がコンソールに出る、Cは delay=NaN が計測で出る）。

---

## 4. どう解決すべきだったか（最初からやるべきだった手順）

1. **書く前**: `zoom` / `FLY_DUR` / `flyTo` を使う前に、宣言位置・クランプ範囲・
   使われ方（`trans(view,0,0,-zoom)`）を読んで意味を確定する。
   特にこのファイルは4400行超の単一 template literal で、`var` 宣言が
   関数呼び出しより後方にあるパターンが多く、**同期実行タイミングでは
   外側スコープの var が未代入**という罠が構造的に存在する。
2. **設計時**: 「深リンク＝初期表示」なのだから、出発地点のない飛行アニメーションは
   不要と最初に判断すべきだった。既存関数（`flyToAirport`）の流用が
   常に正しいとは限らない。
3. **書いた後・push前**: ローカルで `wrangler dev` を起動し、
   Playwright（`executablePath: '/opt/pw-browsers/chromium'`）で実際に
   `?airport=NRT` を開き、(a) コンソールエラーゼロ、(b) ツールチップ表示、
   (c) 表示までの実測時間、の3点を確認してから push する。
   認証は `.dev.vars` の `JWT_SECRET` で JWT をローカル発行すれば OAuth 不要。
4. **テストを書くとき**: 「ソースに文字列Xが含まれる」型のテストは
   **実装をそのまま追認するだけでバグを固定しうる**。書く場合でも
   (a) 修正前のコードで落ちることを git stash で確認する、
   (b) 期待値の根拠（なぜ 1.2 なのか）をコメントで残す、を必須にする。

---

## 5. 教訓（このリポジトリで再発しやすい罠）

- **`webglHeritage.ts` の外側スコープ `var` は宣言位置より前の同期実行では未代入**。
  関数ローカルに閉じていないコードを追加するときは、実行タイミングが
  「同期スクリプト完了後」になるよう `setTimeout(fn, 0)` 等で遅延するのが安全。
- **`setTimeout(fn, NaN)` はエラーにならず即発火する**。時間系の変数を使う
  コールバック連鎖は、実ブラウザで delay 実測しない限り壊れていても気づけない。
- **`zoom` は倍率ではなくカメラ距離**（小＝拡大、範囲 1.2〜10）。
- **uncaught ReferenceError は画面上「無反応」に見える**。「何も起きない」系の
  バグ報告を受けたら、コード推理より先に実ブラウザでコンソールを見る。
- **バグを固定するテストは無いより悪い**。テストは「期待挙動」から書き、
  実装から逆算して書かない。
