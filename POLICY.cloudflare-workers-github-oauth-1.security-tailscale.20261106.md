# セキュリティポリシー: Tailscale

作成日: 2026-11-06

**対象**: デモコンテナのtailscaled（`containers/demo/entrypoint.sh`、`tailscale-up.sh`）と、接続するtailnet — tailnetからコンテナへ何を許すかを決める。SSHのルールは[POLICY.cloudflare-workers-github-oauth-1.security-ssh.20261106.md](POLICY.cloudflare-workers-github-oauth-1.security-ssh.20261106.md)に書く。

## 2026-11-06の構成

| 項目 | 値 | 意味 |
| --- | --- | --- |
| 動作 | `--tun=userspace-networking` | TUNを使わない。nftablesはtailnetの通信を制御できない |
| 状態 | `--state=mem:` | 再起動で状態が消え、`TAILSCALE_AUTHKEY`で登録し直す |
| Tailscale SSH | 無効（`RunSSH: false`） | SSHは通常のsshdへ入る |
| DNS | `--accept-dns=false` | tailnetのDNSを使わない |
| タグ | なし | ノードは利用者のアカウントに属する |
| exitノード、経路の広告 | なし | tailnetの中継には使わない |
| ACL | 全許可（全送信元から全ポート） | tailnetの全端末がコンテナの全ポートへ届く |
| 参加している相手 | iPad 1台 | 2026-11-06の時点 |

## 守る点

**tailnetは信頼の境界の内側ではない。** 次の理由で、ACLがコンテナを守る唯一の制御になる。

- userspaceモードでは、受信した接続が`127.0.0.1`へ転送される。SSHの接続が`tailscaled`から`127.0.0.1:2222`へ入ることを確認した。
- そのため、`127.0.0.1`だけで待ち受けるサービスにも、tailnetから届くと考えて扱う。T3（3773、3774）、チャット（8091、8092）、cloudflaredのメトリクス（20241）が該当する。実際に別の端末から試してはいない。
- Tailscale経由の接続は、sshdとアプリには`127.0.0.1`からの接続に見える。送信元で信頼を判断してはならない。`/lib/api`のIP許可は`127.0.0.0/8`を通すため、tailnetの端末はこの許可の対象になる可能性がある。

## ルール

| ルール | 理由 | 状態 |
| --- | --- | --- |
| ACLで、コンテナへの接続を必要な端末とポートに絞る | 唯一の制御 | **未対応** |
| コンテナのノードにタグを付ける | 利用者の権限と分け、鍵の期限切れの影響を避ける | **未対応** |
| 認証キーはタグ付きのエフェメラル、期限付きにする | 再起動のたびに登録するので、古いノードを残さず、漏れたときの範囲を絞る | **未確認**（キーの種類は管理画面でしか分からない） |
| Tailscale SSHは使わない | 認証をsshdへ一本化する | 守っている |
| exitノードと経路の広告は行わない | コンテナを中継点にしない | 守っている |
| `TAILSCALE_AUTHKEY`は`tailscale up`の後に環境から消す | T3などの子プロセスとエージェントから読める | **未対応** |
| キーはWorkerのsecretにだけ置く。リポジトリとログに書かない | 漏えいの防止 | 守っている |
| 送信元が`127.0.0.1`であることを認証の根拠にしない | トンネルとTailscaleの両方が`127.0.0.1`で届く | **要確認** |

## 推奨するACL

管理画面の設定なので、このリポジトリからは適用できない。適用前に、利用者の端末のグループ名を実際の値に置き換える。

```json
{
  "tagOwners": { "tag:cf-demo": ["autogroup:admin"] },
  "acls": [
    { "action": "accept", "src": ["autogroup:member"], "dst": ["tag:cf-demo:2222"] }
  ]
}
```

タグを付けたノードは、利用者の端末へ接続を始められなくなる。適用の順序は次のとおり。

1. ACLを保存する。
2. `tag:cf-demo`付きのエフェメラルな認証キーを作る。
3. `/cf-containers`の`TAILSCALE_AUTHKEY`を更新して再起動する。
4. 別の接続で2222へ入れることと、3773などへ届かないことを確かめる。
5. 古い認証キーを失効させる。

## 確認の方法

```sh
tailscale --socket=/var/run/tailscale/tailscaled.sock status
tailscale --socket=/var/run/tailscale/tailscaled.sock debug prefs
```

`tailscale nc`で自分のIPへ接続しても応答が無く、到達の確認には使えなかった。到達の確認は、別の端末から行う。
