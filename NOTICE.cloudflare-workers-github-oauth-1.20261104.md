# NOTICE 2026-11-04: コンテナのClaude CLIが起動しなくなる原因

**対象**: 本体Workerのコンテナ(`containers/demo/Dockerfile`)、Node.js 26.13.0・npm 12.2.0・Claude Code 2.1.318。

## 結論

**Claude CLIの更新時に、npm 12がpostinstallを止めるため、`claude`の実行ファイルが仮ファイルに置き換わる。** 更新はイメージのビルドとは別に、稼働中のコンテナで行われる。Dockerfileの`--allow-scripts`はビルド時の1回にしか効かないので、ここでは許可がない。

起動すると、次のエラーで終了する(exit 1)。

```text
Error: claude native binary not installed.
```

ClaudeのAPI、ログイン、Workerの障害ではない。`.credentials.json`も関係しない。

## 壊れる仕組み

1. コンテナのClaude CLIが、イメージの版より新しい版へ更新される。今回は2.1.309から2.1.318への更新で、`npm install --global @anthropic-ai/claude-code@2.1.318`が実行された。
2. npm 12は既定でインストールスクリプトを実行しない。`allow-scripts`に載っていないので、postinstall(`node install.cjs`)が止まる。
3. `bin/claude.exe`は配布時点では500バイトのシェルスクリプトで、エラーを表示するだけの仮ファイルである。本物のバイナリ(約338MB)を上書きでコピーするのがpostinstallの役目なので、これが止まると仮ファイルが残る。
4. npmは警告だけを出して**exit 0**で終わる。Linux x64用のoptional依存パッケージは入っているが、`claude`コマンドからは使われない。
5. Claudeの更新処理は仮ファイルを検出して`install_failed`を記録するが、**前の版には戻さない**。次の起動から`claude`が動かなくなる。

更新処理は仮ファイルを見つけると、`npm config get ignore-scripts`が`true`かどうかを確かめる。`allow-scripts`による停止はこの判定の対象外である(2.1.318のバイナリ内の文字列で確認)。

`/opt/claude-web/claude`も`/opt/node22/bin/claude`へのシンボリックリンクなので、同じ実体を使う経路はまとめて動かなくなる。

## 根拠

| 確認したもの | 内容 |
|---|---|
| `/root/.claude/.last-update-result.json` | 19:11:43 UTC、`path:"npm-global"`、2.1.309→2.1.318、`outcome:"failed"`、`error_code:"update_apply_native_binary_missing"` |
| `/root/.npm/_logs/2026-11-04T19_11_34_728Z-debug-0.log` | `install-scripts ... blocked because they are not covered by allowScripts`、`@anthropic-ai/claude-code@2.1.318 (postinstall: node install.cjs)`、`exit 0` |
| 再現試験(下表) | 差は`allow-scripts`の有無だけで、結果が分かれた |

別のインストール先(`--prefix`)へ2.1.318を入れて試した。

| 設定 | npmの終了コード | `bin/claude.exe` | `claude --version` |
|---|---|---|---|
| ユーザー設定に`allow-scripts`なし | 0 | 500バイトの仮ファイル | exit 1、上記エラー |
| ユーザー設定(`/root/.npmrc`)に`allow-scripts`あり | 0 | 337,814,032バイト | `2.1.318 (Claude Code)` |
| グローバル設定(`NPM_CONFIG_GLOBALCONFIG`で指定)に`allow-scripts`あり | 0 | 確認していない | `2.1.318 (Claude Code)` |

## 更新を起こしたもの

Claude自身の更新処理と判断した。`.last-update-result.json`が更新処理の記録であること、`npm install`の終了直後に書かれていること、`.bash_history`に手動の`claude update`や`npm install`がないことが根拠である。自動更新なのか別の経路なのかは、記録からは区別できない。

[`NOTICE.cloudflare-workers-github-oauth-1.20261019.npm12.md`](NOTICE.cloudflare-workers-github-oauth-1.20261019.npm12.md)の4節は「グローバル更新」「ユーザーの更新」と書いているが、人が手で更新しなくても起きると読むこと。

## 復旧の手順

バイナリのパッケージは入っているので、postinstallを手で実行すれば直る。再インストールは要らない。

```sh
node /opt/node22/lib/node_modules/@anthropic-ai/claude-code/install.cjs
claude --version
```

今回はこれで`2.1.318 (Claude Code)`に戻った。`claude.exe`のSHA256は、Dockerfileの`CLAUDE_SHA256`と一致した。

## 再発の防止(未対応)

**今のコンテナ**は、`/root/.npmrc`に`allow-scripts=@anthropic-ai/claude-code`が設定済みである(実施は2026-11-04)。ただし、この設定は`npm install -g`で効くことを確かめただけで、Claudeの更新処理そのものでは試していない。次の版が出たときに確かめる。

**イメージには入っていない。** Dockerfileはこの設定を書いていないので、新しいイメージでは消えて再発すると見ている。コンテナを作り直したときに`/root`が残るかは確かめていない。

Dockerfileの対策は次の2案がある。どちらも未実施で、1案を推奨する。

1. **`ENV DISABLE_AUTOUPDATER=1`で更新を止める。** 版はDockerfileの`CLAUDE_VERSION`と`CLAUDE_SHA256`で固定しているので、方針と合う。ビルド時の照合も意味を保てる。この変数名は2.1.318のバイナリにあることを確かめただけで、動作は試していない。
2. **グローバルのnpm設定に`allow-scripts`を書く。** `npm config set allow-scripts=@anthropic-ai/claude-code --location=global`をDockerfileに加える。更新は続くが、SHA256の照合を通らない版で動くことになる。`20261019.npm12`の2節の「グローバル設定の恒久変更は行わない」という方針を変えることにもなる。

## 忘れないこと

- **`npm install -g`がexit 0でも、`claude`が動くとは限らない。** 更新後は必ず`claude --version`で確かめる。
- optional依存のパッケージがなければ、postinstallだけでは直らない。`--omit=optional`を付けずに、`--allow-scripts=@anthropic-ai/claude-code`付きで入れ直す。
- 上の対策を入れない限り、イメージの版を上げても再発は防げない。さらに新しい版が出れば、同じ更新が起きる。

## 確認していないこと

- 上記の対策を入れたイメージのビルドと、コンテナの再作成後の動作。
- `codex-web`ユーザーで動くClaudeの更新時の挙動。`/opt/node22/lib/node_modules`はroot所有なので書き込めないはずだが、試していない。
