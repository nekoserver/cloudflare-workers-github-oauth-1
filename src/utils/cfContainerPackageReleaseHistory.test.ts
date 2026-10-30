import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  buildPackageReleaseStatuses,
  getPackageReleaseHistory,
  getPackageReleaseOverview,
  parsePackageHistoryQuery,
  parseReleaseCheckTrigger,
  recordPackageReleaseCheck,
  savePackageReleaseStatuses,
  type PackageReleaseStatus,
} from './cfContainerPackageReleaseStatus';
import type { LatestToolVersions } from './latestToolVersions';

// D1の代わりに、Node標準のSQLiteへ、実際のマイグレーションSQLを適用して検証する。
// cf_container_snapshots は外部キーの参照先としてだけ必要(0179は別のテーブルも変更するため、最小のテーブルで代える)。
const SNAPSHOT_STUB = 'CREATE TABLE cf_container_snapshots (id INTEGER PRIMARY KEY);';
const MIGRATIONS = [
  'migrations/0188_create_cf_container_package_release_status.sql',
  'migrations/0191_create_cf_container_package_release_history.sql',
];

type Stmt = { sql: string; args: unknown[]; bind: (...a: unknown[]) => Stmt; all: () => Promise<{ results: unknown[] }> };
function d1(db: DatabaseSync): D1Database {
  const stmt = (sql: string, args: unknown[] = []): Stmt => ({
    sql, args,
    bind: (...a: unknown[]) => stmt(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...(args as never[])) as unknown[] }),
  });
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (stmts: Stmt[]) => {
      db.exec('BEGIN');
      try {
        for (const s of stmts) db.prepare(s.sql).run(...(s.args as never[]));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return [];
    },
  } as unknown as D1Database;
}

let sqlite: DatabaseSync;
let db: D1Database;
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(SNAPSHOT_STUB);
  sqlite.exec('INSERT INTO cf_container_snapshots (id) VALUES (7);');
  for (const file of MIGRATIONS) sqlite.exec(readFileSync(file, 'utf-8'));
  db = d1(sqlite);
});

const snapshot = { id: 7, createdAt: '2026-10-30T10:00:00Z', versions: { node: '26.12.1', codex: '0.164.0', jj: '0.46.0' } } as never;
const latest = {
  node: { latest: '26.13.0', source: 'nodejs.org', latestDate: '2026-10-29' },
  codex: { latest: '0.166.0', source: 'npm', latestDate: '2026-10-29' },
  jj: { latest: '0.46.0', source: 'crates.io' },
  gh: { latest: null, source: 'GitHub', error: 'HTTP 403' },
} as unknown as LatestToolVersions;

const rows = (sql: string) => sqlite.prepare(sql).all() as Array<Record<string, unknown>>;

describe('parseReleaseCheckTrigger', () => {
  it('未指定はページ表示(page_load)、health_check はそのまま', () => {
    expect(parseReleaseCheckTrigger(undefined)).toBe('page_load');
    expect(parseReleaseCheckTrigger('health_check')).toBe('health_check');
    expect(parseReleaseCheckTrigger('page_load')).toBe('page_load');
  });
  it('それ以外の値は拒否する(null)', () => {
    expect(parseReleaseCheckTrigger('cron')).toBeNull();
    expect(parseReleaseCheckTrigger('')).toBeNull();
    expect(parseReleaseCheckTrigger(1)).toBeNull();
  });
});

describe('パッケージの確認結果の履歴', () => {
  it('確認のたびに履歴の行が増える(現在の状態は、パッケージごとに1行のまま)', async () => {
    await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot, latest, trigger: 'health_check', checkedAt: '2026-10-30T10:05:00Z' });
    await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot, latest, trigger: 'health_check', checkedAt: '2026-10-30T10:35:00Z' });
    const packages = buildPackageReleaseStatuses('demo', snapshot, latest, 'x').length;
    expect(rows('select * from cf_container_package_release_history')).toHaveLength(packages * 2);
    expect(rows('select * from cf_container_package_release_status')).toHaveLength(packages);
  });

  it('各行に、コンテナ・パッケージ名・最新版・導入版・対応状況・確認日時・確認の契機が入る', async () => {
    await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot, latest, trigger: 'health_check', checkedAt: '2026-10-30T10:05:00Z' });
    const node = rows("select * from cf_container_package_release_history where package_name = 'node'")[0];
    expect(node).toMatchObject({
      container_key: 'demo', package_name: 'node', latest_version: '26.13.0', installed_version: '26.12.1',
      update_status: 'update_available', checked_at: '2026-10-30T10:05:00Z', trigger_kind: 'health_check', source: 'nodejs.org',
    });
    const jj = rows("select * from cf_container_package_release_history where package_name = 'jj'")[0];
    expect(jj.update_status).toBe('current_or_ahead');
  });

  it('最新版の取得に失敗した確認も履歴に残す(最新版はNULL、理由を残す)', async () => {
    await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot, latest, trigger: 'health_check', checkedAt: '2026-10-30T10:05:00Z' });
    const gh = rows("select * from cf_container_package_release_history where package_name = 'gh'")[0];
    expect(gh.latest_version).toBeNull();
    expect(gh.release_status).toBe('failed');
    expect(String(gh.error)).toContain('403');
  });

  it('同じ確認(同じ確認日時・契機)を再送しても、履歴は重複しない', async () => {
    const input = { containerKey: 'demo', snapshot, latest, trigger: 'health_check' as const, checkedAt: '2026-10-30T10:05:00Z' };
    await recordPackageReleaseCheck(db, input);
    const before = rows('select * from cf_container_package_release_history').length;
    await recordPackageReleaseCheck(db, input);
    expect(rows('select * from cf_container_package_release_history')).toHaveLength(before);
  });

  it('コンテナごとに別の履歴になる(同じパッケージ・同じ確認日時でも、コンテナが違えば別の行)', async () => {
    const base = { snapshot, latest, trigger: 'health_check' as const, checkedAt: '2026-10-30T10:05:00Z' };
    await recordPackageReleaseCheck(db, { ...base, containerKey: 'demo' });
    await recordPackageReleaseCheck(db, { ...base, containerKey: 'other' });
    const per = buildPackageReleaseStatuses('demo', snapshot, latest, 'x').length;
    expect(rows('select * from cf_container_package_release_history')).toHaveLength(per * 2);
  });

  it('導入版の記録が無い(snapshotがnull)ときも、「不明」として履歴に残す', async () => {
    await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot: null, latest, trigger: 'page_load', checkedAt: '2026-10-30T10:05:00Z' });
    const node = rows("select * from cf_container_package_release_history where package_name = 'node'")[0];
    expect(node).toMatchObject({ installed_status: 'no_snapshot', update_status: 'unknown', trigger_kind: 'page_load' });
  });

  it('途中で失敗したら、現在の状態も履歴も、どちらも反映されない(一緒に確定する)', async () => {
    const good = buildPackageReleaseStatuses('demo', snapshot, latest, '2026-10-30T10:05:00Z');
    const bad = { ...good[0], installedStatus: 'bogus' } as unknown as PackageReleaseStatus;
    await expect(savePackageReleaseStatuses(db, [good[1], bad], 'health_check')).rejects.toThrow();
    expect(rows('select * from cf_container_package_release_status')).toHaveLength(0);
    expect(rows('select * from cf_container_package_release_history')).toHaveLength(0);
  });

  it('戻り値で、記録した件数と、新版ありの件数を返す(呼び出し元が確認できる)', async () => {
    const r = await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot, latest, trigger: 'health_check', checkedAt: '2026-10-30T10:05:00Z' });
    expect(r.historyRecorded).toBe(buildPackageReleaseStatuses('demo', snapshot, latest, 'x').length);
    expect(r.updatesAvailable).toBe(2);
    expect(r.latestUnavailable).toBe(1);
    expect(r.trigger).toBe('health_check');
  });
});

describe('履歴テーブルの登録', () => {
  const migration = readFileSync('migrations/0191_create_cf_container_package_release_history.sql', 'utf-8');

  it('マイグレーションのSQLにコメント(--)を含めない(D1コンソールへそのまま貼り付けるため)', () => {
    expect(migration).not.toContain('--');
  });

  it('/status の5か所(定義・マイグレーションSQL・キー・グループ・FK)へ登録している', () => {
    const index = readFileSync('src/index.ts', 'utf-8');
    const name = 'cf_container_package_release_history';
    expect(index).toMatch(new RegExp(`name: '${name}', migration: '0191'`));
    expect(index).toMatch(new RegExp(`'0191': \`CREATE TABLE IF NOT EXISTS ${name}`));
    expect(index).toMatch(new RegExp(`${name}: \\{[^}]*container_key: 'idx'`));
    expect(index).toMatch(new RegExp(`${name}: 'system'`));
    expect(index).toMatch(new RegExp(`${name}: \\{ installed_snapshot_id: 'cf_container_snapshots' \\}`));
  });

  it('ヘルスチェックのたびに、確認の契機 health_check で記録するようページが呼ぶ', async () => {
    const { getCfContainersPage } = await import('../views/cfContainers');
    const html = getCfContainersPage();
    expect(html).toContain('/api/cf-containers/package-release-status/check');
    const i = html.indexOf('btnHealth.addEventListener');
    expect(html.slice(i, i + 2500)).toContain("syncPackageRelease('health_check')");
  });
});

describe('全コンテナの更新情報の一覧(overview)', () => {
  const at = (n: number) => `2026-10-30T10:0${n}:00Z`;
  const seed = async () => {
    await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot, latest, trigger: 'health_check', checkedAt: at(5) });
    await recordPackageReleaseCheck(db, { containerKey: 'other', snapshot: null, latest, trigger: 'page_load', checkedAt: at(7) });
  };

  it('記録されているコンテナを、すべて返す(コンテナごとに、パッケージの一覧と件数を持つ)', async () => {
    await seed();
    const { containers } = await getPackageReleaseOverview(db);
    expect(containers.map((c) => c.containerKey).sort()).toEqual(['demo', 'other']);
    const demo = containers.find((c) => c.containerKey === 'demo')!;
    expect(demo.packageCount).toBe(buildPackageReleaseStatuses('demo', snapshot, latest, 'x').length);
    expect(demo.updatesAvailable).toBe(2);
    expect(demo.latestUnavailable).toBe(1);
    expect(demo.lastCheckedAt).toBe(at(5));
    expect(containers.find((c) => c.containerKey === 'other')!.updatesAvailable).toBe(0);
  });

  it('各パッケージに、パッケージ名・導入版・最新版・対応状況・確認日時を持つ。新版ありを先頭にする', async () => {
    await seed();
    const demo = (await getPackageReleaseOverview(db)).containers.find((c) => c.containerKey === 'demo')!;
    expect(demo.packages[0].updateStatus).toBe('update_available');
    const node = demo.packages.find((p) => p.packageName === 'node')!;
    expect(node).toMatchObject({ installedVersion: '26.12.1', latestVersion: '26.13.0', updateStatus: 'update_available', checkedAt: at(5) });
  });

  it('記録が1件も無いときは、空の一覧を返す(エラーにしない)', async () => {
    expect((await getPackageReleaseOverview(db)).containers).toEqual([]);
  });

  it('現在の状態(上書き)の値を返す。履歴ではなく、最後の確認の値', async () => {
    await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot, latest, trigger: 'health_check', checkedAt: at(5) });
    const newer = { ...latest, node: { latest: '26.14.0', source: 'nodejs.org' } } as unknown as LatestToolVersions;
    await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot, latest: newer, trigger: 'health_check', checkedAt: at(9) });
    const demo = (await getPackageReleaseOverview(db)).containers[0];
    expect(demo.packages.find((p) => p.packageName === 'node')!.latestVersion).toBe('26.14.0');
    expect(demo.lastCheckedAt).toBe(at(9));
  });
});

describe('パッケージの履歴の取得(history)', () => {
  const at = (n: number) => `2026-10-30T10:${String(n).padStart(2, '0')}:00Z`;

  it('確認日時の新しい順に返し、コンテナとパッケージで絞り込む', async () => {
    for (const n of [5, 15, 25]) {
      await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot, latest, trigger: 'health_check', checkedAt: at(n) });
    }
    await recordPackageReleaseCheck(db, { containerKey: 'other', snapshot, latest, trigger: 'health_check', checkedAt: at(30) });
    const rows = await getPackageReleaseHistory(db, { containerKey: 'demo', packageName: 'node', limit: 50 });
    expect(rows.map((r) => r.checkedAt)).toEqual([at(25), at(15), at(5)]);
    expect(rows.every((r) => r.packageName === 'node')).toBe(true);
  });

  it('件数の上限を守る', async () => {
    for (const n of [5, 15, 25]) {
      await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot, latest, trigger: 'health_check', checkedAt: at(n) });
    }
    expect(await getPackageReleaseHistory(db, { containerKey: 'demo', packageName: 'node', limit: 2 })).toHaveLength(2);
  });

  it('各行に、最新版・導入版・対応状況・確認日時・契機・取得失敗の理由を持つ', async () => {
    await recordPackageReleaseCheck(db, { containerKey: 'demo', snapshot, latest, trigger: 'health_check', checkedAt: at(5) });
    const [row] = await getPackageReleaseHistory(db, { containerKey: 'demo', packageName: 'gh', limit: 5 });
    expect(row).toMatchObject({ latestVersion: null, updateStatus: 'unknown', trigger: 'health_check', checkedAt: at(5) });
    expect(row.error).toContain('403');
  });
});

describe('parsePackageHistoryQuery', () => {
  const q = (query: string) => parsePackageHistoryQuery(new URLSearchParams(query));
  it('コンテナ名とパッケージ名が必要。件数は既定50、1〜200に収める', () => {
    expect(q('containerKey=demo&packageName=node')).toEqual({ ok: true, value: { containerKey: 'demo', packageName: 'node', limit: 50 } });
    expect(q('containerKey=demo&packageName=node&limit=9999')).toMatchObject({ ok: true, value: { limit: 200 } });
    expect(q('containerKey=demo&packageName=node&limit=0')).toMatchObject({ ok: true, value: { limit: 1 } });
  });
  it('足りない・使えない文字を含むときは、理由つきで拒否する', () => {
    expect(q('packageName=node')).toMatchObject({ ok: false });
    expect(q('containerKey=demo')).toMatchObject({ ok: false });
    expect(q("containerKey=de'mo&packageName=node")).toMatchObject({ ok: false });
    expect(q('containerKey=demo&packageName=a b')).toMatchObject({ ok: false });
    expect(q('containerKey=demo&packageName=node&limit=abc')).toMatchObject({ ok: false });
  });
});

describe('/cf-containers ページの「全コンテナの更新情報」', () => {
  it('セクションと、読み込みボタンがあり、左パネルからも移動できる', async () => {
    const { getCfContainersPage } = await import('../views/cfContainers');
    const html = getCfContainersPage();
    expect(html).toContain('id="section-package-updates"');
    expect(html).toContain('id="btn-package-updates"');
    const nav = html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? '';
    expect(nav).toContain('href="#section-package-updates"');
  });

  it('全コンテナの一覧と、パッケージの履歴の、両方のAPIを呼ぶ', async () => {
    const { getCfContainersPage } = await import('../views/cfContainers');
    const html = getCfContainersPage();
    expect(html).toContain('/api/cf-containers/package-release-status/overview');
    expect(html).toContain('/api/cf-containers/package-release-status/history?');
  });

  it('記録の無いコンテナは表示されないことを、画面に書いている', async () => {
    const { getCfContainersPage } = await import('../views/cfContainers');
    const html = getCfContainersPage();
    const i = html.indexOf('id="section-package-updates"');
    expect(html.slice(i, i + 1800)).toContain('記録が無いコンテナ');
  });
});
