# NOTICE 2026-08-31

## thread-timeline（縦線+丸のタイムライン/スレッド表現）の呼び出し方

**対象**: `src/utils/threadTimeline.ts`（`getThreadTimelineCSS()`/`renderThreadTimelineList()`）— 左に縦線、各項目に丸印(list-style:circle)を並べる「タイムライン／スレッド表示」のUIパターンを、どのページでも埋め込める共通CSSアセットとして提供する。

### 由来

姉妹リポジトリ`cf-auth`の`/wspace`フィード画面で、AI要約への自動診断レビュー（`ai_summary_reviews`テーブルの`reviewer_name='auto-diagnosis'`）をMarkdown箇条書きとして表示する際、`<ul class="thread">`（`border-left`で縦線を引く）の中に、Markdown由来の`<ul>`（`list-style:circle`）がネストする形で偶然できていた見た目。CSSだけで実現できているため、このリポジトリ側にも同じ視覚表現を移植した。

### 呼び名

「thread-timeline」と呼ぶ。今後「あの縦線+丸のタイムライン風表示にして」と言う代わりに **「thread-timelineで表示して」** と言えば、このスタイルを指しているものとして扱う。

### 呼び出し方

`getThemeCSS()`/`getCountdownWidgetCSS()`と同じ「CSSを関数で返し、埋め込みたいページの`<style>`内で呼び出す」方式。

```ts
import { getThreadTimelineCSS, renderThreadTimelineList } from '../utils/threadTimeline';
```

1. `<style>`内に `${getThreadTimelineCSS()}` を展開する。
2. 表示したい項目(すでにエスケープ・Markdown変換済みのHTML文字列の配列)を `renderThreadTimelineList(itemsHtml)` に渡すと、`<ul class="thread-timeline"><li>...</li>...</ul>` の形でHTML文字列が返る。それをテンプレートリテラル内に埋め込む。
3. 各`<li>`の中身自体にさらにMarkdownの箇条書き(`<ul>`/`<li>`)を含めると、縦線に沿って丸(○)が並ぶ見た目になる（このリポジトリの`getMarkdownParserScript()`の`parseMd()`が生成する`<ul>`/`<li>`はクラス無しの素のタグなので、そのまま`.thread-timeline ul`のCSSが効く）。

### 注意点

- `renderThreadTimelineList()`はエスケープ・Markdown変換を一切行わない純粋関数。渡す前に呼び出し元で`escapeHtml()`（`src/utils/html.ts`）や`parseMd()`相当の変換を済ませておくこと。
- 色は固定値ではなく`var(--border-color)`/`var(--text-secondary)`を使っているため、ダークモード側でも自動的に整合する（CLAUDE.CSS.mdの「固定色禁止」ルールに準拠）。
- 想定用途: AI要約・診断コメントの積み重ね表示のほか、リポジトリのコミット履歴を時系列に並べる派生表現などにも使える（まだどのページにも実際には配線していない、汎用アセットとしてのみ用意した状態）。
