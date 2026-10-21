# Tailscaleはビルド専用ステージでGoのソース(proxy.golang.org)から作る。
# pkgs.tailscale.comからのtgz取得は、この環境では到達できないため使わない。
FROM golang:1.27.1-trixie AS tailscale-build
ARG TAILSCALE_VERSION=1.104.1
RUN CGO_ENABLED=0 go install -trimpath tailscale.com/cmd/tailscale@v${TAILSCALE_VERSION} tailscale.com/cmd/tailscaled@v${TAILSCALE_VERSION} \
    && /go/bin/tailscale version \
    && /go/bin/tailscaled --version

# Ubuntu-based container for /cf-containers. Runtime credentials are supplied
# at startup; do not COPY login state or secrets into this image.
# ghはGoのソース(proxy.golang.org)からビルドする。リリースのdebは使わない。
FROM golang:1.27.1-trixie AS gh-build
ARG GH_VERSION=2.103.0
RUN CGO_ENABLED=0 go install -trimpath github.com/cli/cli/v2/cmd/gh@v${GH_VERSION} \
    && /go/bin/gh --version

FROM ubuntu:26.04

# Use one supported Node runtime for the server and both CLIs. The archive
# digest is pinned independently of the download, so corruption fails the build.
ARG NODE_VERSION=26.12.1
ARG NODE_SHA256=6170b2d474e1c626f43cff3adc118df9fe3b573258a4fc3d850c8dbc6b079bbd
ARG NPM_VERSION=12.2.0
ARG CODEX_VERSION=0.163.0
ARG CLAUDE_VERSION=2.1.306
ARG CLOUDFLARED_VERSION=2026.10.1
# Retain the installation path used by existing runtime checks.
ENV PATH="/opt/node22/bin:${PATH}"

# Node.js 26 requires libatomic.so.1 (provided by libatomic1).
# Keep large packages in separate layers to avoid registry upload timeouts.
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        ca-certificates tmux expect gnupg libatomic1 \
        apache2 openssl openssh-server nftables curl \
        python3 python3-venv ruby cron sudo bubblewrap \
        iproute2 iputils-ping net-tools dnsutils traceroute \
        netcat-openbsd tcpdump mtr-tiny whois procps xz-utils git gh locales \
    && rm -rf /var/lib/apt/lists/*
# 日本語: SSHのシェル・tmuxで日本語を入力・表示できるようにja_JP.UTF-8を生成し、
# ログインシェル(/etc/profile.d)とsshd経由のセッション(/etc/default/locale)の両方で既定にする。
RUN locale-gen ja_JP.UTF-8 \
    && printf 'LANG=ja_JP.UTF-8\n' > /etc/default/locale \
    && printf 'export LANG=ja_JP.UTF-8\n' > /etc/profile.d/locale.sh
ENV LANG=ja_JP.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends docker.io \
    && rm -rf /var/lib/apt/lists/*
# Bootstrap the dependency firewall from a pinned, digest-checked release.
# Free edition blocks confirmed malware; unscanned packages are not blocked.
ARG SFW_VERSION=1.15.4
ARG SFW_SHA256=cf9f55b8343e1ef6e6dcccdb09b99c70c0430a22ed7d0079286eccddeaf72670
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/sfw \
        "https://github.com/SocketDev/sfw-free/releases/download/v${SFW_VERSION}/sfw-free-linux-x86_64" \
    && echo "${SFW_SHA256}  /tmp/sfw" | sha256sum -c - \
    && install -m 755 /tmp/sfw /usr/local/bin/sfw \
    && rm -f /tmp/sfw \
    && sfw --help
# chat用のPythonライブラリはUbuntuのapt版を使う(pipはPyPIへの証明書検証が
# このビルド環境で通らず、apt版ならアーカイブ経由で取得でき依存を固定しやすいため)。
RUN apt-get update && apt-get install -y --no-install-recommends python3-websockets python3-aiohttp \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -c "import websockets, aiohttp; print('websockets', websockets.__version__, 'aiohttp', aiohttp.__version__)"
COPY --from=gh-build /go/bin/gh /usr/bin/gh
ARG CLOUDFLARED_SHA256=200573c872174ab449965655febadef8edfbb144ebcaa391b700b2dedbadb3cd
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --output /tmp/cloudflared.deb \
        "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-amd64.deb" \
    && echo "${CLOUDFLARED_SHA256}  /tmp/cloudflared.deb" | sha256sum -c - \
    && dpkg -i /tmp/cloudflared.deb \
    && rm -f /tmp/cloudflared.deb
COPY --from=tailscale-build /go/bin/tailscale /usr/bin/tailscale
COPY --from=tailscale-build /go/bin/tailscaled /usr/sbin/tailscaled
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/node22.tar.xz \
        "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    && echo "${NODE_SHA256}  /tmp/node22.tar.xz" | sha256sum -c - \
    && mkdir -p /opt/node22 && tar -xJf /tmp/node22.tar.xz -C /opt/node22 --strip-components=1 \
    && rm -f /tmp/node22.tar.xz \
    && node --version
RUN npm cache clean --force \
    && sfw npm install -g npm@${NPM_VERSION} --ignore-scripts \
    && /opt/node22/bin/npm --version \
    && /opt/node22/bin/npm cache clean --force
RUN npm config set fetch-retries 5 && npm config set fetch-retry-mintimeout 10000 \
    && sfw npm install -g @openai/codex@${CODEX_VERSION} \
    && codex --version \
    && npm cache clean --force
# npm 12 blocks install scripts by default; allow only Claude's native installer.
RUN sfw /opt/node22/bin/npm install -g @anthropic-ai/claude-code@${CLAUDE_VERSION} --allow-scripts=@anthropic-ai/claude-code \
    && ln -sf /opt/node22/bin/claude /usr/local/bin/claude \
    && claude --version \
    && /opt/node22/bin/npm cache clean --force
# wrangler: Node 20以上が必要なためClaude CLIと同じ/opt/node22のnpmで入れる。
# npmも起動スクリプトも`env node`でPATH上のnode 18を拾うため、PATHの先頭に/opt/node22/binを置く。
RUN PATH=/opt/node22/bin:$PATH npm install -g wrangler \
    && printf '#!/bin/sh\nPATH=/opt/node22/bin:$PATH exec /opt/node22/bin/wrangler "$@"\n' > /usr/local/bin/wrangler \
    && chmod +x /usr/local/bin/wrangler \
    && wrangler --version \
    && PATH=/opt/node22/bin:$PATH npm cache clean --force

WORKDIR /app
COPY server.js ./
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY cf /usr/local/bin/cf
COPY apache-demo.conf /etc/apache2/sites-available/000-demo.conf
COPY cloudflared-ingress.yml.template /etc/cloudflared/ingress.yml.template
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/cf \
    && a2enmod ssl proxy proxy_http proxy_wstunnel rewrite cgid include \
    && a2dissite 000-default \
    && a2ensite 000-demo \
    && sed -i 's/^ServerTokens .*/ServerTokens Prod/; s/^ServerSignature .*/ServerSignature Off/' /etc/apache2/conf-available/security.conf \
    && mkdir -p /run/sshd

EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
