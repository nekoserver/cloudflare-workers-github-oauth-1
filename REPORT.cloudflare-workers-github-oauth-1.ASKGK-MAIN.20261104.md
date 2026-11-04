# askgk temporary main route — 2026-11-04

User requested routing askgk to the current container while r9 Codex authentication remains broken.

- Production Worker `cloudflare-workers-github-oauth-1`: `ASKGK_ROUTE_ID` changed from `independent` to `main` through the settings API. All other 53 bindings compare equal before and after, including secret references. Backups are private under `/root/.cache/askgk-main-switch-20261104/`.
- Destination: `https://mygw.nekomaneki.work/lib/api/tunnels`. Existing Claude engine override also points to main. Registry default remains independent; the explicit configured route selects main.
- Signed live Codex request after switch returned HTTP 200, `ask_status=done`, reply `ASKGK_MAIN_READY`, ask_id `codex-f9e5066a-9aac-46c5-a3e7-34d75635bfbc`.
- Updated wrangler configuration and matching route expectation. Verified configuration and JSON registry with Python, and `git diff --check`. Vitest was not run: local dependencies are absent. No Docker build, image update, source deployment, or Slack message was performed. Actual Slack UI invocation is unverified.
- Automatic failover is not implemented. Requests already submitted may continue after a network timeout; blind resend to another container can duplicate execution.
- Rollback: set production `ASKGK_ROUTE_ID=independent` and the same wrangler variable after repairing independent Codex authentication. Other settings must be retained.
