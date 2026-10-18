# Ubuntu-based container for /cf-containers. Runtime credentials are supplied
# at startup; do not COPY login state or secrets into this image.
FROM ubuntu:24.04

# Use one supported Node runtime for the server and both CLIs. The archive
# digest is pinned independently of the download, so corruption fails the build.
ARG NODE_VERSION=22.23.3
ARG NODE_SHA256=df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de
ARG NPM_VERSION=11.19.1
ARG CODEX_VERSION=0.163.0
ARG CLAUDE_VERSION=2.1.302
ARG CLOUDFLARED_VERSION=2026.10.1
ENV PATH="/opt/node22/bin:${PATH}"

# Keep large packages in separate layers to avoid registry upload timeouts.
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        ca-certificates tmux gnupg \
        apache2 openssl openssh-server nftables curl \
        iproute2 iputils-ping net-tools dnsutils traceroute \
        netcat-openbsd tcpdump mtr-tiny whois procps xz-utils git gh \
    && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y --no-install-recommends docker.io \
    && rm -rf /var/lib/apt/lists/*
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
RUN npm install -g npm@${NPM_VERSION} \
    && npm --version
RUN npm config set fetch-retries 5 && npm config set fetch-retry-mintimeout 10000 \
    && npm install -g @openai/codex@${CODEX_VERSION} \
    && codex --version \
    && npm cache clean --force
RUN /opt/node22/bin/npm install -g @anthropic-ai/claude-code@${CLAUDE_VERSION} \
    && ln -sf /opt/node22/bin/claude /usr/local/bin/claude \
    && claude --version \
    && /opt/node22/bin/npm cache clean --force

WORKDIR /app
COPY server.js ./
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY cf /usr/local/bin/cf
COPY apache-demo.conf /etc/apache2/sites-available/000-demo.conf
COPY cloudflared-ingress.yml.template /etc/cloudflared/ingress.yml.template
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/cf \
    && a2enmod ssl proxy proxy_http proxy_wstunnel rewrite \
    && a2dissite 000-default \
    && a2ensite 000-demo \
    && sed -i 's/^ServerTokens .*/ServerTokens Prod/; s/^ServerSignature .*/ServerSignature Off/' /etc/apache2/conf-available/security.conf \
    && mkdir -p /run/sshd

EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
