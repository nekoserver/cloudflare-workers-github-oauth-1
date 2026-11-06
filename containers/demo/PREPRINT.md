# preprint in the container

The image installs the official precompiled `@supermemory/preprint` 0.1.2
npm package and Google Chrome stable 157.0.8103.38-1. Downloads are SHA256-pinned;
the preprint tarball was also checked against npm's SHA512 integrity metadata.
No Cargo/source build is needed. Chrome's Debian dependencies are installed by
APT; the image build checks Chrome's headless about:blank output and CLI help.

Use from the container's Codex/SSH shell:

```sh
preprint --version
preprint open https://example.com --context "read-only browser check" --no-profile
cat preprint/tabs.md
# Read the selected page file before appending one action.
```

`/opt/node22/bin/preprint` and `/usr/local/bin/preprint` use a container adapter.
The upstream 0.1.2 CLI does not implement --version; the adapter returns the
actual installed package.json version for /cf-containers health checks. Every
other command goes to the original npm launcher unchanged.

AGENT_BROWSER_EXECUTABLE_PATH defaults to /usr/bin/google-chrome; a supplied value
wins. AGENT_BROWSER_ARGS is preserved, defaults to --disable-dev-shm-usage, and
has --no-sandbox appended for root because Chrome cannot use its sandbox as root.
Running as a non-root user keeps Chrome's sandbox flags unchanged. This is a
container compatibility setting, not an additional security boundary.

The package owns a separate Chromium session/profile. It does not take over an
iPad Safari tab or inherit its login cookies. No browser or AI task is started
by the container entrypoint/cron just because the CLI is installed.

/cf-containers reports the installed preprint package version and checks npm's
latest tag and publication times. apt itself is listed in the APT tools table,
using dpkg's installed version and apt-cache's Candidate. Page/API changes need
a Worker deployment; the installed tool rows need the new container image.

## Checked in the container (2026-11-06)

Run as root with `--no-profile`, except the first check, which used the default
session. Each result comes from one run on an HTTPS page and a local test page.

| Feature | Result |
| --- | --- |
| `open`, `tabs.md`, `status`, `close`, `stop` | Works |
| `fill` (Japanese text), `click`, `back`, `wait_text` | Works |
| `screenshot("name", annotate)` | Works; the PNG is written |
| Uncaught exceptions in `console.md` | Works |
| `console.log` and `console.error` during page load | Not recorded |
| Plain `<p>` and `<div>` text in `## Page` | Not shown; headings, tables and controls are |
| `record_start` and `record_stop` | Fails: `record_start` reports ok but opens a broken `--in-place` tab, and `record_stop` fails with `failed to stop recording`; no video is saved |

Not checked: `type`, `press`, `scroll`, `reload`, `wait_url`, `wait_idle`,
`goto`, `--preview`, `--profile` and `--inject`.

- Use it to operate and verify pages, not to read article text.
- `@e` refs renumber on each snapshot. Read the page file before every action.
- No default Chrome profile is detected, so sessions start without login cookies.
- `preprint stop` removes `.preprint/`, including screenshots. Copy what you keep first.
- It writes `preprint/` and `.preprint/` to the workspace, so avoid running it
  inside a repository unless those paths are ignored.

Official interface: https://github.com/supermemoryai/preprint#action-grammar
Browser runtime: https://developer.chrome.com/docs/automation-and-testing/headless
