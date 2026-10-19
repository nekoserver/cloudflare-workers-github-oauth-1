# Demo container

The image contains Codex CLI, Claude CLI, GitHub CLI (`gh`), Docker CLI,
Wrangler, and the repository's small Cloudflare API helper (`cf`). Its home
and tool configuration directories live under `/workspace`.

The Docker package provides the client command only. To use it, expose a Docker
daemon through `DOCKER_HOST` or a socket supplied by the runtime. The image does
not start a privileged Docker daemon.

`cf` uses `CF_CONTAINER_API_TOKEN` (preferred) or `CLOUDFLARE_API_TOKEN`
with `CLOUDFLARE_ACCOUNT_ID`. Wrangler uses its normal Cloudflare environment
variables and authentication.

## Optional R2 persistence

Set all four variables below to restore `/workspace` from R2 when the container
starts and save it back periodically and during a graceful shutdown:

- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Optional settings:

- `R2_PREFIX`: a bucket prefix used only by this container
- `R2_SYNC_INTERVAL`: save interval in seconds (default: `300`, minimum: `10`)

Use an R2 API token restricted to Object Read & Write access for the selected
bucket. Pass the access key and secret at runtime; never add them to this image
or commit them. If none of these variables is set, the container starts with an
ephemeral `/workspace`. Supplying only part of the configuration fails startup
instead of silently using ephemeral storage.

Persistence uses R2's regular S3-compatible API through `rclone`; it does not
use FUSE or mount R2 as a filesystem. The working files remain on the
container's local disk while it is running. Use a unique prefix per container
and avoid running two containers against the same prefix because the last sync
wins. Abrupt termination can lose changes made since the previous periodic
save.
