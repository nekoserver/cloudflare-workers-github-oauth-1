# SPEC: demo コンテナを `@cloudflare/containers` から Durable Object Container API へ移す(2026-11-11)

## 1. 背景と方針

**対象**: `src/containers/demoContainer.ts`(`DemoContainer`)、`src/index.ts` の `getDemoContainerStub`、新設の `src/containers/demoContainerStub.ts`、`package.json` の `@cloudflare/containers` — 非推奨になった `Container` クラスをやめ、`this.ctx.container` を直接使う。イメージ・クラス名・バインディング・スケジューリングのポリシーは変えない。

### 背景

- Cloudflare は `@cloudflare/containers` を非推奨にした(公式「Migrate from the Container class to the Durable Object Container API」、2026-11-09 更新)。旧ラインの保守は 2026-12-31 まで。
- 本体の `DemoContainer` は `@cloudflare/containers` 0.3.7 の `Container` を継承している。
- 新しい API は、コマンドの実行(`exec()`)とスナップショットの土台になる。スナップショットは Docker を使わずにコンテナを更新する経路の候補(GitHub Actions が `startup_failure` で動かない間の代わり)だが、別段階とする(6章)。
- ユーザーの承認(2026-11-11): 「更新して。SPEC もテストもその前に」。

### 方針

- 公式の移行ガイドに従う。クラス名 `DemoContainer`・バインディング `DEMO_CONTAINER`・`[[containers]]` のイメージ・`[[migrations]]` は変えない(ガイド: 基底クラスの変更だけでは Durable Object の移行は要らない)。
- スケジューリングのポリシーは `default` のまま。`start()` に `image`・`instance` は渡さない(`wrangler.toml` の値が使われる)。
- 今の動作を保つ。変えるのは、旧クラスが中で行っていたことを自分のコードに書き直すことだけ。

## 2. 対応表(旧クラスの機能 → 新しい書き方)

公式の対応表と、`@cloudflare/containers` 0.3.7 の実装(`node_modules/@cloudflare/containers/dist/lib/container.js`)を読んで決めた。

| 旧クラスで使っていたもの | 旧クラスの実際の動き | 新しい書き方 |
|---|---|---|
| `extends Container` | `DurableObject` を継承し、ライフサイクルを内部で管理 | `extends DurableObject`(`cloudflare:workers`) |
| `getContainer(env.DEMO_CONTAINER, 'demo')` | `binding.get(binding.idFromName('demo'))` | 同じ呼び方(`getDemoContainer()`)。同じ Durable Object と保存データに届く |
| `start()` | `envVars` と `enableInternet`(既定 true)で起動し、ポートが応答するまで待つ | `ctx.container.start({ env, enableInternet: true })`。その後、ポート 8080 の準備完了を待つ |
| 準備完了の判定 | `getTcpPort(8080).fetch('http://ping')` が何か応答を返せば OK。300ms おき、最大 20 秒。待つ間にコンテナが止まれば失敗 | 同じ |
| `stop()` | `signal(SIGTERM)` を送るだけ(止まるまで待たない) | `signal(15)` を送り、止まるまで最大 15 秒待つ(待ち切れなければ状態は「停止処理中」) |
| `envVars` | 起動時の環境変数 | `start({ env })`。再起動で secret を更新したときは、その値で起動する(今と同じ) |
| `sleepAfter = '5m'` + `onActivityExpired(){}`(何もしない。`src/cf-containers-no-autostop.test.ts` が検査していた) | アラームを約3分ごとにかけ直し、Durable Object を起こし続ける。期限が来ても止めないので、コンテナは止まらない | 起動後に `setInactivityTimeout(6時間)` と、5分ごとのアラーム。アラームが動いている間はコンテナが止まらない(公式: アラームの実行は活動に数える。無活動タイムアウトより短い間隔のアラームで起こし続けられる) |
| 再起動した Durable Object | 旧クラスのアラームが続く | コンストラクタで、コンテナが動いていれば `setInactivityTimeout` を張り直す(公式: タイムアウトは再起動で消える) |
| `onStop()`(停止の記録) | アラームの中で `running` が偽になったのを見つけて呼ぶ | `monitor()` の終了と、アラームでの確認の両方。保存した「動いている」印が立っているときだけ1回記録する(公式: コンテナが止まっても Durable Object は起こされない。`monitor()` は Durable Object がメモリにいる間しか知らせない) |
| `getState()` | 保存した状態(`healthy`/`running`/`stopping`/`stopped`/`stopped_with_code`) | `ctx.container.running` と、このクラスが持つ「停止処理中」「準備完了」「最後の終了コード」から作る。値の種類は同じ |
| `fetch()`(Worker からの転送) | 止まっていれば起動して待ち、ポート 8080 へ転送。WebSocket は両端を受けて中継。失敗時は 500 と理由 | 同じ |
| 同時の起動 | 内部で直列化 | 起動の Promise を1つ共有する |
| 管理操作の排他(`withLock`) | このクラス独自 | そのまま |

## 3. 保つ動作(テストで確かめる)

1. `getState()`: 動いていて準備完了を確かめたら `healthy`、動いているだけなら `running`、停止処理中なら `stopping`、止まっていれば `stopped`(最後の終了コードが 0 以外なら `stopped_with_code` と `exitCode`)。状態を読んでもコンテナは起動しない。
2. `setRunning(true/false)`: 今と同じ。望む状態と同じなら何もしない(`changed: false`)。状態が分からないときは失敗する。停止処理中に起動しない。
3. `start`・`stop`・`setRunning`・`restart` は同じロックを使う。進行中なら「別の操作が進行中です」で拒否し、失敗後もロックを放す。
4. `restart(secret)`: 許可された secret だけ受け付ける(不正なら止めない)。止めてから、その値を含む環境変数で起動する。止まりきらなければ `destroy()` して起動する。起動が「まだ動いている」で失敗したら、少し待って数回やり直す(公式: `signal()`/`destroy()` の直後は一時的に使えないことがある)。
5. 起動時の環境変数は今と同じ10個(`NEKOROOT_HOSTNAME`・`NEKOROOT_TUNNEL_TOKEN`・`TAILSCALE_AUTHKEY`・`TAILSCALE_LOGIN_SERVER`・`SSH_HOST_ED25519_KEY_B64`・`SSH_AUTHORIZED_KEYS`・`CF_CONTAINER_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`・`GH_TOKEN`(元は `CONTAINER_GH_TOKEN`))。`enableInternet: true`。
6. 起動したら `setInactivityTimeout(6時間)` と5分後のアラームを設定する。アラームは、動いていればかけ直し、止まっていれば停止を記録してアラームを消す。
7. 停止の記録は1回だけ(`monitor()` とアラームの両方が見つけても重ならない)。`performedBy` は今と同じ `system(onStop)`。記録に失敗しても止める動作は続ける。
8. `fetch()`: 止まっていれば起動して準備完了を待ってから転送する。起動に失敗したら 500 と理由。転送先は `http://` に直す。

## 4. 故障想定

| 故障 | 検出・対処 |
|---|---|
| アラームが来ず、6時間後にコンテナが止まる | 起動・再起動・コンストラクタのたびにアラームを設定し直す。止まった場合はアラームか次の要求で停止を記録する(自動回復: 次の要求で起動する) |
| 停止を記録しそこね、接続時間を長く数える | `monitor()` とアラームの二重化。最大の遅れはアラームの間隔(5分) |
| 停止の直後に起動して「まだ動いている」で失敗 | 再起動では止まりきるまで待ち、だめなら `destroy()`、起動は数回やり直す。それでもだめなら理由付きで失敗を返す |
| 準備完了の前に転送して失敗 | 転送前に必ず準備完了を待つ。20秒で応答が無ければ理由付きの 500 |
| デプロイで Durable Object が再起動し、タイムアウトが消える | コンストラクタで張り直す(公式の書き方) |
| 旧クラスが残したアラームが新しいクラスで動く | `alarm()` を実装する。動いていればかけ直し、止まっていれば消す |

## 5. 変えないもの・やらないこと

- イメージ(`wrangler.toml` の `image`)・`instance_type`・`max_instances`。再ビルドは要らない。
- `/cf-containers` の表示。ページはすでに「自動停止はしません」と表示している(`src/cf-containers-no-autostop.test.ts`)。`/api/cf-containers/status` が返す `sleepAfter: '5m'` は使われ方を確かめていないので、この移行では触らない。
- 外向き通信の制御(`outbound` など)は今も使っていないので、移さない。

## 6. 次の段階(この PR ではやらない): スナップショットでの更新

- スナップショット(`snapshotContainer()`・`start({ containerSnapshot })`)は `durable_object` ポリシーでしか使えない。
- ポリシーは後から変えられない。変えるには新しいコンテナアプリ(新しいクラス)を作り、今のインスタンスを置き換える(公式「Scheduling Policies」「Migrate to the Durable Object scheduling policy」)。
- スナップショットは30日で期限が切れ、ベータ。イメージの固定(`image.lock.json`)と中身がずれる。
- この段階に進むかは、この PR の後に別の SPEC で決める。

## 7. 確かめていないこと

- 本番での動作(デプロイ後に `/cf-containers` で起動・停止・再起動・転送を確かめる)。
- アラームで6時間を超えて起こし続けられること(公式文書の記述による。実測していない)。
- `compatibility_date = "2024-11-17"` のままで新しい API が使えること(旧クラスも `this.ctx.container` を使っていたので使えるはず、の推測)。

## 関連コミット

(コミット後に追記)
