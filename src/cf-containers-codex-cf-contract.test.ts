import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
// npm registry latest checked 2026-11-13: Codex 0.169.0, Cloudflare cf 1.0.0-beta.31.
// Upstream: @openai/codex and cloudflare/cf. cf requires Node ^26.12.0 on Node 26.
const docker=readFileSync('containers/demo/Dockerfile','utf8');
it('pins the verified latest Codex release and checks the installed CLI version',()=>{
 expect(docker).toMatch(/^ARG CODEX_VERSION=0\.169\.0$/m);
 expect(docker).toContain('npm install -g @openai/codex@${CODEX_VERSION}');
 expect(docker).toContain('codex --version | grep -Fx "codex-cli ${CODEX_VERSION}"');
});
it('installs the official cf CLI with both upstream command names available over SSH',()=>{
 expect(docker).toMatch(/^ARG CF_CLI_VERSION=1\.0\.0-beta\.31$/m);
 expect(docker).toContain('npm install -g cf@${CF_CLI_VERSION}');
 for(const bin of ['cf','cloudflare'])expect(docker).toContain(`ln -sf /opt/node22/bin/${bin} /usr/local/bin/${bin}`);
 expect(docker).toContain('cf --version | grep -Fx "${CF_CLI_VERSION}"');
 expect(docker).toContain('ARG NODE_VERSION=26.13.1');
});
