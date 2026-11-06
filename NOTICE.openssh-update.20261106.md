# NOTICE — OpenSSH・sshdを更新するときの注意

作成日: 2026-11-06

**対象**: `containers/demo`のOpenSSH（`packages/openssh-*`、`sshd-hardening.conf`、`entrypoint.sh`、Dockerfile） — 10.2p1から10.6p2への更新で見つかった問題を、次の更新で繰り返さないためにまとめる。

守るルールは[SSHのセキュリティポリシー](POLICY.cloudflare-workers-github-oauth-1.security-ssh.20261106.md)に書く。

## 更新前に読むこと

- **稼働中のsshdを入れ替えない**: 2222番のsshdは作業中のセッションにも使われている。設定を誤ると締め出される。別ポートで確かめてからイメージで反映する。
- **`entrypoint.sh`は`Dockerfile.redmine`と共有している**: `/usr/local/sbin/sshd`が無ければ`/usr/sbin/sshd`を使う分岐を消さない。消すとRedmineのsshdが起動しなくなる。
- **更新できる版は2種類ある**: `/cf-containers`のAPTの表はUbuntuの最新、バージョン表の新版バッジは上流の最新を見る。2026-11-06の時点でAPTは`1:10.2p1-2ubuntu3.8`で最新、上流は10.6p2だった。

## 見つかった問題と対処

| 問題 | 起きること | 対処 | 次回の確認 |
| --- | --- | --- | --- |
| ホスト秘密鍵がイメージに入っていた | aptの`openssh-server`がビルド時に鍵を作る（コメントが`root@buildkitsandbox`）。イメージを読める人が秘密鍵を取り出せ、ビルドのたびに鍵が変わる | Dockerfileで`rm -f /etc/ssh/ssh_host_*`を、aptの導入より後に実行する | `/etc/ssh`に鍵が無いまま焼かれていること |
| ビルドの確認が誤って失敗する | `ssh -G`は端末が無いと`Pseudo-terminal will not be allocated`をstderrへ出す。「stderrが空」の確認はDockerビルドで失敗する | `Unsupported option`だけを探す | 確認の手順を、端末の無い環境で試す |
| `ssh`の実行のたびに警告が出る | 自前ビルドはGSSAPIなしで、Ubuntuの`ssh_config`の`GSSAPIAuthentication yes`が`Unsupported option`になる | Dockerfileでその行を消す | `ssh_config`に新しい非対応の項目が増えていないか |
| `sftp-server`が古いまま | `sshd_config`がaptの`/usr/lib/openssh/sftp-server`を指す | Dockerfileのsedで`/usr/local/libexec/openssh/sftp-server`へ変える | sftpの接続 |
| 全員が締め出されるおそれ | トンネルとTailscaleの接続はどれも`127.0.0.1`から来る。sshdの`PerSourcePenalties`が1つの送信元として罰する | `PerSourcePenaltyExemptList`で除外する | 既定の罰則が変わっていないか |
| `/admin`で足した公開鍵が消える | `entrypoint.sh`は`authorized_keys`を毎回上書きする。2026-11-06の時点で、3行目の鍵はこのリポジトリに無く、持ち主も未確認 | 残す鍵は`SSH_AUTHORIZED_KEYS`へ入れる | 3行目の鍵の持ち主を確かめる |

## 自前ビルドの制約

- Ubuntuの独自パッチとセキュリティ更新は入らない。上流の修正を見て、手でビルドし直す。リリースノートによると、OpenSSHは当面リリースの頻度を上げる。
- GSSAPIとKerberosは無い。
- aptの`openssh-server`は残す。`/etc/ssh`、PAMの設定、`sshd`ユーザー、実行時の共有ライブラリがこれに依存する。
- パッケージはUbuntu 26.04のx86_64専用。

## 更新の手順

1. リリースノートの「Potentially-incompatible changes」と「Security」を読む。
2. ソースをPGP署名とSHA256で確かめる。署名の鍵は`7168B983815A5EEF59A4ADFD2A3F414E736060BA`。
3. `containers/demo/packages/README.md`の手順でビルドし、ソース、署名、パッケージを退避する。
4. `OPENSSH_VERSION`、`OPENSSH_PACKAGE_SHA256`、`SHA256SUMS`を更新する。
5. 別ポートで起動し、次を確かめる。
   - 公開鍵でログインでき、パスワードは拒否される
   - PTY、sftp、scpが動く
   - `ssh-keyscan`でed25519だけが提示される
   - `SSH_HOST_ED25519_KEY_B64`のホスト鍵が復元される
6. `src/cf-containers`のテストを実行する。
7. 新しいイメージを配備し、**今のセッションを切らずに別の接続でログインできること**を確かめる。

## ホスト鍵の引き継ぎ

イメージに入っていた鍵は漏えいしたものとして扱い、引き継がない。新しい鍵を作って`SSH_HOST_ED25519_KEY_B64`へ入れる。秘密鍵をログに出さないこと。

```sh
umask 077
ssh-keygen -t ed25519 -N '' -C nekoroot-host -f /tmp/nekoroot-host
base64 -w0 /tmp/nekoroot-host    # /cf-containersのsecret設定へ貼り付ける
shred -u /tmp/nekoroot-host
```

未設定なら起動のたびに新しい鍵になり、接続先の鍵が変わったという警告が毎回出る。

## 残っている課題

- `Dockerfile.redmine`のイメージには、同じ問題でホスト秘密鍵が入ったままで、`sshd-hardening.conf`も入っていない。
- 実際のDockerビルドは未実施。Dockerの無い環境で、手順の模擬と別ポートの起動だけを確かめた。
- `sshd -T`は確認の環境で何も出力しなかった。効果を接続で確かめたのは、公開鍵のみの認証とホスト鍵の種類だけ。`MaxAuthTries`などの個別の値は、新しいイメージで`sshd -T`を確かめる。
