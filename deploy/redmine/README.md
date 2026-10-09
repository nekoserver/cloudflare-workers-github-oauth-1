# Worker → Apache HMAC → Redmine

ブラウザはログイン済みの本体Worker `/api/securemine/redmine` に通信します。WorkerがHMACを付与し、Apache上のPython 3 mod_wsgiゲートウェイが検証してから固定のRedmineバックエンドへ転送します。ブラウザ向けCORS設定は不要です。Redmine REST APIを有効にし、ユーザーのAPIキーで操作権限を判定します。

## Apache側

1. Python 3対応のmod_wsgiを導入します（Debian/Ubuntuの例：`sudo apt install libapache2-mod-wsgi-py3`）。
2. `gateway.wsgi` を `/opt/redmine-hmac/gateway.wsgi` に配置します。
3. `config.json.example` を `/etc/redmine-hmac.json` にコピーし、`secret` を十分にランダムな32文字以上の値へ置き換えます。`upstream` はApacheから接続可能なRedmineアプリの内部URLに設定します。サブディレクトリも含めて指定してください。公開HMACゲートウェイ自身を指定しないでください。
4. 設定ファイルはroot所有・www-dataグループ・0640にし、www-dataだけが書き込める `/var/lib/redmine-hmac` ディレクトリを作成します。OSに応じて実行ユーザー名を調整してください。nonce DBは複数プロセスで共有します。
5. `apache.conf.example` を既存のHTTPS VirtualHostに組み込みます。既存のcatch-all `ProxyPass` より前にゲートウェイの除外設定を置きます。`apachectl configtest` 後にApacheをreloadします。

専用パス `/redmine-hmac` は署名検証プログラムで保護されます。既存Redmineの通常Web画面に対する認証設定は別です。既存のBasic認証、IP制限、WAFがゲートウェイへの通信を先に拒否する場合は、この専用パスを署名検証プログラムに到達させるよう設定してください。

## mod_cgidを使う場合

mod_wsgiを追加せず、Apacheの既存mod_cgid/mod_cgiで同じ検証処理を実行できます。`gateway.wsgi` と `gateway.cgi` を `/opt/redmine-hmac` に配置し、`gateway.cgi` を実行可能（0755）にします。`apache-cgi.conf.example` をHTTPS VirtualHostへ組み込みます。Passengerが有効な場合はこの専用Locationで `PassengerEnabled off` を設定してください。共有シークレットとnonce DBの設定はmod_wsgiの場合と同じです。

内部Redmine URLに自己署名証明書を使う場合は、設定JSONの `upstream_ca` に信頼する証明書ファイルのパスを追加します。証明書の検証は有効なままです。例えば、内部URL `https://127.0.0.1` に対して証明書SANに `127.0.0.1` が含まれている必要があります。

## Worker側

`wrangler.toml` の `[vars]` に公開Redmine URLとゲートウェイURLの対応を設定します（末尾スラッシュなし）。登録された接続先だけに署名を発行します。複数台は同じ形式で追加できます。この実装では各ゲートウェイに同じ専用HMACシークレットを設定します。

```toml
REDMINE_HMAC_TARGETS = '{"https://redmine.example.com/redmine":"https://redmine.example.com/redmine-hmac"}'
```

```sh
npx wrangler secret put REDMINE_HMAC_SECRET
npm run deploy:worker
```

`REDMINE_HMAC_TARGETS` をWorkerのシークレットとして登録することもできます。wrangler.tomlに同名の変数を定義せず、次を実行してJSONマップを入力してください。

```sh
npx wrangler secret put REDMINE_HMAC_TARGETS
```

Apacheの `secret` と同じ値を `REDMINE_HMAC_SECRET` に入力します。シークレットをリポジトリやブラウザには保存しません。SecureMine画面ではマップ左側の公開Redmine URLとユーザー本人のAPIキーを入力してください。APIキーはWorkerとApacheを経由しますが永続化しません。

## 署名プロトコル

`X-Redmine-Timestamp`（UNIX秒）、`X-Redmine-Nonce`（UUID）、`X-Redmine-Signature`（HMAC-SHA256、小文字hex）を付与します。署名対象は以下をLFで連結し、末尾LFなしのUTF-8バイト列です。

```
redmine-v1
HTTPメソッド
Redmine相対パス（クエリを含む）
時刻
nonce
APIキーのSHA256 hex
Content-TypeのSHA256 hex（GETは空文字のハッシュ）
本文のSHA256 hex
```

ゲートウェイURLの `path` パラメータから相対パスを復元します。60秒以上ずれた時刻、署名不一致、再使用nonce、許可外APIを拒否します。nonceは時刻+120秒まで保持します。サーバーの時刻を同期してください。リダイレクトを追跡せず、署名・APIキーを別ホストへ転送しません。アップロードとダウンロードは10MiBまでです。

## 検証

```sh
npx vitest run src/utils/redmineProxy.test.ts src/views/securemine.test.ts
python3 -m unittest discover -s deploy/redmine -p 'test_*.py'
```

`users/current.json` のGETも許可し、APIキーのユーザーを接続時・同期時に確認します。ユーザー一覧や他ユーザーの取得・更新は許可しません。

実機では、ログイン後の一覧取得・課題作成・編集・添付を確認してください。ゲートウェイへの署名なしのリクエストは403になり、同じ署名付きリクエストの再送も403になる必要があります。503はWorkerの未設定、403は接続先未登録またはHMAC拒否、502はApache/Redmineへの接続やゲートウェイ設定の失敗を確認してください。

Apache設定参考：https://www.modwsgi.org/en/master/configuration-directives/WSGIScriptAlias.html
