#!/bin/sh
if [ -z "${ORIGIN_HMAC_SECRET:-}${HMAC_SECRET:-}" ]; then
    set -a
    . /etc/lib-hmac.env
    set +a
fi
export LIB_TUNNELS_CACHE=/var/cache/lib-api/tunnels.json
exec /usr/local/bin/ruby /var/www/html/lib/api/tunnels.rb
