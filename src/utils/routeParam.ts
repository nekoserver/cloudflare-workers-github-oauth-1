import { HTTPException } from 'hono/http-exception';

/** Validate captures before passing them to code that requires a string. */
export function requireRouteParam(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw new HTTPException(400, { message: '必須のURLパラメーターがありません' });
  }
  return value;
}
