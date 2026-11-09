import { Hono, type MiddlewareHandler } from 'hono';
import type { Bindings, Variables } from '../types';
import { HERITAGE_ROUTES } from '../data/heritageRoutes';

type Env = { Bindings: Bindings; Variables: Variables };

export function createHeritageProxyRoutes(authenticate: MiddlewareHandler<Env>) {
  const routes = new Hono<Env>();
  routes.get('/api/heritage/auth-context', authenticate, (c) => {
    // Do not return the JWT payload: it can contain a GitHub access token.
    return c.json({ user: { sub: c.get('user').sub } }, 200, { 'Cache-Control': 'no-store' });
  });
  for (const { method, path } of HERITAGE_ROUTES) {
    routes.on(method, path, async (c) => {
      if (!c.env.HERITAGE) return c.json({ error: '世界遺産Workerが未設定です' }, 503);
      try {
        return await c.env.HERITAGE.fetch(c.req.raw);
      } catch (error) {
        console.error('[heritage] Worker request failed', error instanceof Error ? error.message : String(error));
        return c.json({ error: '世界遺産Workerに接続できません' }, 503);
      }
    });
  }
  return routes;
}
