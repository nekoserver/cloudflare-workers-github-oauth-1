# Ubuntu-based container for /cf-containers. Runtime credentials are supplied
# at startup; do not COPY login state or secrets into this image.
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
# Keep chat dependencies isolated from Ubuntu's system Python.
COPY chat-requirements.txt /tmp/lib-chat-requirements.txt
RUN python3 -m venv /opt/lib-chat \
    && sfw /opt/lib-chat/bin/python -m pip install --no-cache-dir -r /tmp/lib-chat-requirements.txt \
    && /opt/lib-chat/bin/python -m pip check \
    && /opt/lib-chat/bin/python -c "import websockets, aiohttp; print('websockets', websockets.__version__, 'aiohttp', aiohttp.__version__)" \
    && rm -f /tmp/lib-chat-requirements.txt
# Use Caddy's official stable repository for current stable packages.
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors \
        -o /tmp/caddy-stable.gpg.key https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    && gpg --batch --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg /tmp/caddy-stable.gpg.key \
    && curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors \
        -o /etc/apt/sources.list.d/caddy-stable.list https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    && chmod 644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list \
    && apt-get update && apt-get install -y --no-install-recommends caddy \
    && caddy version \
    && rm -f /tmp/caddy-stable.gpg.key \
    && rm -rf /var/lib/apt/lists/*
# Install the upstream stable GitHub CLI rather than the Ubuntu archive version.
ARG GH_VERSION=2.102.0
ARG GH_SHA256=7e54a307f90afdc59796c325ec0c49fb09e6c18537727207a8ac7513584ea5b0
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/gh.deb \
        "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.deb" \
    && echo "${GH_SHA256}  /tmp/gh.deb" | sha256sum -c - \
    && dpkg -i /tmp/gh.deb \
    && gh --version \
    && rm -f /tmp/gh.deb
ARG CLOUDFLARED_SHA256=200573c872174ab449965655febadef8edfbb144ebcaa391b700b2dedbadb3cd
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --output /tmp/cloudflared.deb \
        "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-amd64.deb" \
    && echo "${CLOUDFLARED_SHA256}  /tmp/cloudflared.deb" | sha256sum -c - \
    && dpkg -i /tmp/cloudflared.deb \
    && rm -f /tmp/cloudflared.deb
# Pin the static Tailscale distribution and validate its published digest.
ARG TAILSCALE_VERSION=1.104.1
ARG TAILSCALE_SHA256=108d1d96ecf410d305571e173516f27038f870919a9b89c914a167c6d33a4528
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/tailscale.tgz \
        "https://pkgs.tailscale.com/stable/tailscale_${TAILSCALE_VERSION}_amd64.tgz" \
    && echo "${TAILSCALE_SHA256}  /tmp/tailscale.tgz" | sha256sum -c - \
    && mkdir -p /tmp/tailscale \
    && tar -xzf /tmp/tailscale.tgz -C /tmp/tailscale --strip-components=1 \
    && install -m 755 /tmp/tailscale/tailscale /usr/bin/tailscale \
    && install -m 755 /tmp/tailscale/tailscaled /usr/sbin/tailscaled \
    && tailscale version \
    && rm -rf /tmp/tailscale /tmp/tailscale.tgz
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
