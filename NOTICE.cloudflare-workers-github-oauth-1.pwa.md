# NOTICE: PWA(ホーム画面追加・standalone表示)実装まとめ

**対象**: このリポジトリでPWA(ホーム画面に追加してアプリのように起動するページ)を実装・修正する際の知見・落とし穴。`/workflow` ページのアドレスバー表示不具合を調査・修正した際に得た。今後同様のPWA対応ページを追加・修正するときに最初に読むこと。

---

## 1. standalone表示(アドレスバー非表示)はページ単位のmetaタグで決まる。Web App Manifestではない

iOSのSafari/ホーム画面PWAは、Web App Manifest(`manifest.json`)の`display`/`scope`ではなく、**各ページに置かれた以下のmetaタグ**を見てstandalone表示(アドレスバー非表示)を維持するかどうかを判定する。

```html
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ページ名">
```

これらのタグが**遷移先のページに無い**と、そのページへ移動した瞬間にiOSが「アプリのスコープ外」と判定し、アドレスバー付きの通常タブとして開き直してしまう。

**同一サイト内でPWA対応ページを増やす場合は、遷移経路上の全ページにこのタグ一式を置くこと。** 1ページだけ対応しても、そこからリンクした先のページに無ければそこでアドレスバーが表示される。

## 2. `<link rel="manifest">` は「そのページ専用のPWA定義」を上書きする。安易に共有しない

`public/manifest.json` は特定のアプリ(例: `name: "WebGL 地球儀"`, `start_url: "/webgl-sphere"`)専用に作られている。この1つの`manifest.json`を複数の無関係なページから`<link rel="manifest">`で参照してしまうと、**ホーム画面に追加した際のアイコン・アプリ名・起動先URLが、参照したmanifestの内容(＝別アプリのもの)に上書きされてしまう**。

実際に起きた事故: `/workflow`ページに`<link rel="manifest" href="/manifest.json">`を追加したところ、`/workflow`をホーム画面に追加すると「WebGL 地球儀」という名前・アイコンになり、起動すると`/webgl-sphere`が開いてしまった。

**対処**: 共有の`manifest.json`にはlinkせず、**アプリごとに専用のmanifestファイル**(例: `/manifest-workflow.json`)を用意してlinkすること。

> 補足(訂正): 当初この節では「同一オリジン・相対パスの遷移ならmetaタグだけでよくWeb App Manifestは不要」と書いていたが、これは**iOS Safariでは概ね正しいが、Chromium系ブラウザ(Android Chrome等)では不十分**だった。Chromium系はmetaタグではなくWeb App Manifest(name/icons/start_url/display)と後述のService Workerの有無で「真にインストール可能なPWAかどうか」を判定しており、manifestが無い(または共有manifestを消しただけで専用manifestを用意しなかった)状態だと、ホーム画面追加がstandalone表示ではなく**アドレスバー付きの簡易ショートカット表示**にフォールバックしてしまう。詳細は5節を参照。

## 3. metaタグを揃えてもアドレスバーが再表示されることがある。真因は「フルページ遷移」

上記1・2の対応をしても、PWA内のリンクをクリックした瞬間だけアドレスバーが一瞬表示される場合がある。これはmetaタグの問題ではなく、**通常の`<a href>`によるページ遷移が毎回「新規ページロード」として扱われるため**、iOSがそのタイミングでナビゲーション用のUI(アドレスバー)を表示する挙動によるもの。同一オリジン・相対パスであっても、フルページ遷移である限り発生し得る。

**対処**: リンククリックを`e.preventDefault()`し、`fetch()`で必要なデータ(またはHTML断片)を取得して**DOMを直接差し替え**、`history.pushState()`でURLだけを更新する、SPA的な遷移に変更する。フルページロードが起きなくなるため、アドレスバーの再表示も起きなくなる。

実装パターン(`/workflow`ページ・`src/views/workflow.ts`参照):

```js
link.addEventListener('click', function(e) {
  e.preventDefault();
  fetch('/api/workflow/' + no, { credentials: 'same-origin' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      document.getElementById('wfMain').innerHTML = renderDetail(data.workflow, data.steps);
      history.pushState({ no: no }, '', '/workflow/' + no);
    });
});
window.addEventListener('popstate', function() {
  // location.pathname を見て再描画(戻る/進むボタン対応)
});
```

- サーバー側のレンダリング関数(例: `renderSteps`)と同等のロジックをクライアント側JSにも用意する必要がある(TSの関数はそのままブラウザに渡せないため、埋め込みスクリプト内にプレーンJSで再実装する)。
- `<a href="...">` 自体は残しておく(JS無効時・右クリックで新規タブを開く場合のフォールバックとして機能する)。
- テンプレートリテラル内にこの手のクライアントJSを書く場合、CLAUDE.mdルール29(`\n`・`\'`・regexの`\`エスケープが二重に処理される問題)に必ず注意すること。可能なら`\d`等の正規表現を避け、`indexOf`/`slice`で代替すると安全。

## 5. Chromium系(Android Chrome等)は「専用のWeb App Manifest + Service Worker」が無いとstandalone表示にならない

`/workflow`ページの最終的な不具合(ホーム画面から起動すると上部にドメイン名とX・戻る・共有・更新等のアイコンが並ぶ帯が出る)の真因はこれだった。iOS向けに1・2節の対応(metaタグ + manifest省略)をしても、Chromium系ブラウザでは解消しなかった。

Chromium系がホーム画面追加時に**真にインストール可能なPWA**と判定してstandalone表示にするための最低条件:

1. **専用のWeb App Manifest**(`name`・`icons`・`start_url`・`display: "standalone"`・`scope`を持つ、そのアプリ専用の`.json`ファイル)への`<link rel="manifest">`
2. **Service Workerの登録**(`navigator.serviceWorker.register(...)`。`fetch`ハンドラを持つ最低限のものでよい)

どちらか片方でも欠けると、Chromiumは「インストール不可」と判断し、ホーム画面のショートカットは**アドレスバー相当の帯が付いた簡易ブラウザ表示**(Chrome Custom Tab風のUI: 閉じる・戻る・タブ一覧・ドメイン名・共有・更新・ブラウザで開く、のアイコン列)にフォールバックする。**これはiOSのアドレスバーとは見た目も原因もまったく別物**なので、スクリーンショット等で実際に何が表示されているか・どのOS/ブラウザかを先に確認してから調査すること(自己判断でOSを決め打ちしない)。

`/workflow`ページでの実装(`src/views/workflow.ts`・`public/manifest-workflow.json`・`public/sw-workflow.js`参照):

```html
<link rel="manifest" href="/manifest-workflow.json">
```

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-workflow.js', { scope: '/workflow' }).catch(function() {});
}
```

`manifest-workflow.json`は`start_url`と`scope`が同じプレフィックスになるようにする(例: `start_url: "/workflow"`, `scope: "/workflow"`。`scope`に末尾スラッシュを付けると`start_url`がプレフィックス不一致になるので付けない)。

## 6. 調査の順番(最終版) — 再発防止のため、最初から疑ってかかること

「PWAで画面上部に妙な表示が出る」系の不具合は、**原因がOS/ブラウザによって全く別物**なので、勝手に「これはiOSのアドレスバーの話だろう」「Android Chromeの話だろう」と決め打ちしない。必ず次の順で進めること。

1. **最初にユーザーへ確認する**: 実際に表示されているスクリーンショットを見る(または「何が表示されているか」を具体的に聞く)。時刻表示・バッテリーアイコンの形・ボタンの並び(X/戻る/共有/更新/タブ一覧の有無)から、iOS Safariの本物のアドレスバーなのか、Chromiumの簡易ショートカットUIなのかを判別してから対処方針を決める。**憶測でOS名を決めて修正提案しない**(誤ったOSを名指しして直接ユーザーを怒らせた実例あり)。
2. iOSの挙動を疑うなら: 遷移経路上の全ページに`apple-mobile-web-app-capable`等のmetaタグ一式があるか(→ 1節)。
3. Chromium系の挙動を疑うなら: そのページ専用のWeb App Manifestと、Service Workerの登録があるか(→ 5節)。`<link rel="manifest">`が無関係な共有manifestを指していないか(→ 2節)も併せて確認する。
4. 上記が全て揃っているのにフルページ遷移の瞬間だけ何か出るなら、リンクがSPA的な`fetch`+`history.pushState`遷移になっているか(→ 3節)。
5. コードを直しても直らない場合、**そもそもデプロイされているか**を疑う。このリポジトリはClaude Codeセッションから`wrangler deploy`できないため、PRをマージしただけでは本番に反映されない。ユーザー側で`git pull && wrangler deploy`を実行済みか、かつホーム画面のアイコンを一度削除して**キャッシュされたmanifest/Service Workerごと作り直しているか**を確認する。
