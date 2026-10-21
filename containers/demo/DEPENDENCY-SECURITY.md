# Dependency installation protection

The Dockerfile installs Socket Firewall Free 1.15.4 from its official Linux x86_64
release, verifies its pinned SHA-256, and runs every npm and pip installation
through `sfw`. This includes upgrading npm itself. A failed command stops the
Docker build; there is no retry without the firewall. The Ubuntu APT packages and
direct downloads of Node, GitHub CLI, and other tools are outside its coverage.

Python downloads disable the package cache. npm caches are cleared between CLI
installations because cached artifacts bypass network-based inspection. Docker
layer caches also skip installation entirely: use a fresh build in an authorized
build environment when a new threat advisory requires rechecking dependencies.

For subsequent installations in a running container, explicitly use:

```sh
sfw npm install <package>@<version>
sfw npm install -g <package>@<version>
```

Plain npm/pip commands are still available; installing `sfw` does not globally
intercept them. Existing installed packages are not retroactively scanned or
removed. Do not place service credentials in build arguments or build layers.

## Limits

- The free edition blocks confirmed malware, including transitive dependencies.
  AI-only detections produce warnings; unknown/unscanned versions are allowed.
- It requires Internet access and supports public registries only. This is not an
  organization-wide fail-closed policy for all unknown packages or API failures.
- It sends package names/versions and anonymous telemetry to Socket; telemetry
  cannot be disabled in the free edition. It uses the PolyForm Shield license.
- Firewall protection does not replace vulnerability audits, signature checks,
  a reviewed lockfile, or credential rotation after an actual compromise.
- Direct versions are pinned here; npm CLI transitive dependencies and Python
  transitive dependencies are not fully locked by this change.
- npm's own upgrade disables lifecycle scripts. Claude retains its explicit
  installer permission; Codex follows npm 12's default script policy.

No scheduled retrospective scan or automatic package deletion is configured.
On a confirmed incident, rebuild from a clean base with corrected dependencies
and revoke exposed credentials rather than just uninstalling the package.

Official behavior and installation instructions:
https://docs.socket.dev/docs/socket-firewall-free

Docker builds must follow the restrictions in the repository's AGENTS.md and
AGENT.md; they are not permitted in this container.
