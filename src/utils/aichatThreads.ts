export const DEFAULT_GROWTH_WINDOW_HOURS = 24;
export const DEFAULT_GROWING_THREAD_LIMIT = 20;
export const MAX_GROWING_THREAD_LIMIT = 100;

export type ThreadGrowthWindow = {
  previousFrom: string;
  recentFrom: string;
  until: string;
};

export function createThreadId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isThreadId(value: string): boolean {
  return /^[0-9a-f]{32}$/.test(value);
}

export function parseGrowingThreadLimit(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_GROWING_THREAD_LIMIT;
  if (!/^\d+$/.test(value)) throw new Error('limitは1から100の整数で指定してください');
  const limit = Number(value);
  if (limit < 1 || limit > MAX_GROWING_THREAD_LIMIT) {
    throw new Error('limitは1から100の整数で指定してください');
  }
  return limit;
}

export function buildThreadGrowthWindow(now: Date, windowHours = DEFAULT_GROWTH_WINDOW_HOURS): ThreadGrowthWindow {
  const windowMs = windowHours * 60 * 60 * 1000;
  return {
    previousFrom: new Date(now.getTime() - windowMs * 2).toISOString(),
    recentFrom: new Date(now.getTime() - windowMs).toISOString(),
    until: now.toISOString(),
  };
}
