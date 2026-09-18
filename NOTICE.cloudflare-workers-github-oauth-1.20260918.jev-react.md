# NOTICE — /jev-score-board(本体Worker)→ /jev-scores(dynamicneko React 19)移植の知見

日付: 2026-09-18

対象: `nekoserver/cloudflare-workers-github-oauth-1` の `/jev-score-board`
(素のHTML + `<script>` + `textContent`操作)と、`nekoserver/dynamicneko` の
`/jev-scores`(React 19移植版)。関連PR:
[#1886〜#1890](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pulls?q=jev-score-board)(本体Worker側の元ページ)、
[#1891](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/1891)(dynamicneko向け`-external`エンドポイント新設)、
[#1892](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/1892)(本体側th表記トグルのCookie化)、
`nekoserver/dynamicneko`側は
[#194](https://github.com/nekoserver/dynamicneko/pull/194)(React 19移植本体)、
[#195](https://github.com/nekoserver/dynamicneko/pull/195)(StylePicker追加)、
[#196](https://github.com/nekoserver/dynamicneko/pull/196)(テーブル本体等へのテーマ反映修正)、
[#197](https://github.com/nekoserver/dynamicneko/pull/197)(StylePickerのenhanced化)、
[#198](https://github.com/nekoserver/dynamicneko/pull/198)(th表記トグルのCookie化)。

---

## 1. innerHTML廃止の要求は「機械的テストで縛る」形で満たした

### 背景

ユーザーからの当初の指示は「dynamicneko上の適切な名前でInnerHTMLを廃した
React19バージョンとして移植してほしい」。本体Worker側の元実装
(`src/views/jevScoreBoard.ts`)は素のHTML文字列 + `<script>`タグ内で
`document.getElementById`・`textContent`代入・`addEventListener`による
DOM操作を行っている(この実装自体は今回も維持し、手を入れていない。
`innerHTML`代入は元々使っていなかったが、`textContent`直書きのDOM操作
スタイルそのものがReact的ではない、というのが移植理由)。

### dynamicneko版(`src/components/jev-score-board-page.tsx`)での対応

- 質問文・回答文のMarkdown描画は、文字列をHTMLに変換して
  `dangerouslySetInnerHTML`で流し込むのではなく、`MarkdownText`
  (`src/components/ask-ai-widget.tsx`)が独自トークナイザー
  (`markdown-lite.ts`)でMarkdownを解析し、**実際のReact要素
  (`<strong>`等)として**組み立てて返す実装を再利用した。
- テーブル・モーダル・th表記切替もすべて`useState`+JSXの条件分岐で
  実装しており、DOM文字列の直接差し替えは一切ない。

### 回帰防止の仕組み(重要)

「innerHTMLを使っていないこと」を口頭やレビューだけで保証すると、将来
誰か(Claude自身を含む)が「パフォーマンスのため」等の理由で
`dangerouslySetInnerHTML`を持ち込んでしまうリスクがある。そのため
`test/jev-score-board-page-no-inner-html.test.ts`という**ソースコードの
文字列そのものを検査するテスト**を用意し、`npm test`のチェーンに
組み込んで常時実行している:

```ts
assertEqual(source.includes("dangerouslySetInnerHTML"), false, ...);
assertEqual(/\.innerHTML\s*=/.test(source), false, ...);
```

このテストファイルは`fs`/`path`を使うが、リポジトリの`tsconfig.json`の
`types`が`["@cloudflare/workers-types", "vite/client"]`のみで
`@types/node`を含まないため、`declare const require: (id: string) => any;`
という未型付けのグローバル宣言を使ってCommonJSの`require`経由で
`fs`/`path`を読み込む、という局所的な割り切りをしている(このパターンは
同種の「ソースファイルを直接文字列検査するテスト」を今後追加するときの
テンプレートとして使える)。

**今後同種の移植・新規ページを作る際の教訓**: 「innerHTMLを使わない」
という非機能要求は、コードレビューの努力目標にせず、このように
grepベースのアサーションで機械的に縛っておくと安全。

---

## 2. kumoコンポーネントとCSSスタイル選択(StylePicker)の混在パターン

### 現象として実際に起きた不具合

PR #195でStylePickerを追加した際、選んだテーマがページ背景・ヘッダーには
反映されたが、**テーブル本体・検索入力欄・モーダル・th表記切替ボタンには
反映されない**という報告(ユーザー: 「表にどうてきにかえたすたいるが
あたらないんだけどもこれは限界？」)があった。

### 原因と対処(PR #196)

`@cloudflare/kumo`の`<Text>`/`<Badge>`/`<Button>`等は**意図的に色の
上書きを拒む設計**(`DANGEROUS_className`経由でしか色を変えられない)。
これはこのリポジトリの既存規約で、`AiCachePage`・`tree-view-page.tsx`でも
同じ方針: kumoコンポーネントはkumo自身のライト/ダークトークンのまま
(`ModeToggle`に追従)にしておき、`PAGE_THEMES`(`code-snippet-styles.tsx`)
由来のCSSスタイル選択(`snippet_style`Cookie)は**プレーンなHTML要素
(`<div>`, `<table>`, `<input>`, `<button>`等)にだけ**適用する、という
「地の配色はtheme、kumo部品はkumoトークン」の混在パターンが確立している。

今回の不具合は「新規に追加したテーブル・入力欄・モーダルがすべてkumoの
固定トークン(`bg-kumo-base`等)のままだった」という**適用漏れ**で、
「限界」ではなく単純な実装の抜けだった。テーマシステム自体を疑う前に、
まず「どの要素にthemeクラスが付いているか」をコンポーネント内で
grepするのが早い。

新しいページに`StylePicker`を組み込むときのチェックリスト:
- ページ背景・ヘッダーだけでなく、**テーブル・入力欄・ボタン・モーダルの
  背景色/文字色/枠線色**すべてに`theme.xxx`を適用したか
- 本文の文字色は`getSnippetStyleTextClass(snippetStyle)`を使ったか
  (黒背景に薄暗い文字になる、というこのリポジトリで繰り返し発生している
  既知の落とし穴)
- kumoの`<Text>`/`<Badge>`はtheme適用の対象外でよい(むしろ対象にしない)

---

## 3. StylePickerの`enhanced`モードは「全件」ではなく「手厳選サブセット」

`enhanced=true`(`/ai-panel`が最多選択肢のページ)を渡すと、色テーマ
(`SNIPPET_STYLES`、15件)に加えて画面全体CSSフィルター
(`CSS100_EFFECTS`由来、`(画面全体)`表記)も選べるようになるが、
**`CSS100_EFFECTS`の全件がそのまま選択肢になるわけではない**。
`buildStylePickerItems(includeCss100)`(`style-picker.tsx`)は色系統
(`glass`, `mono`, `rounded`, `tracking`, `crosshair`, `sepia`,
`blueprint`, `crt`, `neon-text`, `selection`, `grayscale`, `invert`,
`blur`, `hue-rotate`)ごとに**手動で厳選した14件**だけをfxとして混ぜ込む
実装になっている。`SNIPPET_STYLES.length + CSS100_EFFECTS.length`のような
単純な合計値でテストを書くと**必ず失敗する**(実測: 15+29件中29件が
enhanced時の総数で、`CSS100_EFFECTS.length`はもっと大きい)。この種の
「手厳選サブセット」を検証するテストは、正確な合計値ではなく
`options.length > SNIPPET_STYLES.length`のような不等式と、
`"(画面全体)"`のようなラベルの部分一致存在確認にとどめるべき。

### `StylePickerModal`(見た目重視UI)は二段階で開く

`StylePicker`には`uiMode`(`"select"` | `"modal"`、`style_picker_ui`
Cookie)という表示方式の切替と、`StylePickerModal`コンポーネント自身が
持つ**内部の`open`state**という、**独立した2つの状態**がある。
テストやユーザー操作で3列グリッド(`<ul class="...grid grid-cols-3...">`)
を開くには:

1. `aria-label="モーダル表示にする"`ボタンを押して`uiMode`を
   `"select"→"modal"`にする(まだグリッドは出ない。現在の色テーマ名
   ラベル、例えば「Terminal」というトリガーボタンが出るだけ)
2. そのトリガーボタン(現在の`snippetStyle`のラベル文字列)を押して
   `StylePickerModal`内部の`open`を`true`にする(ここでようやく
   `grid-cols-3`のグリッドが描画される)

1回のクリックだけでグリッドを開こうとする実装・テストは失敗する
(このセッションで実際に2回失敗した: Cookie事前設定でのバイパスは
vitest-browserのテストページ内でCookie書き込みが効かず失敗、
mode-toggleクリックのみでも「トリガーボタンをまだ押していない」ため
`null`になった)。なお**グリッド自体は既に3列実装済み**であり、
「選択肢を1番多いページに合わせて増やす」という要望は`enhanced`props
渡し忘れが原因で、レイアウト変更は不要だった。

---

## 4. th表記切替(現行/日本語)のCookie永続化とデフォルト日本語化(2026-09-18対応)

「dynamicneko#197と本体の元ページのトグル状態もCookieに保存し
デフォルトを日本語にしておいてください」という要望を受け、両ページで
同じCookie名`jev_score_board_th_mode`(値: `"current"` | `"japanese"`、
`path=/`、1年保持)を使って状態を永続化した。

- **本体Worker版**(`src/views/jevScoreBoard.ts`、`<script>`内プレーンJS):
  `readThModeCookie`/`writeThModeCookie`を追加し、ページ読み込み時に
  `setThMode(readThModeCookie() || 'japanese')`を呼ぶことで初期状態を
  復元する。静的HTML側の`class="th-mode-btn active"`(現行ボタン)は
  そのまま残している(既存テストがこの静的マークアップを固定文字列で
  検証しているため)。実際の見た目はJS実行時に`setThMode`が
  `classList.toggle`で上書きするので、静的マークアップと実際の初期状態が
  食い違っても問題ない。
- **dynamicneko版**(`src/components/jev-score-board-page.tsx`):
  `useState<ThMode>(() => readThModeCookie() ?? "japanese")`で初期化。
  ただし「日本語への初回切替時だけlabel-namesを取得する」という既存の
  キャッシュ方針があったため、**デフォルトが既に「日本語」の場合、
  ボタンをクリックしなくても初回マウント時に一度だけ取得する**よう、
  取得ロジックを`fetchLabelNamesIfNeeded`として切り出し、
  `useEffect(() => { if (thMode === "japanese") fetchLabelNamesIfNeeded(); }, [])`
  をマウント時に1回だけ走らせる形にした。単に`setThMode`の初期値だけ
  変えて満足すると、「日本語がデフォルトなのにL1〜L20のまま表示される
  (ラベル名が読み込まれていない)」という抜け漏れになるので注意。

### テスト手法の違い(2つのリポジトリで異なるアプローチを取った)

- 本体Worker版: `jsdom`の`JSDOM(html, { runScripts: 'outside-only' })`で
  実HTMLを読み込み、埋め込み`<script>`を`window.eval`で実際に実行させて
  `document.cookie`・`classList`を検証する(`heritage-accordion-cache-badge-behavior.test.ts`
  等、このリポジトリで既に確立しているパターンを流用)。
- dynamicneko版: `vitest-browser-react`の実ブラウザ(Chromium)テストで
  実際にクリックして`document.cookie`を確認する。
  **Cookieはテスト間で残留する**ため、`afterEach`で明示的に
  `document.cookie = "jev_score_board_th_mode=; path=/; max-age=0"`を
  クリアしないと後続テストに影響が漏れる(実際に一度、`cleanup()`を
  テスト内で手動呼び出しして同一テスト内で再`render()`する形を試したが、
  「overlapping act() calls」エラーで後続テストまで軒並み失敗した。
  `vitest-browser-react`の`render()`はテスト境界を跨いだ手動`cleanup()`
  との相性が悪く、**Cookie状態を変えて挙動を見たい場合は
  「別のtest()に分けてCookieを事前セットしてからrenderする」**方が安全)。

---

## 5. 自動マージ環境でのPR運用(このセッションで毎回発生した定型作業)

このセッション中、両リポジトリとも作成したPRが**ほぼ即座に外部プロセスで
自動マージ**されていた(`merged: true`が数分以内に確認できる)。そのため
「同じブランチに追加コミットをpushする」という素朴なやり方は使えず、
毎回以下の手順を踏んだ:

1. コミット後、pushする前に`pull_request_read`(method: get)で対象PRの
   `merged`/`state`を確認
2. マージ済みなら`git fetch origin main && git checkout -B <新ブランチ名> origin/main`
3. `git cherry-pick <未マージのコミットSHA>`で該当コミットだけ移植
4. 型チェック・ビルド・テストを**再ブランチ後にもう一度**通す
   (baseが更新されているため、想定外の衝突がないか再確認する意味もある)
5. `git push -u origin <新ブランチ名>`
6. `create_pull_request`で新規のdraft PRを作成し、本文に
   「マージ済みの#XXXのフォローアップ」であることを明記

このリポジトリ群で新規に変更を積む際は、**最初から「1回のpushで
終わらない」前提**でタスクを組むと手戻りが少ない。
