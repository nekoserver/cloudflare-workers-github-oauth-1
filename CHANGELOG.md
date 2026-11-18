# CHANGELOG

## 2026-11-06

### T3 Code 0.1.3 → 0.1.7

コンテナのT3 Codeを0.1.7に上げた。イメージのビルドと実コンテナへの反映は未実施で、稼働中のコンテナは0.1.3のまま。

**このリポジトリの修正**

- `containers/demo/Dockerfile`: `T3_VERSION`を0.1.7にした。
- `containers/demo/server.js`、`containers/demo/t3-pwa-auth.cjs`、`scripts/check-t3-pwa-browser.cjs`: T3本体のパスに版が含まれるため、`/root/.t3/runtime/versions/0.1.7/t3`へ変えた。変えないと、ワンクリックペアリング、tree-view用セッション、PWA認証が本体を起動できない。
- `src/cf-containers-t3-contract.test.ts`: `CONTRACT_VERIFIED_VERSION`を0.1.7にした。画面の契約の根拠は、圧縮後の関数名からソースの名前(`takePairingTokenFromUrl`、`waitForAuthenticatedSessionAfterBootstrap`)へ書き換えた。
- 関連のテストとコメント: 版の表記と、エラーの対処文の版を0.1.7にした。

**契約の確認**

公式リリースの`t3-0.1.7-linux-x64.tar.gz`(SHA256SUMSと照合)と、タグ`v0.1.7`(`322f6544`)のソースで確かめた。0.1.3と0.1.7を別のポートと状態ディレクトリで起動し、応答も比べた。

| 確認した項目 | 結果 |
| --- | --- |
| 匿名の`/api/auth/session`が200の`authenticated:false`を返す | 変更なし |
| 認証付きAPIが匿名で401を返す(`/api/projects`など) | 変更なし |
| クッキーの優先と重複時の扱い、Bearer | 変更なし |
| クッキー名`t3_session_<port>_<hash>` | 変更なし |
| `POST /api/auth/pairing-token`と資格情報の有効期限5分 | 変更なし |
| `X-Forwarded-Host`によるOriginの判定 | 変更なし |
| `t3 auth pairing create`と`t3 auth session issue`の引数とJSONの項目 | 変更なし |
| `client/index.html`のscriptタグの形(`injectBootstrap`の対象) | 変更なし |
| npmの起動プログラムが展開する先(`~/.t3/runtime/versions/<版>/t3`) | 変更なし |

画面側の項目(`#token=`の自動ペアリング、認証待ちの2秒)はソースだけで確かめた。

**上流で変わった点**

- `GET /api/auth/clients`が無くなった。0.1.7では、存在しないパスと同じく画面のHTMLが200で返る。認証が緩んだわけではなく、このリポジトリも使っていない。
- 0.1.4〜0.1.7の主な追加: サイドチャット(0.1.6)、Kiro(0.1.7、ベータ)、管理ポリシー(0.1.7)、1回限りのスケジュール(0.1.7)。
- 運用に関わる修正: ゲストリンクがファイルの差分を返さない(0.1.5)、接続チケットとOAuthの資格情報をトレースに残さない(0.1.6)、スレッドの削除で共有のworktreeを消さない(0.1.6)。

**未確認**

- 実イメージでのT3の起動と、ブラウザからのPWA・ペアリング。
- 0.1.3の`~/.t3`の状態を0.1.7で読むこと。`~/.t3`はコンテナの作り直しで消えるため、新しいイメージでは問題にならない想定。
- 実ブラウザのテスト(`src/cf-containers-t3-pwa-diagnose-browser.test.ts`)。この環境にChromiumが無く、変更前から失敗する。

**退避物**

`t3-0.1.7-linux-x64.tar.gz`は123.7MBで、GitHubの1ファイルの上限100MBを超えるためリポジトリに入れていない。Dockerfileは従来どおり、ビルド時にnpmの起動プログラムで本体を取得する。

### git 2.53.0 → 2.56.0

- APTの`git`をやめ、kernel.orgのソースからビルドして`containers/demo/packages/`に退避したパッケージを使うようにした。手順は同じ場所の`README.md`に書いた。
- `/health`のバージョン表で、gitを固定した版と比べるようにした(`/etc/image-versions.json`の`git`)。
- APTの`git`が持ち込んでいた`perl`と実行時の共有ライブラリを明示した。bash補完とmanページは入らなくなる。

### OpenSSH 10.2p1 → 10.6p2

- APTの版は`1:10.2p1-2ubuntu3.8`で、Ubuntuの最新のまま上流より古い。OpenBSDの公式ソースをPGP署名とSHA256で確かめてビルドし、`containers/demo/packages/`に退避した。
- `/usr/local`に重ねて入れる。APTの`openssh-server`は、`/etc/ssh`、PAMの設定、`sshd`ユーザーのために残す。
- `entrypoint.sh`は`/usr/local/sbin/sshd`があれば使う。`Dockerfile.redmine`も同じファイルを使い、そちらはAPTの`sshd`のまま。
- このビルドはGSSAPIなしのため、`ssh_config`のGSSAPIの行を消し、sftpは新しい`sftp-server`を使う。
- Ubuntuの独自パッチは含まない。以後のセキュリティ更新は、`/cf-containers`の上流版を見て、手でビルドし直す。

- sshのホスト秘密鍵がイメージに焼き込まれていた(コメントが`root@buildkitsandbox`)。Dockerfileで消し、起動時に用意するようにした。
- `SSH_HOST_ED25519_KEY_B64`があれば、作り直しても同じホスト鍵を使う。`SSH_AUTHORIZED_KEYS`で公開鍵を足せる。どちらも`/cf-containers`のsecret設定から入れる。
- `sshd-hardening.conf`を追加した。公開鍵のみ、ホスト鍵はed25519のみ、`MaxAuthTries 3`、`LoginGraceTime 30`、X11転送なしなど。

別ポートで実物を起動し、公開鍵認証、PTY、sftp、scpを確かめた。イメージのビルドと配備は未実施で、稼働中のsshdは10.2p1のまま。

### /cf-containers

- バージョン表に`kernel`、`glibc`、`go`を足した。Goはイメージに無いため、無ければNGではなく「未導入」と出す。
- APTの表に`curl`を足した。比べる先はUbuntuの最新版。
- `git`と`openssh`を、イメージで固定した版と比べるようにした。

## 2026-03-28

- ジョブキューからのビルド通知をSlackに送る設定を行ったのでその関係のテストコミット
