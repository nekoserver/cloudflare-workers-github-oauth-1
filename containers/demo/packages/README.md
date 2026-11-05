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
