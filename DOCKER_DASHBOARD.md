# Docker dashboard through the main Worker

Open `/cf-containers/docker.html`, or use the Docker コマンドセンター link on `/cf-containers`.
The page, CSS, module, and `/cf-containers/api/docker/*` routes all use the existing login and numeric GitHub administrator authorization.

The Worker serves fixed assets from `https://mygw.nekomaneki.work/lib/` and marks the HTML for Worker authentication.
The frontend resolves its API relative to the page: `/lib/api/docker/` when opened on the origin, `/cf-containers/api/docker/` when opened on the Worker.
No HMAC key or origin session cookie is sent to the browser in Worker mode.

The existing `RUST_WORKER` service binding calls `/tunnel-signer/send` with fixed destinations:

- POST `/lib/api/docker/worker/catalog` with `{}`
- POST `/lib/api/docker/worker/run` with the validated command and optional target

The Docker backend verifies the canonical HMAC for these routes, including requests with no browser Origin header. All existing fixed-command limits remain in force. The browser-session endpoints remain separate.
The Worker checks same-origin mutations, limits request size, ignores user-provided destinations, rejects redirects for static assets, and returns no-store responses.

## Deployment and verification, 2026-10-19

Origin files and Docker backend were updated in the running container. Source: `/var/lib/www` (also `/var/www/html/lib`).
Deploy Worker only:

```sh
npx wrangler deploy --containers-rollout=none --keep-vars
```

The installed Wrangler implementation and official documentation confirm that `none` skips container builds and container updates. No Docker build or image rollout was performed.
Worker version: `6e6c8e0a-0ad2-4d3b-81df-a545ddc2f442`.

- 24 targeted tests passed, including administrator denial, same-origin checks, fixed destinations, input limits, and page script syntax.
- Worker-only dry-run and deployment succeeded.
- Live page and API reject unauthenticated access with 401.
- Real rust-worker-sqlx-d1 signer reached the origin Docker API and returned docker version with exit 0.
- Live origin accepted signed worker catalog/run and rejected unsigned calls with 401; standalone dashboard auth still passed.
- DOM integration verified automatic Worker authentication, relative API mount, button execution and result rendering.
- Full repository typecheck still fails in pre-existing unrelated locations (including index.ts ColumnKeyType); new proxy files have no reported type errors.
- Browser interaction under a real administrator login was not available in this session.
- The origin's new page/backend/startup files still need image-source persistence for container recreation; this Worker-only deployment does not bake them into the container image.

Reference: https://developers.cloudflare.com/containers/configuration/rollouts/
