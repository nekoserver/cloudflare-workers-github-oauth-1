# 提案: コンテナのトークン配布を1経路にまとめる

作成日: 2026-11-04
状態: 文書化のみ。**実装はユーザーの指示で中止中**(2026-11-04)。優先順位の高い作業が別にあるため、この提案の実装・Secretの変更・デプロイ・調査の続きは、ユーザーが再開を指示するまで行わない。トークンの再発行など、段階1の運用も実施していない。

## `ORIGIN_HMAC_SECRET`の変更方針

`ORIGIN_HMAC_SECRET`(旧名`HMAC_SECRET`)は影響範囲が広いので、**すべてを見通せるようになるまで部分変更はせず、一括で修正できるところまで見えてから実施する**(ユーザー指定、2026-11-04。[`CLAUDE.md`](CLAUDE.md)のルール45)。

この改修は大規模改修である(`CLAUDE.md`のルール46)。テストの不合格からフォールバックの適用までを確かめる必要があるため、変更の大きさに関わらずこの扱いになる。

実施の条件は次の5つで、すべてそろったらユーザーの承認を得て一括で実施する。

| 条件 | 現在の状態 |
|---|---|
| 鍵を使う全サービスと全リポジトリの一覧 | **一部完了**。下記「`ORIGIN_HMAC_SECRET`の台帳」 |
| 各所の現在の値が一致しているかの確認 | **未完了**。Worker側の値を確認できていない |
| 全箇所を切り替える順序と切り戻しの手順 | **未完了** |
| 影響するテストの一覧 | **一部完了**。下記「テストとの関連」。`cfc-standalone`、`redmine`、`rust-worker-sqlx-d1`のテストは未調査 |
| 今後増えるコンテナにも同じ手順で適用できる | **未完了**。下記「今後増えるコンテナへの適用」 |

保留するのは、鍵の作り直しと、段階2から段階5のフォールバックに関わる変更である。弱い値のまま運用する期間が続くことを承知のうえでの判断である。

### 大規模改修に当たる段階

| 段階 | 扱い | 理由 |
|---|---|---|
| 段階1(トークンの再発行、`CONTAINER_GH_TOKEN`の設定) | 先に行える | コード変更がなく、鍵の作り直しも含まない |
| 段階2 | **大規模改修** | 空の値から保存値へ戻るフォールバックを変える。同じ`merge_settings`に鍵のフォールバックがある |
| 段階3 | **大規模改修** | 鍵の配布経路を変える |
| 段階4 | **大規模改修** | `refresh-lib-tunnels`の環境変数から保存値へ戻る動作を変える |
| 段階5の`set`/`missing`の記録 | 先に行える | ログを追加するだけで、値の解決を変えない |
| 段階5の弱い値の検査 | **大規模改修** | 不合格のときの動作を決める必要がある |

### `ORIGIN_HMAC_SECRET`の台帳

2026-11-04時点。読み取りだけで調べた。**値は読んでいないので、一致しているかは分からない。**

| 場所 | 鍵の状態 | 確認した内容 |
|---|---|---|
| Worker `cloudflare-workers-github-oauth-1` | Secretあり | `ORIGIN_HMAC_SECRET`。関連する`REDMINE_HMAC_SECRET`もある。`src/utils/redmineProxy.ts:31`は3つの名前を順に試す |
| Worker `redmine` | Secretあり | `worker/management.ts:9`、`worker/index.ts:79-80` |
| Worker `rust-worker-sqlx-d1` | Secretあり | `src/tunnelsigner.rs` |
| Worker `cfc-standalone` | Secretあり | `src/worker.ts`、`server.js`、`origin-hmac.mjs`、`src/routing.mjs` |
| Worker `cf-auth` | `REDMINE_HMAC_SECRET`のみ | `ORIGIN_HMAC_SECRET`はない。同じ値かは未確認 |
| コンテナ `cloudflare-workers-github-oauth-1-democontainer` | **Workerから渡されない** | 手入力で`/etc/lib-hmac.env`に入れている |
| コンテナ `redmine-redminecontainer` | Workerから渡される | `worker/index.ts:79-80`、`scripts/lib-services.py:25-27` |
| コンテナ `cfc-standalone-standalonecontainer` | 利用あり。渡し方は未確認 | `server.js`、`origin-hmac.mjs` |
| リポジトリ `lib` | 検証側 | `api/hmac_auth.rb`、`ops/chat_websocket.py`、`claude/ops/` |
| リポジトリ `cf-container` | 配布側 | `ops/network/start-lib-chat-streams`、`ops/network/tunnels.cgi` |
| リポジトリ `redmine`の`vendor/lib/` | **`lib`の複製** | `api/hmac_auth.rb`、`ops/chat_websocket.py`。`lib`を直しても自動では揃わない |
| 本体の`deploy/redmine/gateway.wsgi` | 利用あり | 内容は未確認 |
| リポジトリ `railway` | 文書のみ | `SETUP.railway.md`。実際の環境が残っているかは未確認 |

**鍵のないことを確かめたもの**: Worker `dynamicneko`、`musevm`、`musevm-kernel`、`api-gateway`、`r1-cfgw`(Secret名を確認)。

**`musevm`と`musevm-kernel`の別の鍵**: 2026-11-04に`/health`以外の全経路をHMAC必須にした(`musevm` PR #2、`musevm-kernel` PR #4)。鍵はWorkerごとの`CONTROL_TOKEN`で、`ORIGIN_HMAC_SECRET`とは別である。一括修正の対象には含まないが、今後の共通の受け渡しを決めるときは参考にする。これは中止中の実装の例外で、ユーザーの指示による。

**調べていない範囲**:

- 残り27個のWorkerのSecret。
- GitHubのコード検索は1件しか返さず、使えなかった。代わりに、2026-08-01以降に更新された23リポジトリを直接調べた。残りの105リポジトリは調べていない。
- 過去のコミットだけに残る利用。
- `mygw.nekomaneki.work`など、Cloudflare以外のホストや、ほかのVMにある利用先。
- Cloudflareのコンテナ10個のうち、`musevm`系など残りの7個の中の環境変数。リポジトリのコードには参照がなかった。

### 今後増えるコンテナへの適用

Cloudflareのコンテナはすでに10個あり、今後も増える。手順がコンテナごとに違う今の形では、追加するたびに対応箇所が増える。一括修正では次を決める。

1. **共通の受け渡しを1つ決める。** `redmine`の形を基準にする。Workerの`envVars`で渡し、起動処理が`/etc/lib-hmac.env`へ書き、サービスは環境変数で受け取る。デモコンテナもこの形に揃える。
2. **テンプレートに入れる。** `cf-container-temlate`には今、この鍵の扱いが入っていない。新しいコンテナが最初から共通の形になるようにする。
3. **共通のコードを複製しない。** `redmine`の`vendor/lib/`のように複製が増えると、修正の箇所も増える。増やさない方法を決める。
4. **台帳と実態の差を機械で検出する。** Secret名と各リポジトリの参照を調べ、台帳にないものを報告するスクリプトを用意する。値は読まない。人の記憶に頼ると、一覧はまた古くなる。
5. **鍵は1つにするかを決める。** 全コンテナで同じ鍵を使い続けると、1か所の漏えいが全体に及び、作り直しのたびに全箇所を同時に変える必要がある。呼び出し元ごとに鍵を分ける形(`CLAUDE.md`のルール38の方針)にすれば、この問題は小さくなる。ただし移行の範囲は広がる。

## 対象と目的

**対象**: 本体Workerのデモコンテナに渡す3つのトークン(`CF_CONTAINER_API_TOKEN`、`GH_TOKEN`、`ORIGIN_HMAC_SECRET`)。

現状は、値がWorkerから自動で届くものと、人が`export`で手入力するものに分かれている。手入力の値は`.bash_history`に平文で残っていた。**どのトークンも手入力なしでコンテナに届き、どのファイルの値が正しいかを迷わない状態**を目指す。

## 現状

| トークン | Workerからの受け渡し | 今回のコンテナの状態 | 書き込み先 |
|---|---|---|---|
| `CF_CONTAINER_API_TOKEN` | あり(`demoContainer.ts:43`) | 届いている | `cf-env.sh`、`/etc/lib-tunnels.env` |
| `GH_TOKEN` | あり(`demoContainer.ts:46`) | **空で届いた**。Worker側の`CONTAINER_GH_TOKEN`が未設定か空と見られる | `cf-env.sh`(値があるときだけ)、`~/.config/gh/hosts.yml` |
| `ORIGIN_HMAC_SECRET` | **なし**。`envVars`にも`ALLOWED_SECRET_NAMES`にもない | 手入力で渡している | `/etc/lib-hmac.env` |

## 現状の問題

1. **`ORIGIN_HMAC_SECRET`には手入力以外の経路がない。** `setup-network.py`は値がないと止まる(171行目、466行目)ので、新しいコンテナでは手入力が必要になる。
2. **`ORIGIN_HMAC_SECRET`に弱い値が使われている。** コンテナの`/etc/lib-hmac.env`の値は推測できるものだった。形式は64桁の16進数で正しく見えるため、長さの検査では見つからない。
3. **`setup-network.py`の統合で、空の環境変数が保存値を上書きする。** `merge_settings`の`{**saved, **current}`は空文字も有効な値として扱う。`ORIGIN_HMAC_SECRET`だけは個別に対処してあるが、ほかの設定には効かない。WorkerはSecretが未設定のとき`''`を渡すので、`CF_CONTAINER_API_TOKEN`が空のコンテナで`--apply`すると、`/etc/lib-tunnels.env`の保存値も空で上書きされる。ダミーの値で`merge_settings`を実行して確認した。
4. **同じ値のコピーが複数のファイルにあり、古くなりやすい。** `CF_CONTAINER_API_TOKEN`は`cf-env.sh`と`lib-tunnels.env`の2か所にある。さらに`lib/claude/ops/restore-claude-host.sh`は、実行すると`/etc/apache2/lib-secrets.conf`にも書く(今のコンテナにこのファイルはない)。今回は一致していたが、`cf-container/REPORT.restore.20261022.md`にはプロセスごとに値が違っていた実例がある。
5. **SSHの全シェルが、用途に関係なくトークンを環境変数で持つ。** 子プロセスにも引き継がれる。
6. **トークンの不足が分かりにくい。** `GH_TOKEN`が空のとき、起動ログに1行出るだけで、`/cf-containers`の画面からは分からない(画面での表示は実装を確認していない)。

## 本来あるべき仕様

1. **正本はWorker Secretだけにする。** コンテナ内のファイルは起動時に作るコピーとして扱い、手で直さない。
2. **手入力を必要としない。** 3つとも`/cf-containers`のトークン設定から設定でき、コンテナを起動すれば使える状態になる。値をコマンドラインに書く手順は残さない。
3. **書き込むのは`entrypoint.sh`の1か所にする。** `setup-network.py`はSecretを書かず、読むだけにする。
4. **用途ごとに必要な相手にだけ渡す。**

   | トークン | 渡す先 | 置き場所 |
   |---|---|---|
   | `CF_CONTAINER_API_TOKEN` | `cf`コマンド、トンネル一覧の更新 | `cf-env.sh` |
   | `GH_TOKEN` | `gh`、git | `cf-env.sh`。`hosts.yml`には保存しない |
   | `ORIGIN_HMAC_SECRET` | ストリーム、CGI | `/etc/lib-hmac.env`のみ。シェルには読み込まない |

5. **空の値は「未設定」として扱う。** 既存の値を空で上書きしない。
6. **値の更新はコンテナの再起動で反映する。** 再起動すれば、すべてのコピーが同じ値に揃う。`/api/cf-containers/secrets`の再起動の流れは、今もこの形になっている。
7. **不足と弱い値は起動時に検出する。** トークン名と状態だけを記録し、値は出さない。

## 1つのファイルにまとめる案の検証

**現状**: `.bash_profile`は存在しない。5リポジトリ(`cloudflare-workers-github-oauth-1`、`cf-container`、`lib`、`redmine`、`musevm`)の全履歴にも、`bash_profile`という文字列を追加・削除したコミットはない。実際の書き込み先は`/etc/profile.d/cf-env.sh`で、次の時点で作られた。

| 時点 | 内容 |
|---|---|
| 2026-10-16 | [`fa1a40bf`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/fa1a40bf) で書き出す処理を追加 |
| 2026-10-21 | [`2c67c3c4`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/2c67c3c4) で`GH_TOKEN`を追加 |
| 2026-11-04 17:31:02 UTC | 今のコンテナの起動時に、`entrypoint.sh`が書き出した |

**検証の結論**: 1つのファイルにまとめて機能するのは、rootのシェルまでである。全利用者には届かない。

| 利用者 | 実行ユーザー | `cf-env.sh`の値 | 確認方法 |
|---|---|---|---|
| ログインシェル(`bash -l`) | root | 届く | 実行 |
| 対話シェル(`bash -i`) | root | 届く | 実行 |
| 非対話(`bash -c`、`sh -c`) | root | **届かない** | 実行 |
| cron(`refresh-lib-tunnels`、`start-lib-chat-streams`) | root | **届かない**。読み込む処理を足せば届く | コードと`/etc/cron.d`を確認 |
| `tunnels.cgi`、ストリーム | www-data | **読めない**(`cf-env.sh`は0600) | `runuser`で実行 |

`.bash_profile`はさらに届く範囲が狭い。ダミーの値で試すと、読まれたのは`bash -l`だけだった。このファイルがあると`~/.profile`が読まれなくなり、`.profile`から読み込まれている`.bashrc`も読まれなくなる。rootのホームにあるので、`codex-web`や`www-data`にも効かない。

権限を緩めて`www-data`にも読ませれば届くが、公開側のプロセスがCloudflareとGitHubのトークンを読めるようになる。`start-lib-chat-streams`のコメントが禁じている状態であり、`test_public_stream_does_not_inherit_management_credentials`が守っている点でもある。

`cf-env.sh`にトークンが1種類しか入らないとも限らない。`lib/claude/ops/restore-claude-host.sh`のコメントには、`cf-env.sh`のトークンではトンネルを一覧できなかったので、別の`LIB_TUNNELS_CF_TOKEN`を使う仕組みにしたとある。権限の違うトークンを扱うなら、名前を分ける必要がある。

**採用する形**: 書き込み元を`entrypoint.sh`の1か所にまとめ、値を置くファイルは次の2つにする。ファイルを分ける理由は、読むユーザーが違うためである。

| ファイル | 中身 | 権限 | 読み手 |
|---|---|---|---|
| `/etc/profile.d/cf-env.sh` | 管理用(`CF_CONTAINER_API_TOKEN`、`GH_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`) | root、0600 | rootのシェル、cronのラッパー |
| `/etc/lib-hmac.env` | 署名鍵(`ORIGIN_HMAC_SECRET`) | root:www-data、0640 | `tunnels.cgi`、ストリームの起動処理 |

## 修正案

### 段階1: すぐ行う運用(コード変更なし)

1. `GH_TOKEN`と`CF_CONTAINER_API_TOKEN`を再発行する。
2. `/cf-containers`のトークン設定で`CONTAINER_GH_TOKEN`を設定する。

`ORIGIN_HMAC_SECRET`の作り直しはここでは行わない。一括修正のときに`openssl rand -hex 32`で作り直し、全サービスへ同時に反映する。一覧を作るときは、`lib/ops/CHAT_WEBSOCKET.md`と`cf-container/ops/network/`から調べる。

### 段階2: 空の値で上書きしない(大規模改修)

`setup-network.py`の`merge_settings`で、空の値を除いてから統合する。

```python
def merge_settings(saved, current):
    values = {**saved, **{k: v for k, v in current.items() if v.strip()}}
    ...
```

`test_network_setup.py`に、環境変数が空のときに保存値が残るテストを追加する。`ORIGIN_HMAC_SECRET`を決める処理は変えないが、同じ関数の中で隣り合うので、鍵の一括修正と一緒に実施する。

### 段階3: `ORIGIN_HMAC_SECRET`をWorkerから渡す(大規模改修)

1. `demoContainer.ts`の`envVars`に`ORIGIN_HMAC_SECRET: env.ORIGIN_HMAC_SECRET ?? ''`を追加する。
2. `ALLOWED_SECRET_NAMES`に追加し、`cfContainers.ts`の選択肢にも加える。
3. `entrypoint.sh`で値があるときだけ`/etc/lib-hmac.env`へ書く(root:www-data、0640)。

**先に決めること**: `ALLOWED_SECRET_NAMES`は重要なSecretを画面から上書きさせないための許可リストである(`src/index.ts`のコメント)。Worker自身も`ORIGIN_HMAC_SECRET`を使っている(`src/types.ts:15`、`src/index.ts:20709`)ので、画面から変更できるようにするかは判断が要る。変更させない場合は、`envVars`で渡すだけにして、更新は`wrangler secret put`に限る。

### 段階4: コピーを減らす(大規模改修)

1. `/etc/lib-tunnels.env`の読み手(`cf-container/ops/network/refresh-lib-tunnels`、`setup-network.py`)を`cf-env.sh`の読み取りへ移す。
2. `setup-network.py:213-214`の書き込みと、この`.env`ファイルをやめる。
3. `entrypoint.sh`で空の`CF_CONTAINER_API_TOKEN`を書かないようにし、`GH_TOKEN`と同じ扱いに揃える。

`cf-container`リポジトリの変更を伴うので、同じ時期に出す。

### 段階5: 起動時の検査

`ORIGIN_HMAC_SECRET`の弱い値の検査は大規模改修として、一括修正に含める。トークンの`set`/`missing`の記録は先に行ってよい。

`entrypoint.sh`の末尾で、3つのトークンの状態を`set`または`missing`で記録する。`ORIGIN_HMAC_SECRET`は既知の弱い値の一覧と比べ、長さの検査だけに頼らない。一覧をリポジトリへ平文で置かないよう、ハッシュで持つ。

`missing`を`/cf-containers`の画面に出すかは、段階5の実装時に決める。

## テストとの関連

### 2026-11-04の実行結果

| テスト | 結果 | 実行方法 |
|---|---|---|
| `src/cf-containers-gh-token.test.ts`、`src/containers/demoContainer.secrets.test.ts`、`src/utils/cfWorkerSecretApi.test.ts` | 12件成功 | `npx vitest run` |
| `containers/demo/test_network_setup.py` | 8件成功 | `python3 -m unittest` |
| `cf-container/ops/test/network_settings_test.py` | 8件成功 | `python3 -m unittest` |
| `lib/test/chat_secret_env_test.py` | 3件成功 | `/opt/lib-chat/bin/python`で実行 |
| `lib/test/hmac_auth_env_test.rb` | **実行できず** | `minitest/mock`を読み込めない(minitest 6.0.0) |

段階2の修正は、`setup-network.py`の複製に適用して`test_network_setup.py`を実行し、8件とも成功した。修正前のコードでは、空の環境変数が保存値を空で上書きすることも確認した。

### 既存のテストが固定している仕様

修正案はこの仕様を変えないようにする。

| テスト | 固定している内容 | 影響する段階 |
|---|---|---|
| `src/cf-containers-gh-token.test.ts:13` | `GH_TOKEN`を値があるときだけ書く`printf`の文字列 | 段階4。この行は変えない |
| `src/cf-containers-gh-token.test.ts:15` | `. /etc/profile.d/cf-env.sh`という読み込みの文字列 | 全段階。`cf-env.sh`の名前と場所は変えない |
| `src/cf-containers-gh-token.test.ts:8` | `GH_TOKEN: env.CONTAINER_GH_TOKEN ?? ''` | 段階3。同じ行を残す |
| `src/cf-containers-gh-token.test.ts:18`、`src/utils/cfWorkerSecretApi.test.ts:37-39` | `ALLOWED_SECRET_NAMES`に含まれる名前(`toContain`) | 段階3。追加だけなら壊れない。一覧の完全一致を見るテストは、調べた範囲にはない |
| `src/containers/demoContainer.secrets.test.ts` | `objectContaining`で一部のキーを確認 | 段階3。`envVars`への追加では壊れない |
| `lib/test/hmac_auth_env_test.rb` `test_missing_environment_does_not_read_a_file`、`lib/test/chat_secret_env_test.py` `test_missing_environment_fails_even_when_secret_file_exists` | **アプリはSecretのファイルを読まず、環境変数だけを見る** | 全段階。ファイルを読むのは起動ラッパーだけにする |
| `cf-container/ops/test/network_settings_test.py` `test_public_stream_does_not_inherit_management_credentials` | 公開ストリームに管理用トークンを渡さない | 全段階。1ファイルへの集約を止める理由の1つ |
| `cf-container/ops/test/network_settings_test.py` `test_cgi_keeps_current_signing_environment` | `tunnels.cgi`は環境変数を優先し、なければ`/etc/lib-hmac.env`を読む | `/etc/lib-hmac.env`のパスは変えない |
| `containers/demo/test_network_setup.py` `test_current_environment_wins_and_blank_secret_falls_back` | 環境変数が優先で、空の`ORIGIN_HMAC_SECRET`は保存値へ戻る | 段階2。修正後も成功 |
| `lib/claude/test/restore_claude_host_test.py` | `restore-claude-host.sh`が`ORIGIN_HMAC_SECRET`なしで止まり、`lib-secrets.conf`を書く | 段階4。Apacheへの渡し方を変えるなら、このテストも直す |

### テストで守られていないこと

- **ファイルの権限と実行ユーザー**: 権限を検査するテストが`cf-env.sh`にも`lib-hmac.env`にもない。テストをrootで動かすと、権限の誤りで`www-data`が読めなくても成功する。
- **`entrypoint.sh`の動作**: `src`のテストは文字列の一致だけを見ている。実行して`cf-env.sh`の中身を確かめるテストがない。
- **空の`CF_CONTAINER_API_TOKEN`の扱い**: `entrypoint.sh`の`printf`にも、空の値を書かないことにもテストがない。
- **Workerからサービスまでの通し**: `envVars`、`entrypoint.sh`、ファイル、読み手が同じキーを使うことを確かめるテストがない。3リポジトリに分かれているので、片方だけの変更では検出されない。
- **Pythonのテストの実行**: `npm test`は`vitest run`だけで、`test_network_setup.py`を実行する設定が本体リポジトリにない。GitHub Actionsも使っていないので、手で実行しない限り動かない。

### 追加するテスト

| 段階 | テスト | 内容 |
|---|---|---|
| 2 | `test_network_setup.py` | 環境変数が空のとき`CF_CONTAINER_API_TOKEN`の保存値が残る |
| 3 | `src/cf-containers-gh-token.test.ts`と同じ形の新しいテスト | Workerが`ORIGIN_HMAC_SECRET`を渡し、`entrypoint.sh`が値のあるときだけ書く |
| 3 | 同上 | `cf-env.sh`に`ORIGIN_HMAC_SECRET`を書かない |
| 4 | 新規(`entrypoint.sh`の書き出し部分を一時ディレクトリで実行) | 空の値を書かない。権限が0600と0640になる |
| 4 | `network_settings_test.py` | `refresh-lib-tunnels`が`cf-env.sh`の値を使う |
| 5 | 新規 | 既知の弱い値を検出し、ログに値を出さない |
| 全体 | `package.json` | `test_network_setup.py`を実行するスクリプトを追加する |

`www-data`が読めることの確認は、rootでのテストでは代えられない。`runuser -u www-data`で確かめるか、`stat`で権限と所有者を検査する。

## 採用しない案

- **`.bash_profile`へのトークンの書き込み**: `bash -l`でしか読まれず、`~/.profile`も読まれなくなる。詳細は「1つのファイルにまとめる案の検証」を参照。
- **`setup-network.py`への手入力の維持**: 再発行のたびに`.bash_history`へ値が残る問題が続く。
- **全トークンの`cf-env.sh`への集約**: `www-data`が読めない。読めるようにすると、公開側のプロセスが管理用トークンを読める。さらに`ORIGIN_HMAC_SECRET`が、SSHの全シェルと、そこから起動するCodexやClaudeの環境変数にも入る。

## 確認していないこと

- コンテナの再起動後に、`/etc/lib-*.env`と`/root`が残るか。
- `/root/.config/gh/hosts.yml`にトークンを書いた操作。段階1の前に特定し、`GH_TOKEN`があれば保存しない形にできるかを確かめる。
- Worker側の`ORIGIN_HMAC_SECRET`と`CONTAINER_GH_TOKEN`の実際の値。CloudflareのAPIで分かるのはSecretの名前だけである。
- `ORIGIN_HMAC_SECRET`を使う全サービスの一覧。範囲は上記の台帳を参照。
- `lib/test/hmac_auth_env_test.rb`の結果。段階の実施前に、`minitest/mock`を読み込める環境で実行する。
- 段階3から段階5の修正の、テストへの実際の影響。上の表はテストの内容を読んだ判断である。

## 今後の課題: 各コンテナの環境変数の設定と修正日時の記録の一元化

ユーザー指定(2026-11-04)。内容の検討と実装は、優先順位の高い作業のあとに行う。

**目的**: どのコンテナに、どの環境変数が設定され、いつ修正されたかを1か所で確かめられるようにする。記録するのは変数名と日時で、値は記録しない。

**背景**: コンテナは2026-11-04時点で10個あり、今後も増える。今回の調査では、手入力の鍵、ファイルの更新時刻、起動ログ、各リポジトリの文書を別々に確かめる必要があった。

**検討すること**: 記録の置き場所、記録する項目、記録の方法(手動か自動か)、既存の`cf_container_operation_log`との関係。上記の「`ORIGIN_HMAC_SECRET`の台帳」も、この記録に統合できるかを検討する。

## 今後の課題: 2026-11-04の作業で残った改善点

いずれも未実施である。起動の失敗やフォールバックに関わるものは、`CLAUDE.md`のルール46の大規模改修として扱う。

### `musevm`と`musevm-kernel`のHMAC

| 項目 | 現状 | 改善案 | 優先度 |
|---|---|---|---|
| 画面の入り口 | ブラウザで`/cf-containers`を開くと401になる。コマンドラインからの署名が必要 | ログイン済みの本体Workerから署名して中継する形か、Cloudflare Accessを検討する | 高 |
| 鍵の保管 | `/root/.config/musevm/control-tokens.env`にある。コンテナの作り直しで消える可能性がある | パスワード管理ツールなど、コンテナの外へ移す | 高 |
| 署名なしの呼び出し元 | HMAC必須化で失敗するものがあるか調べていない | Workerのログで401の発生元を確かめる | 中 |
| 署名の範囲 | リクエスト本文は対象外で、300秒以内なら同じ署名を再利用できる | 本文のハッシュを署名に含める。再利用の防止は、必要性を確かめてから決める | 中 |
| Workerを通らない経路 | `cloudflared`のトンネルを使う場合はHMACを通らない | トンネルを有効にする前に、Cloudflare Accessなどの保護を決める | 中 |
| PRの確認 | プレビューURLを無効にしたので、PRの動作をURLで確かめられない | プレビュー専用の鍵で有効に戻せるか、古いプレビューを削除する方法と合わせて検討する | 低 |

### `musevm-kernel`のQEMU起動

診断の詳細は`nekoserver/musevm-kernel`の`CAUTION.musevm-kernel.QEMU-boot.md`にある。

| 項目 | 現状 | 改善案 | 優先度 |
|---|---|---|---|
| ビルドの再現 | bzImageは外部でビルドされ、再ビルドの手順がリポジトリにない | ソースの版、コンパイラ、手順を記録し、同じものを作れるか確かめる | 高 |
| ブートテストの時間 | 本番の測定は修正前の1回(52秒)だけ | PR #6の反映後に複数回測り、上限の120秒が妥当か判断する | 中 |
| パニックの検出 | QEMUの終了コードが0で、`MUSEVM_GUEST_READY`の有無でしか判定できない | 次のカーネルのビルドで`CONFIG_PVPANIC_MMIO`を有効にし、終了コードで判定する | 中 |
| 古いゲストディスク | 同じ版でrootfsを更新しても、残っているディスクには反映されない | ディスクにrootfsのSHA-256を記録し、違うときに警告する | 低 |
| bzImageの照合 | `run-kernel`の実行時には確かめない | 起動前の照合を、所要時間を見て追加する | 低 |

### 本体リポジトリとコンテナ

| 項目 | 現状 | 改善案 | 優先度 |
|---|---|---|---|
| Claude CLIの再発防止 | Dockerfileに対策がなく、更新で再び起動しなくなる恐れがある | `NOTICE.cloudflare-workers-github-oauth-1.20261104.md`の案を実施する | 高 |
| `CLAUDE.md`の古い記述 | ルール40に「Claude CLIは2026-10-17に外した」とあるが、Dockerfileは導入している | 現在の構成に合わせて直す | 中 |
| NOTICEの記述 | `20261019.npm12`の4節は未コミットで、「ユーザーの更新」と書かれている | 更新処理が自動で起こすことを反映してコミットする | 低 |
| NOTICEの索引 | `NOTICE...20261104.md`が`CLAUDE.md`の索引にない | 索引に追加する | 低 |

## 関連

- [`NOTICE.cloudflare-workers-github-oauth-1.20261104.md`](NOTICE.cloudflare-workers-github-oauth-1.20261104.md)(Claude CLIが起動しなくなる問題。同じコンテナの別件)
