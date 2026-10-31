import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 2026-10-30、Tailscale 1.104.4 の go.mod が `go 1.27.3` を要求するのに、ビルド用のイメージが golang:1.27.1 のままで、
// 本番のイメージのビルドが `go install tailscale.com/...@v1.104.4` で失敗した(本番D1の cf_container_build_steps で確認)。
// 公式のgolangイメージは GOTOOLCHAIN=local のため、足りないGoを自動で取りに行かない。
// Tailscale・ghを上げるときは、配布元の go.mod の `go` 行(https://proxy.golang.org/<module>/@v/<version>.mod)を確かめ、
// 下の表と、Dockerfileのgolangイメージを、あわせて直すこと。
const REQUIRED_GO: Record<string, Record<string, string>> = {
  TAILSCALE_VERSION: { '1.104.4': '1.27.3' },
};

const dockerfile = readFileSync(new URL('../containers/demo/Dockerfile', import.meta.url), 'utf8');
const arg = (name: string) => dockerfile.match(new RegExp(`^ARG ${name}=(\\S+)`, 'm'))?.[1];
const goImages = [...dockerfile.matchAll(/^FROM golang:(\d+\.\d+\.\d+)-\S+ AS (\S+)/gm)].map(m => ({ version: m[1], stage: m[2] }));
const cmp = (a: string, b: string) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

describe('ビルド用のGoの版が、ソースビルドするパッケージの要求を満たす', () => {
  it('Goのイメージでソースビルドするのは、Tailscaleだけ(ghは公式のリリースのバイナリを使う)', () => {
    expect(goImages.map(image => image.stage).sort()).toEqual(['tailscale-build']);
  });
  it('2つのステージのGoの版は同じ', () => {
    expect(new Set(goImages.map(image => image.version)).size).toBe(1);
  });
  for (const [name, table] of Object.entries(REQUIRED_GO)) {
    it(`${name} の版の要求が表にあり、Goのイメージがそれ以上である`, () => {
      const version = arg(name);
      expect(version, `${name} がDockerfileに無い`).toBeDefined();
      const required = table[version!];
      expect(required, `${name}=${version} の要求するGoの版が表に無い。go.mod を確かめて表に足すこと`).toBeDefined();
      for (const image of goImages) expect(cmp(image.version, required)).toBeGreaterThanOrEqual(0);
    });
  }
});
