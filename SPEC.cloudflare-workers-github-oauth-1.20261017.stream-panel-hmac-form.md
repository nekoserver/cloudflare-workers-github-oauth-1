# ストリームパネルのHMAC認証フォーム送信

## 不具合と修正

AIチャットのストリームパネルは、mygw/mynw の認証画面を sandbox 付き iframe に埋め込む。従来は `allow-forms` がなく、キー入力後にEnterまたはフォーム送信ボタンで認証すると、ブラウザが `Blocked form submission` として処理を止め、署名付きPOSTが認証サービスへ届かなかった。

iframe に `allow-forms` を追加する。本体WorkerにHMAC鍵を渡したり照合処理を移したりせず、既存の埋め込み側による署名とサービス側による照合を利用する。親の開始・停止操作、postMessageのOrigin/source検証、既存のsandbox制限は維持する。

## 故障シナリオと検出

- フォーム権限が消えると、Enter・送信ボタンとも認証POSTが届かない。DOMテストで権限セットを検査し、Chromiumで認証要求の到達を検証する。
- 不正なキーまで通る場合は認証成功と誤判定する。実ブラウザのWebCrypto署名を検証するテスト用サービスで、正しいキーの200と不正キーの401を確認する。
- 親子間ハンドシェイクが壊れると開始ボタンが有効にならない。既存DOMテストに加え、実ブラウザでも開始ボタンの有効化を確認する。

ブラウザテストは生成された本体パネルを使い、別Originの認証フォームとセッションAPIをPlaywrightのルートで再現する。署名はブラウザのWebCryptoで生成し、受信側はパス・時刻・本文ハッシュを含むHMACを検証する。実際の認証鍵、外部ホスト、LLMは使用しない。実ストリームの配信・observer・Cookieの永続化はこのテストの対象外。

## 再実行

Node.js 22.20以降とnpm依存関係を用意し、Chromiumをインストールする。

```sh
npx playwright install --with-deps chromium
npm run test:stream-auth:browser
npx vitest run
```

ブラウザテストはWebSocket/SSE選択時それぞれのEnter・送信ボタン操作で、正常鍵の成功と不正鍵の拒否を確認する。修正前は最初のEnter操作でフォーム拒否を検出し、認証要求が届かないため失敗する。

## テスト実行環境への対応

全体テスト中に既存のTypewriter検証で、固定390ms後の確認が描画完了より先に走り失敗した。検証対象は変えず、表示完了を待つ `vi.waitFor` とDOMの終了処理に置き換えた。重い画面テストには実行時の `--testTimeout=120000 --hookTimeout=120000` を指定し、リポジトリ共通のタイムアウト設定は変更しない。
