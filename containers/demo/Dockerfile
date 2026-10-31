# 固定する版。最後に/etc/image-versions.jsonへ書き出すため、全ステージで共有する。
ARG TAILSCALE_VERSION=1.104.4
ARG GH_VERSION=2.103.3
ARG JJ_VERSION=0.46.0
ARG RUBY_VERSION=4.0.9

# Tailscaleはビルド専用ステージでGoのソース(proxy.golang.org)から作る。
# pkgs.tailscale.comからのtgz取得は、この環境では到達できないため使わない。
FROM golang:1.27.3-trixie AS tailscale-build
ARG TAILSCALE_VERSION
# ソースを捨てる前に、ソースからのコンパイル時間と、パッケージ(キャッシュ)からのインストール時間を測って
# CACHE_EFFECT の行を出す。ビルドの記録の取り込みが、D1の cf_container_build_cache_effects に保存する(CLAUDE.md ルール44)。
RUN start_ms=$(date +%s%3N) \
    && CGO_ENABLED=0 go install -trimpath tailscale.com/cmd/tailscale@v${TAILSCALE_VERSION} tailscale.com/cmd/tailscaled@v${TAILSCALE_VERSION} \
    && compile_ms=$(( $(date +%s%3N) - start_ms )) \
    && /go/bin/tailscale version \
    && /go/bin/tailscaled --version \
    && tar -czf /tmp/tailscale-pkg.tgz -C /go/bin tailscale tailscaled \
    && mkdir -p /tmp/tailscale-cache-check && start_ms=$(date +%s%3N) \
    && tar -xzf /tmp/tailscale-pkg.tgz -C /tmp/tailscale-cache-check \
    && /tmp/tailscale-cache-check/tailscaled --version \
    && install_ms=$(( $(date +%s%3N) - start_ms )) \
    && source_bytes=$(find /go/pkg/mod/cache/download -name "*.zip" -printf "%s\n" | awk '{n+=$1} END {print n+0}') \
    && package_bytes=$(stat -c %s /tmp/tailscale-pkg.tgz) \
    && echo "CACHE_EFFECT package=tailscale version=${TAILSCALE_VERSION} compile_ms=${compile_ms} install_ms=${install_ms} source_bytes=${source_bytes} package_bytes=${package_bytes}" \
    && rm -rf /tmp/tailscale-pkg.tgz /tmp/tailscale-cache-check \
    && go clean -modcache -cache

# Ubuntu-based container for /cf-containers. Runtime credentials are supplied
# at startup; do not COPY login state or secrets into this image.

# Rubyは公式のソース(cache.ruby-lang.org)からビルドする。aptのrubyは古いため使わない。
# sha256はhttps://www.ruby-lang.org/en/downloads/ に載っている値で固定し、取得物の改ざん・破損で失敗させる。
FROM ubuntu:26.04 AS ruby-build
ARG RUBY_VERSION
ARG RUBY_SHA256=c35350682ff050b79702d57ade4516e7336063f510155d19fb2fb5b3f3909511
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl build-essential autoconf bison pkg-config \
        libssl-dev libyaml-dev zlib1g-dev libffi-dev libgmp-dev \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/ruby.tar.gz \
        "https://cache.ruby-lang.org/pub/ruby/${RUBY_VERSION%.*}/ruby-${RUBY_VERSION}.tar.gz" \
    && echo "${RUBY_SHA256}  /tmp/ruby.tar.gz" | sha256sum -c - \
    && mkdir -p /tmp/ruby-src && tar -xzf /tmp/ruby.tar.gz -C /tmp/ruby-src --strip-components=1 \
    && cd /tmp/ruby-src \
    && start_ms=$(date +%s%3N) \
    && ./configure --prefix=/opt/ruby --disable-install-doc \
    && make -j"$(nproc)" \
    && make install \
    && compile_ms=$(( $(date +%s%3N) - start_ms )) \
    && tar -czf /tmp/ruby-pkg.tgz -C /opt ruby \
    && mkdir -p /tmp/ruby-cache-check && start_ms=$(date +%s%3N) \
    && tar -xzf /tmp/ruby-pkg.tgz -C /tmp/ruby-cache-check \
    && /tmp/ruby-cache-check/ruby/bin/ruby --version \
    && install_ms=$(( $(date +%s%3N) - start_ms )) \
    && echo "CACHE_EFFECT package=ruby version=${RUBY_VERSION} compile_ms=${compile_ms} install_ms=${install_ms} source_bytes=$(stat -c %s /tmp/ruby.tar.gz) package_bytes=$(stat -c %s /tmp/ruby-pkg.tgz)" \
    && cd / && rm -rf /tmp/ruby-src /tmp/ruby.tar.gz /tmp/ruby-pkg.tgz /tmp/ruby-cache-check \
    && /opt/ruby/bin/ruby --version \
    && /opt/ruby/bin/ruby -ropenssl -ryaml -rzlib -rfiddle -e 'puts OpenSSL::OPENSSL_LIBRARY_VERSION'

FROM ubuntu:26.04

# Use one supported Node runtime for the server and both CLIs. The archive
# digest is pinned independently of the download, so corruption fails the build.
ARG NODE_VERSION=26.13.0
ARG NODE_SHA256=d28a96af6c38596f6d9d97c0ee531c13d238d757742387d1928de822d959e997
ARG NPM_VERSION=12.2.0
ARG CODEX_VERSION=0.166.0
ARG T3_VERSION=0.1.3
ARG CLAUDE_VERSION=2.1.309
ARG VITEST_VERSION=5.0.5
ARG TYPESCRIPT_VERSION=7.0.2
ARG CLOUDFLARED_VERSION=2026.10.6
# Retain the installation path used by existing runtime checks.
ENV PATH="/opt/node22/bin:${PATH}"

# Node.js 26 requires libatomic.so.1 (provided by libatomic1).
# Keep large packages in separate layers to avoid registry upload timeouts.
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        ca-certificates tmux expect gnupg libatomic1 \
        apache2 openssl openssh-server nftables curl util-linux wtmpdb libpam-wtmpdb \
        python3 python3-venv cron sudo bubblewrap libyaml-0-2 libffi8 libgmp10 \
        iproute2 iputils-ping net-tools bind9-dnsutils traceroute \
        netcat-openbsd tcpdump mtr-tiny whois procps xz-utils git locales sshguard silversearcher-ag ripgrep \
    && rm -rf /var/lib/apt/lists/*
# 日本語: SSHのシェル・tmuxで日本語を入力・表示できるようにja_JP.UTF-8を生成し、
# ログインシェル(/etc/profile.d)とsshd経由のセッション(/etc/default/locale)の両方で既定にする。
RUN locale-gen ja_JP.UTF-8 \
    && printf 'LANG=ja_JP.UTF-8\n' > /etc/default/locale \
    && printf 'export LANG=ja_JP.UTF-8\n' > /etc/profile.d/locale.sh
ENV LANG=ja_JP.UTF-8
ARG INSTALL_DOCKER=false
RUN case "$INSTALL_DOCKER" in true|false) ;; *) echo "INSTALL_DOCKER must be true or false" >&2; exit 1 ;; esac; \
    if [ "$INSTALL_DOCKER" = "true" ]; then \
      apt-get update && apt-get install -y --no-install-recommends docker.io \
      && rm -rf /var/lib/apt/lists/*; \
    fi
# chat用のPythonライブラリはUbuntuのapt版を使う(pipはPyPIへの証明書検証が
# このビルド環境で通らず、apt版ならアーカイブ経由で取得でき依存を固定しやすいため)。
RUN apt-get update && apt-get install -y --no-install-recommends python3-websockets python3-aiohttp \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -c "import websockets, aiohttp; print('websockets', websockets.__version__, 'aiohttp', aiohttp.__version__)"
# ghとjjは、公式のリリースにあるコンパイル済みのバイナリを使う(ソースからのビルドに毎回約20分かかっていた)。
# sha256は配布元の値で固定する(gh: gh_<版>_checksums.txt。jj: 配布物から計算した値。jjは公式のチェックサムのファイルが無い)。
ARG GH_VERSION
ARG GH_SHA256=4c806978ffce1cec70853302a56d70ac6da4f19bae7adca4e1a8ab00633dd91d
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/gh.tar.gz \
        "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" \
    && echo "${GH_SHA256}  /tmp/gh.tar.gz" | sha256sum -c - \
    && mkdir -p /tmp/gh && tar -xzf /tmp/gh.tar.gz -C /tmp/gh --strip-components=1 \
    && install -m 755 /tmp/gh/bin/gh /usr/bin/gh \
    && gh --version \
    && rm -rf /tmp/gh /tmp/gh.tar.gz
ARG JJ_VERSION
ARG JJ_SHA256=fce0271158e665ceb82dc66c5eb95b1728649094e9133074f3b5baece345fc08
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/jj.tar.gz \
        "https://github.com/jj-vcs/jj/releases/download/v${JJ_VERSION}/jj-v${JJ_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
    && echo "${JJ_SHA256}  /tmp/jj.tar.gz" | sha256sum -c - \
    && mkdir -p /tmp/jj && tar -xzf /tmp/jj.tar.gz -C /tmp/jj \
    && install -m 755 /tmp/jj/jj /usr/bin/jj \
    && jj --version \
    && rm -rf /tmp/jj /tmp/jj.tar.gz
ARG CLOUDFLARED_SHA256=13d9a724a4d4271958a3728982ee983870a100959a159d2fa263b3450d0be72a
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --output /tmp/cloudflared.deb \
        "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-amd64.deb" \
    && echo "${CLOUDFLARED_SHA256}  /tmp/cloudflared.deb" | sha256sum -c - \
    && dpkg -i /tmp/cloudflared.deb \
    && rm -f /tmp/cloudflared.deb
COPY --from=tailscale-build /go/bin/tailscale /usr/bin/tailscale
COPY --from=tailscale-build /go/bin/tailscaled /usr/sbin/tailscaled
# ソースからビルドしたRuby。SSHのセッションでも見えるよう/usr/local/binにリンクする。
COPY --from=ruby-build /opt/ruby /opt/ruby
RUN for b in ruby gem irb erb rake bundle bundler rdoc ri; do if [ -x /opt/ruby/bin/$b ]; then ln -sf /opt/ruby/bin/$b /usr/local/bin/$b; fi; done \
    && ruby --version \
    && ruby -ropenssl -ryaml -rzlib -e 'puts "ruby ok"'
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/node22.tar.xz \
        "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    && echo "${NODE_SHA256}  /tmp/node22.tar.xz" | sha256sum -c - \
    && mkdir -p /opt/node22 && tar -xJf /tmp/node22.tar.xz -C /opt/node22 --strip-components=1 \
    && rm -f /tmp/node22.tar.xz \
    && node --version
RUN npm cache clean --force \
    && npm install -g npm@${NPM_VERSION} --ignore-scripts \
    && /opt/node22/bin/npm --version \
    && /opt/node22/bin/npm cache clean --force
RUN npm config set fetch-retries 5 && npm config set fetch-retry-mintimeout 10000 \
    && npm install -g @openai/codex@${CODEX_VERSION} \
    && codex --version \
    && npm cache clean --force
# T3 Code。npmのパッケージは起動用の小さなプログラムで、初回の実行時にGitHub Releasesから本体(約122MB)を
# ~/.t3/runtime へ取り込む。起動のたびにダウンロードしないよう、ビルド時に t3 --version を実行して
# イメージへ取り込む(専用のRUNにして、キャッシュは同じRUNで消す)。
RUN npm install -g t3@${T3_VERSION} \
    && t3 --version \
    && npm cache clean --force
# Global CLI for container/SSH use; project-local Vitest remains lockfile-managed.
ARG INSTALL_VITEST=true
RUN case "$INSTALL_VITEST" in true|false) ;; *) echo "INSTALL_VITEST must be true or false" >&2; exit 1 ;; esac; \
    if [ "$INSTALL_VITEST" = "true" ]; then \
    npm install -g vitest@${VITEST_VERSION} --ignore-scripts \
    && vitest --version \
    && npm cache clean --force; \
    fi
ARG INSTALL_TYPESCRIPT=true
RUN case "$INSTALL_TYPESCRIPT" in true|false) ;; *) echo "INSTALL_TYPESCRIPT must be true or false" >&2; exit 1 ;; esac; \
    if [ "$INSTALL_TYPESCRIPT" = "true" ]; then \
    npm install -g typescript@${TYPESCRIPT_VERSION} --ignore-scripts \
    && tsc --version \
    && npm cache clean --force; \
    fi
# SSHのセッションはDockerのENV PATHを引き継がず/opt/node22/binが見えない(which codexが空になる)。
# よく使うものは/usr/local/binにリンクし、あとからnpm install -gしたものもログインシェルで見えるようPATHも通す。
RUN for b in node npm npx codex vitest tsc tsserver; do if command -v "$b" >/dev/null 2>&1; then ln -sf /opt/node22/bin/$b /usr/local/bin/$b; fi; done \
    && printf 'export PATH=/opt/node22/bin:$PATH\n' > /etc/profile.d/node22.sh \
    && printf '\n# /opt/node22/bin(npm install -gしたCLI)をログインしない対話シェルでも使えるようにする\nexport PATH=/opt/node22/bin:$PATH\n' >> /etc/bash.bashrc
# npm 12 blocks install scripts by default; allow only Claude's native installer.
RUN /opt/node22/bin/npm install -g @anthropic-ai/claude-code@${CLAUDE_VERSION} --allow-scripts=@anthropic-ai/claude-code \
    && ln -sf /opt/node22/bin/claude /usr/local/bin/claude \
    && claude --version \
    && /opt/node22/bin/npm cache clean --force
# wrangler: Node 20以上が必要なためClaude CLIと同じ/opt/node22のnpmで入れる。
# npmも起動スクリプトも`env node`でPATH上のnode 18を拾うため、PATHの先頭に/opt/node22/binを置く。
ARG INSTALL_WRANGLER=true
RUN case "$INSTALL_WRANGLER" in true|false) ;; *) echo "INSTALL_WRANGLER must be true or false" >&2; exit 1 ;; esac; \
    if [ "$INSTALL_WRANGLER" = "true" ]; then \
    PATH=/opt/node22/bin:$PATH npm install -g wrangler \
    && printf '#!/bin/sh\nPATH=/opt/node22/bin:$PATH exec /opt/node22/bin/wrangler "$@"\n' > /usr/local/bin/wrangler \
    && chmod +x /usr/local/bin/wrangler \
    && wrangler --version \
    && PATH=/opt/node22/bin:$PATH npm cache clean --force; \
    fi

# Record the exact non-secret bundle choices for health checks and later analysis.
RUN printf '{"docker":%s,"vitest":%s,"typescript":%s,"wrangler":%s}\n' \
      "$INSTALL_DOCKER" "$INSTALL_VITEST" "$INSTALL_TYPESCRIPT" "$INSTALL_WRANGLER" > /etc/container-features.json

# /healthのバージョン表で「想定の版」として使う(実際の版と比べて色を付ける)。
ARG TAILSCALE_VERSION
ARG GH_VERSION
ARG JJ_VERSION
ARG RUBY_VERSION
RUN printf '{"node":"%s","codex":"%s","claude":"%s","cloudflared":"%s","tailscale":"%s","gh":"%s","jj":"%s","ruby":"%s"}\n' \
        "$NODE_VERSION" "$CODEX_VERSION" "$CLAUDE_VERSION" "$CLOUDFLARED_VERSION" "$TAILSCALE_VERSION" "$GH_VERSION" "$JJ_VERSION" "$RUBY_VERSION" \
        > /etc/image-versions.json \
    && cat /etc/image-versions.json

WORKDIR /app
# build-info.jsonはwrangler.tomlの[build]が書き出す。無い場合(直接docker build)もビルドは通す。
COPY server.js build-info*.json ./
# Read-only IPv4/IPv6 firewall counters, PTR/WHOIS and CIDR aggregation.
COPY firewall-stats.py firewall-log.py ./
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY t3-embed-proxy.cjs /usr/local/libexec/t3-embed-proxy.cjs
COPY t3-pwa-auth.cjs t3-stale-session.cjs t3-pwa-client.js t3-pwa-client.css /usr/local/libexec/
COPY tailscale-up.sh /usr/local/bin/tailscale-up.sh
COPY cf /usr/local/bin/cf
COPY apache-demo.conf /etc/apache2/sites-available/000-demo.conf
COPY cloudflared-ingress.yml.template /etc/cloudflared/ingress.yml.template
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/cf \
    && a2enmod ssl proxy proxy_http proxy_wstunnel rewrite cgid include remoteip \
    && a2dissite 000-default \
    && a2ensite 000-demo \
    && sed -i 's/^ServerTokens .*/ServerTokens Prod/; s/^ServerSignature .*/ServerSignature Off/' /etc/apache2/conf-available/security.conf \
    && mkdir -p /run/sshd

EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
