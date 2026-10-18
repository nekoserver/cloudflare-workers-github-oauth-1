import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { requireRouteParam } from './routeParam';

describe('required route parameter handling', () => {
  const app = new Hono();
  app.get('/items/:id?', (c) => c.json({ id: requireRouteParam(c.req.param('id')) }));

  it('preserves a matched route parameter', async () => {
    const response = await app.request('/items/item-42');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'item-42' });
  });

  it('returns a client error before processing an absent parameter', async () => {
    const response = await app.request('/items');
    expect(response.status).toBe(400);
  });

  it('rejects empty input instead of using it in a database query', () => {
    expect(() => requireRouteParam('')).toThrow();
  });
});
