/**
 * 構造化ログユーティリティ
 * Cloudflareのオブザーバビリティで見やすいログを出力します
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  [key: string]: any;
}

/**
 * 構造化ログを出力
 */
export function log(
  level: LogLevel,
  message: string,
  context?: LogContext
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  // JSONフォーマットで出力することで、Cloudflare Dashboardで構造化されたログとして表示される
  console.log(JSON.stringify(logEntry));
}

/**
 * DEBUGレベルのログ
 */
export function debug(message: string, context?: LogContext): void {
  log('DEBUG', message, context);
}

/**
 * INFOレベルのログ
 */
export function info(message: string, context?: LogContext): void {
  log('INFO', message, context);
}

/**
 * WARNレベルのログ
 */
export function warn(message: string, context?: LogContext): void {
  log('WARN', message, context);
}

/**
 * ERRORレベルのログ
 */
export function error(message: string, context?: LogContext): void {
  log('ERROR', message, context);
}

/**
 * Analytics Engineにメトリクスを記録
 */
export function recordMetric(
  analytics: AnalyticsEngineDataset | undefined,
  eventName: string,
  dataPoint: Record<string, string | number | boolean>
): void {
  if (!analytics) {
    return;
  }

  try {
    analytics.writeDataPoint({
      blobs: [eventName],
      doubles: Object.entries(dataPoint)
        .filter(([_, value]) => typeof value === 'number')
        .map(([key, value]) => value as number),
      indexes: Object.entries(dataPoint)
        .filter(([_, value]) => typeof value === 'string')
        .map(([_, value]) => value as string),
    });
  } catch (err) {
    console.error('Failed to record metric:', err);
  }
}
