import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dockerfile=readFileSync('containers/demo/Dockerfile','utf8');
describe('用途別の同梱オプション',()=>{
  it('Dockerを既定で外し、開発CLIは個別に選択できる',()=>{
    expect(dockerfile).toContain('ARG INSTALL_DOCKER=false');
    for(const name of ['VITEST','TYPESCRIPT','WRANGLER'])expect(dockerfile).toContain('ARG INSTALL_'+name+'=true');
    for(const name of ['DOCKER','VITEST','TYPESCRIPT','WRANGLER'])expect(dockerfile).toContain('if [ "$INSTALL_'+name+'" = "true" ]; then');
  });
  it('未導入CLIへのリンクを作らず、選択結果をイメージに残す',()=>{
    expect(dockerfile).toContain('if command -v "$b" >/dev/null 2>&1; then');
    expect(dockerfile).toContain('/etc/container-features.json');
  });
  it('全RUN命令のシェル構文が正しい',()=>{
    const normalized=dockerfile.replace(/\\\n/g,' ');
    for(const line of normalized.split('\n').filter(line=>line.startsWith('RUN ')))expect(()=>execFileSync('sh',['-n'],{input:line.slice(4)})).not.toThrow();
  });
});
