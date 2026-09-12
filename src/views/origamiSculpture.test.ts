import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getOrigamiSculpturePage } from './origamiSculpture';

describe('origami sculpture page', () => {
  const html = getOrigamiSculpturePage();
  it('provides a WebGL canvas and folded mesh', () => {
    expect(html).toContain("getContext('webgl'");
    expect(html).toContain('var path=');
    expect(html).toContain('gl.drawElements');
  });
  it('supports rotation, panning and zoom gestures', () => {
    expect(html).toContain("addEventListener('pointermove'");
    expect(html).toContain("addEventListener('wheel'");
    expect(html).toContain('zoom=Math.max');
    expect(html).toContain('panX+=');
  });
  it('is registered as an authenticated page', () => {
    const source = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    expect(source).toContain("app.get('/origami-sculpture', authMiddleware");
    expect(source).toContain('getOrigamiSculpturePage()');
  });
});
