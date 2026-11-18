// ソースからビルドしたパッケージの「ソースからのコンパイル時間」と「パッケージ(キャッシュ)からのインストール時間」。
// Dockerfileのソースビルドのステージが、ソースを捨てる前に次の1行をビルドログへ出す(CLAUDE.md ルール44)。
//   CACHE_EFFECT package=<名前> version=<版> compile_ms=<ミリ秒> install_ms=<ミリ秒> source_bytes=<ソースアーカイブ> package_bytes=<パッケージ>
// サイズの無い古い形の行は、サイズを null にする(0で埋めない)。
export interface CacheEffect { packageName: string; version: string; compileSeconds: number; installSeconds: number; savedSeconds: number; sourceBytes: number | null; packageBytes: number | null }

const LINE = /CACHE_EFFECT package=([a-z0-9][a-z0-9._-]{0,63}) version=([A-Za-z0-9._+-]{1,64}) compile_ms=(\d{1,10}) install_ms=(\d{1,10})(?: source_bytes=(\d{1,15}) package_bytes=(\d{1,15}))?(?:\s|$)/;

export function parseCacheEffects(log: string): CacheEffect[] {
  const byPackage = new Map<string, CacheEffect>();
  for (const line of log.split('\n')) {
    const m = LINE.exec(line);
    if (!m) continue;
    const compileSeconds = Number(m[3]) / 1000, installSeconds = Number(m[4]) / 1000;
    byPackage.set(m[1], { packageName: m[1], version: m[2], compileSeconds, installSeconds, savedSeconds: Math.round((compileSeconds - installSeconds) * 1000) / 1000,
      sourceBytes: m[5] === undefined ? null : Number(m[5]), packageBytes: m[6] === undefined ? null : Number(m[6]) });
  }
  return [...byPackage.values()];
}
