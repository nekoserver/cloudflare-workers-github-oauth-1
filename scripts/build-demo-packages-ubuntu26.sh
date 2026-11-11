#!/bin/bash
# containers/demo/packages/ の git と Apache httpd を、Ubuntu 26.04 x86_64 でソースから作る。
# cf-container やエージェントのコンテナでは実行しない(CLAUDE.md コンテナビルドのルール8。CPU が足りない・OS が違う)。
# 手順は containers/demo/packages/README.md と同じ。取得物は上流が公開するハッシュで照合する。
#
#   sudo apt-get update   # 初回だけ(root なら sudo は不要。GitHub Actions の demo-packages は ubuntu:26.04 のコンテナで root として動かす)
#   bash scripts/build-demo-packages-ubuntu26.sh /tmp/demo-packages
#
# 出力: <出力先>/git-<版>-linux-x64-ubuntu26.04.tar.xz、apache-<版>-linux-x64-ubuntu26.04.tar.xz、
#       上流のソース(git-<版>.tar.xz、httpd-<版>.tar.gz)と SHA256SUMS の行。
# できたファイルを containers/demo/packages/ に置き、Dockerfile の GIT_VERSION・GIT_PACKAGE_SHA256・
# APACHE_VERSION・APACHE_PACKAGE_SHA256 と SHA256SUMS・README を直してから、イメージを作り直す。
set -euo pipefail

GIT_VERSION=2.56.1
# kernel.org sha256sums.asc の値(2026-11-11 に確認。取得物とも一致)
GIT_SHA256=f0b0bf89264b9bd2e1c640363e7529643989da76281600473c50745cd34a607f
HTTPD_VERSION=2.4.71
# downloads.apache.org と archive.apache.org の httpd-2.4.71.tar.gz.sha512 の値(2026-11-11 に確認。取得物とも一致)
HTTPD_SHA512=3dbd1b5f9fda192ae9399612c62ccfc90d329f35b6fda5b6d482f4c28b598b50e479738f8cf64c9b7febcff564811de43f2d84b3a2e24d41c29abdf77a50ef92

OUT="${1:?usage: build-demo-packages-ubuntu26.sh <output dir>}"
. /etc/os-release
if [ "$ID" != ubuntu ] || [ "$VERSION_ID" != 26.04 ] || [ "$(uname -m)" != x86_64 ]; then
  echo "Ubuntu 26.04 x86_64 でだけ実行する(今: $ID $VERSION_ID $(uname -m))。実行時のライブラリと合わせるため" >&2
  exit 1
fi
# 判定用の文字列(テストが検査する): VERSION_ID="26.04" かつ x86_64
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO=sudo; fi
$SUDO apt-get install -y --no-install-recommends build-essential cargo rustc \
  libcurl4-openssl-dev libssl-dev zlib1g-dev libexpat1-dev libpcre2-dev gettext \
  libapr1-dev libaprutil1-dev libnghttp2-dev libxml2-dev libbrotli-dev \
  libjansson-dev liblua5.4-dev curl xz-utils

# --- git ---
cd "$WORK"
curl -fsSLO "https://www.kernel.org/pub/software/scm/git/git-${GIT_VERSION}.tar.xz"
echo "${GIT_SHA256}  git-${GIT_VERSION}.tar.xz" | sha256sum -c -
tar -xJf "git-${GIT_VERSION}.tar.xz"
cd "git-${GIT_VERSION}"
F="prefix=/usr/local NO_TCLTK=1 USE_LIBPCRE2=1 CFLAGS=-O2 LDFLAGS=-s INSTALL_STRIP=-s"
# shellcheck disable=SC2086
make -j"$(nproc)" $F all
# shellcheck disable=SC2086
make $F DESTDIR="$PWD/pkg" install
test "$("$PWD/pkg/usr/local/bin/git" --version)" = "git version ${GIT_VERSION}"
tar --owner=0 --group=0 --numeric-owner -cJf "$OUT/git-${GIT_VERSION}-linux-x64-ubuntu26.04.tar.xz" -C pkg usr
cp "$WORK/git-${GIT_VERSION}.tar.xz" "$OUT/"

# --- Apache httpd ---
cd "$WORK"
tarball="httpd-${HTTPD_VERSION}.tar.gz"
if ! curl -fsSLO "https://downloads.apache.org/httpd/${tarball}"; then
  curl -fsSLO "https://archive.apache.org/dist/httpd/${tarball}"
fi
echo "${HTTPD_SHA512}  ${tarball}" | sha512sum -c -
tar -xzf "$tarball"
cd "httpd-${HTTPD_VERSION}"
./configure --enable-layout=Debian --with-program-name=apache2 \
  --with-apr=/usr/bin/apr-1-config --with-apr-util=/usr/bin/apu-1-config --with-pcre=/usr/bin/pcre2-config \
  --enable-mpms-shared=all --enable-mods-shared=reallyall \
  --enable-watchdog=static --enable-log-config=static --enable-logio=static --enable-version=static --enable-unixd=static \
  --enable-ssl=shared --enable-proxy=shared --enable-proxy-http=shared --enable-proxy-wstunnel=shared --enable-rewrite=shared \
  --enable-cgid=shared --enable-include=shared --enable-remoteip=shared --enable-http2=shared \
  --disable-suexec --disable-systemd
sed -i 's|^#define HTTPD_ROOT ""$|#define HTTPD_ROOT "/etc/apache2"|; s|^#define SERVER_CONFIG_FILE "/etc/apache2/apache2.conf"$|#define SERVER_CONFIG_FILE "apache2.conf"|' include/ap_config_auto.h
grep -qx '#define HTTPD_ROOT "/etc/apache2"' include/ap_config_auto.h
grep -qx '#define SERVER_CONFIG_FILE "apache2.conf"' include/ap_config_auto.h
make -j"$(nproc)"
make DESTDIR="$PWD/dest" install
mkdir -p pkg/usr/sbin pkg/usr/lib/apache2/modules
install -m 755 -s dest/usr/sbin/apache2 pkg/usr/sbin/apache2
install -m 644 dest/usr/lib/apache2/modules/*.so pkg/usr/lib/apache2/modules/
strip --strip-unneeded pkg/usr/lib/apache2/modules/*.so
"$PWD/pkg/usr/sbin/apache2" -v | grep -q "Apache/${HTTPD_VERSION} "
"$PWD/pkg/usr/sbin/apache2" -V | grep -q 'HTTPD_ROOT="/etc/apache2"'
tar --sort=name --mtime=2026-11-11T00:00:00Z --owner=0 --group=0 --numeric-owner \
  -cJf "$OUT/apache-${HTTPD_VERSION}-linux-x64-ubuntu26.04.tar.xz" -C pkg usr
cp "$WORK/$tarball" "$OUT/"

cd "$OUT"
sha256sum "git-${GIT_VERSION}-linux-x64-ubuntu26.04.tar.xz" "git-${GIT_VERSION}.tar.xz" \
  "apache-${HTTPD_VERSION}-linux-x64-ubuntu26.04.tar.xz" "$tarball" | tee SHA256SUMS.new
echo "完成: $OUT (SHA256SUMS.new の行を containers/demo/packages/SHA256SUMS に足す)"
