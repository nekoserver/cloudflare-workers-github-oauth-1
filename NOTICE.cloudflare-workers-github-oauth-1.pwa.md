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

**対処**: 同一オリジン・相対パスのページ遷移である限り、standalone表示自体は上記1のmetaタグだけで維持できるため、**Web App Manifestは無くても良い**。ページ固有のPWAとしてホーム画面に追加したいだけなら、共有の`manifest.json`にはlinkせず、metaタグのみを置く。複数アプリで別々のmanifestを持たせたい場合は、アプリごとに別ファイル(例: `/manifest-workflow.json`)を用意すること。

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

## 4. 調査の順番

「PWAで画面上部に妙な表示が出る」系の不具合を調べるときは、この順で確認すると早い。

1. 遷移先ページに`apple-mobile-web-app-capable`等のmetaタグ一式があるか(→ 1)
2. `<link rel="manifest">`が正しいアプリのmanifestを指しているか、無関係なページから共有していないか(→ 2)
3. metaタグ・manifestが正しくても発生するなら、リンクがフルページ遷移になっていないか(→ 3)。SPA的な差し替え遷移になっているかを確認する。
