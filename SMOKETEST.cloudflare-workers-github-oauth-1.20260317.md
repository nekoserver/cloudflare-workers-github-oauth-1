# API Smoke Test Report (cloudflare-workers-github-oauth-1)

Date: 2026-03-17 (JST)
Target: Local `wrangler dev` (Cloudflare Workers runtime)
Scope: Basic API smoke tests for `/api` endpoints in `README.md`

## Summary
- Status: **Partial**
- Reason: Unauthenticated checks complete; authenticated checks returned 401 due to missing `auth_token`.
- Impact: Public endpoints returned 200; protected endpoints returned 401 even with cookie jar, indicating OAuth callback not completed.

## Environment
- Repo: `cloudflare-workers-github-oauth-1`
- Node: `v25.6.1`
- Wrangler: `4.73.0` (via `npx wrangler`)
- Vars: `.dev.vars` created from `.dev.vars.example`
- Attempted to isolate config/logs: `XDG_CONFIG_HOME=/tmp/.config`, `HOME=/tmp`

## Steps Executed (This Environment)
1. Created `.dev.vars` from template.
2. Started local dev server:
   - `npx wrangler dev --local --port 8787`
   - `XDG_CONFIG_HOME=/tmp/.config HOME=/tmp npx wrangler dev --local --ip 127.0.0.1 --port 8787`
3. Both attempts failed before server startup.

## Failure Details (This Environment)
- Error (both attempts):
  - `A system error occurred: uv_interface_addresses returned Unknown system error 1`
- Additional issue (first attempt only):
  - `Failed to write to log file ... /root/.config/.wrangler/logs/... (EACCES)`
- Logs:
  - `/root/.config/.wrangler/logs/wrangler-2026-03-16_19-26-11_065.log` (first attempt)
  - `/tmp/.config/.wrangler/logs/wrangler-2026-03-16_19-26-41_365.log` (second attempt)

## Smoke Tests (Planned, Not Executed)
None. All planned checks completed (see results below).

## Local Execution Result (User Environment)
- Command: `curl -i http://127.0.0.1:8787/api`
- Result: `HTTP/1.1 200 OK`
- Notes:
  - `Content-Type: application/json`
  - Security headers present (HSTS/CSP/XFO/etc.)
  - Body: API metadata JSON returned
- Command: `curl -i http://127.0.0.1:8787/api/public`
- Result: `HTTP/1.1 200 OK`
- Notes:
  - `Content-Type: application/json`
  - Security headers present (HSTS/CSP/XFO/etc.)
  - Body: Public endpoint JSON returned
- Command: `curl -i http://127.0.0.1:8787/api/protected`
- Result: `HTTP/1.1 401 Unauthorized`
- Notes:
  - `Content-Type: application/json`
  - Security headers present (HSTS/CSP/XFO/etc.)
  - Body: auth required error JSON returned (expected unauthenticated behavior)
- Command: `curl -i http://127.0.0.1:8787/api/profile`
- Result: `HTTP/1.1 401 Unauthorized`
- Notes:
  - `Content-Type: application/json`
  - Security headers present (HSTS/CSP/XFO/etc.)
  - Body: auth required error JSON returned (expected unauthenticated behavior)
- Command: `curl -i -X POST http://127.0.0.1:8787/api/settings/timezone -H 'Content-Type: application/json' -d '{"timezone":"JST"}'`
- Result: `HTTP/1.1 401 Unauthorized`
- Notes:
  - `Content-Type: application/json`
  - Security headers present (HSTS/CSP/XFO/etc.)
  - Body: auth required error JSON returned (expected unauthenticated behavior)
- Command: `curl -i -X POST http://127.0.0.1:8787/api/settings/session-duration -H 'Content-Type: application/json' -d '{"sessionDuration":"1h"}'`
- Result: `HTTP/1.1 401 Unauthorized`
- Notes:
  - `Content-Type: application/json`
  - Security headers present (HSTS/CSP/XFO/etc.)
  - Body: auth required error JSON returned (expected unauthenticated behavior)
- Command: `curl -c /tmp/cookies.txt -i http://127.0.0.1:8787/auth/github`
- Result: `HTTP/1.1 302 Found`
- Notes:
  - Redirected to GitHub OAuth authorize URL
  - `Set-Cookie` issued for `oauth_state` and `oauth_pkce`
- Command: `curl -b /tmp/cookies.txt -i http://127.0.0.1:8787/api/protected`
- Result: `HTTP/1.1 401 Unauthorized`
- Notes:
  - `Content-Type: application/json`
  - Body: auth required error JSON returned (cookie-based auth not established)
- Command: `curl -b /tmp/cookies.txt -i http://127.0.0.1:8787/api/profile`
- Result: `HTTP/1.1 401 Unauthorized`
- Notes:
  - `Content-Type: application/json`
  - Body: auth required error JSON returned (cookie-based auth not established)
- Command: `curl -b /tmp/cookies.txt -i -X POST http://127.0.0.1:8787/api/settings/timezone -H 'Content-Type: application/json' -d '{"timezone":"JST"}'`
- Result: `HTTP/1.1 401 Unauthorized`
- Notes:
  - `Content-Type: application/json`
  - Body: auth required error JSON returned (cookie-based auth not established)
- Command: `curl -b /tmp/cookies.txt -i -X POST http://127.0.0.1:8787/api/settings/session-duration -H 'Content-Type: application/json' -d '{"sessionDuration":"1h"}'`
- Result: `HTTP/1.1 401 Unauthorized`
- Notes:
  - `Content-Type: application/json`
  - Body: auth required error JSON returned (cookie-based auth not established)

## Local Execution Failure Detail (User Environment)
- Command: `wrangler dev` (run from `/home/ubuntu`, not repo root)
- Error: `Missing entry-point to Worker script or to assets directory`
- Note: Should be run from repo root or with explicit entry-point (e.g., `npx wrangler dev src/index.ts`).

## Next Actions
- Complete GitHub OAuth callback in browser to obtain `auth_token`, then re-run protected endpoint checks.
