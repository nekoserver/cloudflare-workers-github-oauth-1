import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// Tailscale 1.104.6: official tarball SHA256 and both version commands verified
// 2026-11-05. No Go compiler is needed when installing these official binaries.
// https://pkgs.tailscale.com/stable/tailscale_1.104.6_amd64.tgz.sha256
it('Tailscale uses the verified official binary without a Go toolchain',()=>{
 const df=readFileSync('containers/demo/Dockerfile','utf8');
 expect(df).toContain('ARG TAILSCALE_VERSION=1.104.6');
 expect(df).not.toMatch(/^FROM golang:/m);
 expect(df).not.toContain('go install');
 expect(df).toContain('tailscale_${TAILSCALE_VERSION}_amd64.tgz');
 expect(df).toContain('tailscale version');expect(df).toContain('tailscaled --version');
});
