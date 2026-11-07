# 固定する版。最後に/etc/image-versions.jsonへ書き出すため、全ステージで共有する。
ARG TAILSCALE_VERSION=1.104.5
ARG GH_VERSION=2.103.3
ARG JJ_VERSION=0.47.1
ARG RUBY_VERSION=4.0.9
ARG GIT_VERSION=2.56.0
ARG OPENSSH_VERSION=10.6p2
ARG APACHE_VERSION=2.4.70

# Official precompiled Tailscale package; no Go source build.
FROM ubuntu:26.04 AS tailscale-binaries
ARG TAILSCALE_VERSION
ARG TAILSCALE_SHA256=720cbbccbfc03d8b55df72afc19e5a72e31b0f65934700aa6fa38074d4ad7bf7
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/tailscale.tgz \
        "https://pkgs.tailscale.com/stable/tailscale_${TAILSCALE_VERSION}_amd64.tgz" \
    && echo "${TAILSCALE_SHA256}  /tmp/tailscale.tgz" | sha256sum -c - \
    && mkdir -p /tmp/tailscale /usr/local/bin /usr/local/sbin \
    && tar -xzf /tmp/tailscale.tgz -C /tmp/tailscale --strip-components=1 \
    && install -m 755 /tmp/tailscale/tailscale /usr/local/bin/tailscale \
    && install -m 755 /tmp/tailscale/tailscaled /usr/local/sbin/tailscaled \
    && tailscale version && tailscaled --version \
    && rm -rf /tmp/tailscale /tmp/tailscale.tgz /var/lib/apt/lists/*

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
ARG T3_VERSION=0.1.7
ARG CLAUDE_VERSION=2.1.318
ARG VITEST_VERSION=5.0.5
ARG TYPESCRIPT_VERSION=7.0.2
ARG CLOUDFLARED_VERSION=2026.10.7
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
        netcat-openbsd tcpdump mtr-tiny whois procps xz-utils perl libcurl4t64 libpcre2-8-0 libexpat1 zlib1g locales sshguard silversearcher-ag ripgrep jq \
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
# ghとjjは公式のコンパイル済みバイナリを使う。jjは退避パッケージから再利用。
# sha256はghの公式チェックサム、jjのGitHub release asset digestと照合して固定。
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
ARG JJ_SHA256=d4b657f622ee50929c8916466dfa3d6a6c17a0a32b50e7b2c793707ec9ebcad7
# Retained official release: reuse the exact package without downloading again.
COPY packages/jj-v${JJ_VERSION}-x86_64-unknown-linux-musl.tar.gz /tmp/jj.tar.gz
RUN echo "${JJ_SHA256}  /tmp/jj.tar.gz" | sha256sum -c - \
    && mkdir -p /tmp/jj && tar -xzf /tmp/jj.tar.gz -C /tmp/jj \
    && install -m 755 /tmp/jj/jj /usr/bin/jj \
    && jj --version \
    && rm -rf /tmp/jj /tmp/jj.tar.gz
# gitはaptの版(2.53)ではなく、kernel.orgの公式ソースからビルドして退避したパッケージを使う。
# 手順と元のソースはpackages/README.md。イメージのビルドではコンパイルも取得もしない。
# 実行時の共有ライブラリとperlは上のapt-getで入れている。
ARG GIT_VERSION
ARG GIT_PACKAGE_SHA256=28ac5557705ad3e374b5d63b4f90eed6ecd5814e1e9d7b86807eae598aeae4ab
COPY packages/git-${GIT_VERSION}-linux-x64-ubuntu26.04.tar.xz /tmp/git.tar.xz
RUN echo "${GIT_PACKAGE_SHA256}  /tmp/git.tar.xz" | sha256sum -c - \
    && tar -xJf /tmp/git.tar.xz -C / \
    && test "$(git --version)" = "git version ${GIT_VERSION}" \
    && git --version --build-options | grep -q '^rust: enabled$' \
    && test -x "$(git --exec-path)/git-remote-https" \
    && rm -f /tmp/git.tar.xz
# 更新するときは先にNOTICE.openssh-update.20261106.mdを読む。
# OpenSSHはaptの版(10.2p1)が上流より古いため、OpenBSDの公式ソースからビルドして退避したパッケージを/usr/localへ入れる。
# aptのopenssh-serverは残す(/etc/ssh、PAMの設定、sshdユーザー、実行時の共有ライブラリのため)。起動は/usr/local/sbin/sshd。
# このビルドはGSSAPIなしのため、Ubuntuのssh_configのGSSAPIの行を消す(残すと実行のたびに警告が出る)。
ARG OPENSSH_VERSION
ARG OPENSSH_PACKAGE_SHA256=dda764b1cb74264fc16ac780e8bcfa004e844e147660ac42dad138d601954caa
COPY packages/openssh-${OPENSSH_VERSION}-linux-x64-ubuntu26.04.tar.xz /tmp/openssh.tar.xz
RUN echo "${OPENSSH_PACKAGE_SHA256}  /tmp/openssh.tar.xz" | sha256sum -c - \
    && tar -xJf /tmp/openssh.tar.xz -C / \
    && sed -i '/^[[:space:]]*GSSAPIAuthentication/d' /etc/ssh/ssh_config \
    && sed -i 's#^Subsystem[[:space:]]\+sftp[[:space:]].*#Subsystem\tsftp\t/usr/local/libexec/openssh/sftp-server#' /etc/ssh/sshd_config \
    && test "$(ssh -V 2>&1 | cut -d, -f1)" = "OpenSSH_${OPENSSH_VERSION}" \
    && test "$(/usr/local/sbin/sshd -V 2>&1 | head -1 | cut -d, -f1)" = "OpenSSH_${OPENSSH_VERSION}" \
    && if ssh -G localhost 2>&1 | grep -q 'Unsupported option'; then exit 1; fi \
    && test -x /usr/local/libexec/openssh/sshd-session \
    && test -x /usr/local/libexec/openssh/sftp-server \
    && grep -q '^Subsystem.*/usr/local/libexec/openssh/sftp-server' /etc/ssh/sshd_config \
    && rm -f /tmp/openssh.tar.xz
# Apache httpdはaptの版(2.4.66)が上流より古いため、Apacheの公式ソースからビルドして退避したパッケージを使う。
# 手順と元のソースはpackages/README.md。コンテナのCPUではソースビルドが重いため、イメージのビルドではコンパイルも取得もしない。
# aptのapache2は残す(/etc/apache2の設定、a2enmod・apache2ctl・envvars、実行時の共有ライブラリのため)。
# 置き換えるのは/usr/sbin/apache2と/usr/lib/apache2/modules/*.soだけで、apt upgradeで戻らないようholdする。
ARG APACHE_VERSION
ARG APACHE_PACKAGE_SHA256=41ca9694e095a1318f67b3a7784c0163ec2d338e14d984ac51c040df1a3ab706
COPY packages/apache-${APACHE_VERSION}-linux-x64-ubuntu26.04.tar.xz /tmp/apache.tar.xz
RUN set -eu; \
    echo "${APACHE_PACKAGE_SHA256}  /tmp/apache.tar.xz" | sha256sum -c -; \
    tar -xJf /tmp/apache.tar.xz -C /; \
    apt-mark hold apache2 apache2-bin apache2-data apache2-utils; \
    test "$(apache2 -v | sed -n 's#^Server version: Apache/\([0-9.]*\) .*#\1#p')" = "${APACHE_VERSION}"; \
    apache2 -l | grep -q 'mod_unixd.c'; \
    for m in ssl proxy proxy_http proxy_wstunnel rewrite cgid include remoteip mpm_event; do test -f "/usr/lib/apache2/modules/mod_$m.so"; done; \
    if ldd /usr/sbin/apache2 /usr/lib/apache2/modules/*.so | grep -q 'not found'; then exit 1; fi; \
    mkdir -p /run/apache2 /run/lock/apache2 /var/log/apache2; \
    env -i PATH=/usr/sbin:/usr/bin:/bin sh -c '. /etc/apache2/envvars; exec apache2 -t'; \
    rm -f /tmp/apache.tar.xz
# aptのopenssh-serverはビルド時にホスト鍵を作る。秘密鍵をイメージに残さない(entrypoint.shが起動時に用意する)。
COPY sshd-hardening.conf /etc/ssh/sshd_config.d/10-hardening.conf
RUN rm -f /etc/ssh/ssh_host_*
ARG CLOUDFLARED_SHA256=70b1a1e0f46033ffc8d90b406e554044ba6cbf2e4360295ef1163aed31e09393
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --output /tmp/cloudflared.deb \
        "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-amd64.deb" \
    && echo "${CLOUDFLARED_SHA256}  /tmp/cloudflared.deb" | sha256sum -c - \
    && dpkg -i /tmp/cloudflared.deb \
    && rm -f /tmp/cloudflared.deb
COPY --from=tailscale-binaries /usr/local/bin/tailscale /usr/bin/tailscale
COPY --from=tailscale-binaries /usr/local/sbin/tailscaled /usr/sbin/tailscaled
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
ARG CLAUDE_NATIVE_SHA256=708c77b204db30086ff6f1ed34577bda03e1be74ced80557cbf7b54249ebf0bd
RUN /opt/node22/bin/npm install -g @anthropic-ai/claude-code@${CLAUDE_VERSION} --allow-scripts=@anthropic-ai/claude-code \
    && ln -sf /opt/node22/bin/claude /usr/local/bin/claude \
    && echo "${CLAUDE_NATIVE_SHA256}  /opt/node22/lib/node_modules/@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-linux-x64/claude" | sha256sum -c - \
    && claude --version \
    && /opt/node22/bin/npm cache clean --force
# Real browser for preprint; use Google's published Debian package checksum.
ARG CHROME_VERSION=157.0.8103.38-1
ARG CHROME_SHA256=a62b277dc03da2cff50cc04589deb66f6875be339c066d46adb49b49eedb629d
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/chrome.deb \
        "https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_${CHROME_VERSION}_amd64.deb" \
    && echo "${CHROME_SHA256}  /tmp/chrome.deb" | sha256sum -c - \
    && apt-get update && apt-get install -y --no-install-recommends /tmp/chrome.deb \
    && google-chrome --version \
    && google-chrome --headless --no-sandbox --disable-dev-shm-usage --user-data-dir=/tmp/chrome-image-smoke --dump-dom about:blank >/tmp/chrome-smoke.html \
    && test -s /tmp/chrome-smoke.html \
    && rm -rf /tmp/chrome.deb /tmp/chrome-smoke.html /tmp/chrome-image-smoke /var/lib/apt/lists/*
ARG PREPRINT_VERSION=0.1.2
ARG PREPRINT_SHA256=451a0ec62252e8747080daa4f8dc08c85949db9fea67ecedac45d4ce56e3ba9f
COPY preprint-cli /usr/local/libexec/preprint-cli
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/preprint.tgz \
        "https://registry.npmjs.org/@supermemory/preprint/-/preprint-${PREPRINT_VERSION}.tgz" \
    && echo "${PREPRINT_SHA256}  /tmp/preprint.tgz" | sha256sum -c - \
    && npm install -g /tmp/preprint.tgz --ignore-scripts \
    && mv /opt/node22/bin/preprint /opt/node22/bin/preprint-native \
    && install -m 755 /usr/local/libexec/preprint-cli /opt/node22/bin/preprint \
    && ln -sf /opt/node22/bin/preprint /usr/local/bin/preprint \
    && preprint --help && preprint --version \
    && npm cache clean --force && rm -f /tmp/preprint.tgz
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
ARG GIT_VERSION
ARG OPENSSH_VERSION
ARG APACHE_VERSION
RUN printf '{"node":"%s","codex":"%s","claude":"%s","cloudflared":"%s","tailscale":"%s","gh":"%s","jj":"%s","ruby":"%s","preprint":"%s","t3":"%s","git":"%s","openssh":"%s","apache":"%s"}\n' \
        "$NODE_VERSION" "$CODEX_VERSION" "$CLAUDE_VERSION" "$CLOUDFLARED_VERSION" "$TAILSCALE_VERSION" "$GH_VERSION" "$JJ_VERSION" "$RUBY_VERSION" "$PREPRINT_VERSION" "$T3_VERSION" "$GIT_VERSION" "$OPENSSH_VERSION" "$APACHE_VERSION" \
        > /etc/image-versions.json \
    && cat /etc/image-versions.json

WORKDIR /app
# build-info.jsonはwrangler.tomlの[build]が書き出す。無い場合(直接docker build)もビルドは通す。
COPY server.js build-info*.json ./
# Read-only IPv4/IPv6 firewall counters, PTR/WHOIS and CIDR aggregation.
COPY firewall-stats.py firewall-log.py ./
COPY container_setup.py /usr/local/libexec/container_setup.py
# SSI setup is self-contained and can be reused by other container images.
RUN python3 /usr/local/libexec/container_setup.py
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
