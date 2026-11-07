# Retained official release packages

`jj-v0.47.1-x86_64-unknown-linux-musl.tar.gz` is the original, unmodified official
Linux x86_64 package, retained for image rebuilds and manual reinstalls.

- Source: https://github.com/jj-vcs/jj/releases/tag/v0.47.1
- Archive: https://github.com/jj-vcs/jj/releases/download/v0.47.1/jj-v0.47.1-x86_64-unknown-linux-musl.tar.gz
- SHA256: `d4b657f622ee50929c8916466dfa3d6a6c17a0a32b50e7b2c793707ec9ebcad7`
- Checked: 2026-11-05 against the GitHub release asset digest and downloaded bytes.
- License and README are included inside the original archive.

The Dockerfile copies this package from its build context and checks SHA256
before extraction. It does not download jj or compile Rust. Keep this file and
SHA256SUMS when cleaning temporary downloads; they are reusable build inputs.
Run `sha256sum -c SHA256SUMS` in this directory before manual reuse.

## git 2.56.0

`git-2.56.0-linux-x64-ubuntu26.04.tar.xz` is a local build, not an upstream
release. It unpacks to `/usr/local` and replaces the APT `git` package in the
image, so the Dockerfile neither downloads nor compiles git.

`git-2.56.0.tar.xz` is the unmodified source it was built from.

- Source: https://www.kernel.org/pub/software/scm/git/git-2.56.0.tar.xz
- Source SHA256: `26c56c296b38c0695b26fa95f475f1d01704d2d38e73465ca30b0b2f5dc789d3`
- Checked: 2026-11-06 against kernel.org `sha256sums.asc`, fetched over HTTPS.
  The PGP signature on that file was not verified.
- Built: 2026-11-06 on Ubuntu 26.04 x86_64 with Rust 1.93.1 enabled, which is
  the upstream default since Git 2.55.

Rebuild on Ubuntu 26.04 from the unpacked source:

```sh
apt-get install -y --no-install-recommends build-essential cargo rustc \
  libcurl4-openssl-dev libssl-dev zlib1g-dev libexpat1-dev libpcre2-dev gettext
F="prefix=/usr/local NO_TCLTK=1 USE_LIBPCRE2=1 CFLAGS=-O2 LDFLAGS=-s INSTALL_STRIP=-s"
make -j"$(nproc)" $F all
make $F DESTDIR="$PWD/pkg" install
tar --owner=0 --group=0 --numeric-owner -cJf git-VERSION-linux-x64-ubuntu26.04.tar.xz -C pkg usr
```

After a rebuild, update `GIT_VERSION` and `GIT_PACKAGE_SHA256` in the Dockerfile
and `SHA256SUMS` here. The package targets Ubuntu 26.04 x86_64 only.

## OpenSSH 10.6p2

Before updating, read `NOTICE.openssh-update.20261106.md` in the repository root.

`openssh-10.6p2-linux-x64-ubuntu26.04.tar.xz` is a local build, not an upstream
release. It unpacks to `/usr/local` over the APT `openssh-server` package, which
stays for `/etc/ssh`, the PAM configuration and the `sshd` user.

`openssh-10.6p2.tar.gz` and `.asc` are the unmodified source and its signature.

- Source: https://cdn.openbsd.org/pub/OpenBSD/OpenSSH/portable/openssh-10.6p2.tar.gz
- Source SHA256: `9ae44872090cf2f06b3cf9ff147e7f16f309671340763ed2f99248398ae29d5b`
- Checked: 2026-11-06 against the release notes' SHA256 and the PGP signature by
  `7168B983815A5EEF59A4ADFD2A3F414E736060BA` (Damien Miller, `RELEASE_KEY.asc`).
- Ubuntu's patches are not included, and it has no GSSAPI support.

Rebuild on Ubuntu 26.04 from the unpacked source:

```sh
apt-get install -y --no-install-recommends build-essential libpam0g-dev libssl-dev zlib1g-dev
./configure --prefix=/usr/local --sysconfdir=/etc/ssh --libexecdir=/usr/local/libexec/openssh \
  --with-pam --with-privsep-path=/run/sshd --with-privsep-user=sshd --with-pid-dir=/run \
  --with-default-path=/usr/local/bin:/usr/bin:/bin:/usr/games \
  --with-superuser-path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  --with-xauth=/usr/bin/xauth
make -j"$(nproc)"
make DESTDIR="$PWD/pkg" install-nosysconf
rm -rf pkg/etc pkg/run pkg/var
tar --owner=0 --group=0 --numeric-owner -cJf openssh-VERSION-linux-x64-ubuntu26.04.tar.xz -C pkg usr
```

After a rebuild, update `OPENSSH_VERSION` and `OPENSSH_PACKAGE_SHA256` in the
Dockerfile and `SHA256SUMS` here. The package targets Ubuntu 26.04 x86_64 only.

## Apache httpd 2.4.70

`apache-2.4.70-linux-x64-ubuntu26.04.tar.xz` is a local build, not an upstream
release. It holds only `/usr/sbin/apache2` and `/usr/lib/apache2/modules/*.so`
and unpacks over the APT `apache2` packages, which stay for `/etc/apache2`,
`a2enmod`, `apache2ctl`, `envvars` and the runtime libraries. The Dockerfile
holds those APT packages so an upgrade cannot put the old binary back.

`httpd-2.4.70.tar.gz` and `.asc` are the unmodified source and its signature.

- Source: https://downloads.apache.org/httpd/httpd-2.4.70.tar.gz
  (permanent copy: https://archive.apache.org/dist/httpd/httpd-2.4.70.tar.gz)
- Source SHA512: `5998908195bd99e719714befbcf328b98012625c5848e8ca34509e15ad5faff61a4c7575cccc43dae3c79f6a66bb89b7ed67d730e65ca9dabf5f6b8c33fbcf09`
- Checked: 2026-11-07 against the `.sha512` files on both hosts and the PGP
  signature by `65B2D44FE74BD5E3DE3AC3F082781DE46D5954FA` (Eric Covener, httpd `KEYS`).
- Built: 2026-11-07 on Ubuntu 26.04 x86_64 against the APT APR 1.7.6,
  APR-util 1.6.3 and PCRE2. No Ubuntu patches, no suexec, no mod_systemd.

Rebuild on Ubuntu 26.04 from the unpacked source. Do not do this inside the
cf-container (not enough CPU); build on another Ubuntu 26.04 x86_64 machine:

```sh
apt-get install -y --no-install-recommends build-essential libapr1-dev libaprutil1-dev \
  libpcre2-dev libssl-dev zlib1g-dev libnghttp2-dev libxml2-dev libbrotli-dev \
  libjansson-dev libcurl4-openssl-dev liblua5.4-dev
./configure --enable-layout=Debian --with-program-name=apache2 \
  --with-apr=/usr/bin/apr-1-config --with-apr-util=/usr/bin/apu-1-config --with-pcre=/usr/bin/pcre2-config \
  --enable-mpms-shared=all --enable-mods-shared=reallyall \
  --enable-watchdog=static --enable-log-config=static --enable-logio=static --enable-version=static --enable-unixd=static \
  --enable-ssl=shared --enable-proxy=shared --enable-proxy-http=shared --enable-proxy-wstunnel=shared --enable-rewrite=shared \
  --enable-cgid=shared --enable-include=shared --enable-remoteip=shared --enable-http2=shared \
  --disable-suexec --disable-systemd
# Ubuntu's binary looks for /etc/apache2/apache2.conf through these two defines.
# The Debian layout leaves HTTPD_ROOT empty, so set them and check the result.
sed -i 's|^#define HTTPD_ROOT ""$|#define HTTPD_ROOT "/etc/apache2"|; s|^#define SERVER_CONFIG_FILE "/etc/apache2/apache2.conf"$|#define SERVER_CONFIG_FILE "apache2.conf"|' include/ap_config_auto.h
grep -qx '#define HTTPD_ROOT "/etc/apache2"' include/ap_config_auto.h
grep -qx '#define SERVER_CONFIG_FILE "apache2.conf"' include/ap_config_auto.h
make -j"$(nproc)"
make DESTDIR="$PWD/dest" install
mkdir -p pkg/usr/sbin pkg/usr/lib/apache2/modules
install -m 755 -s dest/usr/sbin/apache2 pkg/usr/sbin/apache2
install -m 644 dest/usr/lib/apache2/modules/*.so pkg/usr/lib/apache2/modules/
strip --strip-unneeded pkg/usr/lib/apache2/modules/*.so
tar --sort=name --mtime=2026-11-07T00:00:00Z --owner=0 --group=0 --numeric-owner \
  -cJf apache-VERSION-linux-x64-ubuntu26.04.tar.xz -C pkg usr
```

The modules `mod_unixd`, `mod_log_config`, `mod_logio`, `mod_version` and
`mod_watchdog` must be static: Ubuntu compiles them in, so `/etc/apache2` has
no `LoadModule` for them and `User` fails as an unknown directive otherwise.
Ubuntu's `mod_suexec.so` is not rebuilt and is left as the APT file; it is not enabled.

Checked before packaging: `apache2 -V` shows `HTTPD_ROOT="/etc/apache2"` and
`SERVER_CONFIG_FILE="apache2.conf"`; with a copy of the container's `/etc/apache2`
it reports `Syntax OK` and loads ssl, proxy_wstunnel, cgid, include and remoteip;
started on a spare port as `www-data`, it served an SSI page through a RewriteRule;
`ldd` finds every library.

After a rebuild, update `APACHE_VERSION` and `APACHE_PACKAGE_SHA256` in the
Dockerfile and `SHA256SUMS` here. The package targets Ubuntu 26.04 x86_64 only.
