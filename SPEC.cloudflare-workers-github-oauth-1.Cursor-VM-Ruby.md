# Cursor VM の Ruby・rbenv・Rails・Kamal

確認日: 2026-10-09（JST）。`/home/box` 以下の実ファイルとコマンド出力に基づく環境記録。

## Ruby のインストール状況

| 項目 | 確認結果 |
| --- | --- |
| rbenv のルート | `/home/box/.rbenv` |
| rbenv | `1.3.2` |
| ruby-build | `20260924` |
| インストール済み Ruby | `4.0.7` のみ（rbenv の versions 配下） |
| グローバル選択 | `/home/box/.rbenv/version` に `4.0.7` |
| `ruby -v` | `ruby 4.0.7 (2026-09-15 revision 229531a6cf) +PRISM [x86_64-linux]` |
| Ruby 実体 | `/home/box/.rbenv/versions/4.0.7/bin/ruby` |
| RubyGems / Bundler | ともに `4.0.20` |
| gem の格納先 | `/home/box/.rbenv/versions/4.0.7/lib/ruby/gems/4.0.0` |
| Ruby が使用する OpenSSL | `OpenSSL 3.5.7 9 Jun 2026` |

Ruby のビルド設定は `--prefix=/home/box/.rbenv/versions/4.0.7 --enable-shared --with-ext=openssl,psych,+`。gem 格納先の `4.0.0` は実際のディレクトリ名であり、選択されている Ruby は `4.0.7`。

## シェルと PATH

`/home/box/.bashrc` は対話シェルで `.rbenv/bin` を PATH に追加し、`eval "$(rbenv init - bash)"` を実行する。非対話シェルでは冒頭で return する。

`/home/box/.profile` には、ログインシェル向けに次の設定がある。

```sh
export PATH="$HOME/.rbenv/shims:$HOME/.rbenv/bin:$PATH"
```

同ファイルは `$HOME/bin` と `$HOME/.local/bin` も PATH に追加する。`HOME=/home/box` の環境を想定した設定なので、別ユーザーや初期化ファイルを読まない実行環境では PATH を明示する。今回の調査用シェルでは初期状態で `ruby`・`rbenv`・`kamal` を解決できず、以下の設定後に起動を確認した。

```sh
export RBENV_ROOT=/home/box/.rbenv
export PATH="$RBENV_ROOT/shims:$RBENV_ROOT/bin:/home/box/.local/bin:$PATH"
rbenv versions
rbenv version
ruby -v
gem -v
bundle -v
kamal version
```

## Kamal のインストール状況

Kamal は Ruby gem として `2.12.0` がインストール済み。`kamal version` は `2.12.0` を返した。

| 項目 | パス・バージョン |
| --- | --- |
| shim | `/home/box/.rbenv/shims/kamal` |
| `rbenv which kamal` | `/home/box/.rbenv/versions/4.0.7/bin/kamal` |
| gem 本体 | `/home/box/.rbenv/versions/4.0.7/lib/ruby/gems/4.0.0/gems/kamal-2.12.0` |
| SSHKit | `1.25.1` |
| net-ssh / net-scp | `7.3.3` / `4.1.0` |
| ed25519 / bcrypt_pbkdf | `1.4.0` / `1.1.2` |

インストール済み gem の README では、Kamal は Docker コンテナとしてアプリを配備し、SSHKit でサーバー上のコマンドを実行し、kamal-proxy でリクエストを切り替えるツールと説明されている。

## Rails のインストール状況

Ruby `4.0.7` の gem 環境に Rails `8.1.4` と `8.1.3.1` が共存している。リポジトリのルートで上記 PATH 設定を使用した `rails --version` は `Rails 8.1.4` を返した。

| 項目 | 確認結果 |
| --- | --- |
| インストール済み rails gem | `8.1.4`、`8.1.3.1` |
| railties / actionpack / activerecord / activesupport | それぞれ `8.1.4`、`8.1.3.1` |
| shim | `/home/box/.rbenv/shims/rails` |
| `rbenv which rails` | `/home/box/.rbenv/versions/4.0.7/bin/rails` |
| gem 本体 | `/home/box/.rbenv/versions/4.0.7/lib/ruby/gems/4.0.0/gems/rails-8.1.4` および `rails-8.1.3.1` |

各アプリのディレクトリで `bundle exec rails --version` と `bundle check` を実行した結果は以下のとおり。アプリごとの Rails バージョンは Gemfile と Gemfile.lock により選択される。

| アプリ | `bundle exec rails --version` | `bundle check` |
| --- | --- | --- |
| `/home/box/apps/rails-root` | `Rails 8.1.4` | 依存 gem を満たしている |
| `/home/box/apps/rails-root-b` | `Rails 8.1.4` | 依存 gem を満たしている |
| `/home/box/apps/redmine` | `Rails 8.1.3.1` | 依存 gem を満たしている |

Redmine の Gemfile は `gem 'rails', '8.1.3.1'` と Ruby `>= 3.2.0, < 4.1.0` を指定し、Gemfile.lock の Rails も `8.1.3.1`。`bundle check` は成功したが、Windows 向けの旧 platform 指定（`:mingw`、`:x64_mingw`、`:mswin`）に対する非推奨警告が出た。

以上は gem のインストール、CLI 起動、依存関係の確認であり、Rails サーバーの起動、DB 接続、マイグレーション、アプリの動作確認は実施していない。

## Rails アプリ側の Kamal 設定

`/home/box/apps/rails-root` と `/home/box/apps/rails-root-b` の両方で、以下を確認した。

- `.ruby-version` は `ruby-4.0.7`。
- Gemfile は Rails `~> 8.1.4` と `gem "kamal", require: false` を指定。
- Gemfile.lock は Rails `8.1.4` と Kamal `2.12.0` を記録。
- アプリのディレクトリ内で `bundle exec kamal version` を実行すると `2.12.0` を返す。
- `config/deploy.yml` が存在し、`service: rails-root`、`image: your-user/rails-root`、builder の `arch: amd64` を指定している。

`image` には雛形の値が残っている。設定ファイルの存在と CLI の起動は確認済みだが、デプロイ先・認証・実際の配備成功はこの調査では確認していない。

## Docker と確認範囲

Docker CLI は `/home/box/.local/bin/docker`、別途 `/home/box/opt/docker/docker/docker` も存在する。上記 PATH 設定を使用した結果は以下のとおり。

| コマンド | 結果 |
| --- | --- |
| `docker --version` | `Docker version 29.1.4, build 0e6fee6` |
| `docker info --format '{{.ServerVersion}}'` | `29.9.0`（接続先 daemon のバージョン） |
| `docker buildx version` | `unknown command: docker buildx` |

Docker daemon への接続は確認できたが、この CLI 環境では Buildx サブコマンドを利用できなかった。Kamal によるイメージビルドとデプロイは未実施のため、Kamal のインストール・起動確認を配備可能性の保証として扱わない。

今回の作業ではインストール、シェル設定変更、コンテナ操作、リモートサーバーへの接続、デプロイは行わず、環境の参照とバージョン確認のみを実施した。
