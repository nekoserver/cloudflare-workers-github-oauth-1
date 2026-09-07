/**
 * D1の各テーブルが、src/index.ts のどのルート(ページ/API/Webhook)から
 * 参照されているかを機械的に解析し、src/data/tablePageMap.ts へ書き出す。
 *
 * 手法: src/index.ts 中の `app.get('/path', ...)` 等のルート定義行を
 * 全て収集し、各ルートの「担当範囲」を「そのルート定義行 〜 次のルート
 * 定義行の直前」とみなす。STATUS_TABLE_DEFINITIONSの各テーブル名について、
 * ソース中でその識別子(\bにより完全一致)が出現する行を探し、その行が
 * どのルートの担当範囲に入るかを突き合わせて、テーブル→ルート一覧を作る。
 *
 * 正規表現ベースの静的解析であり、ASTではないため、コメント内の言及や
 * 文字列リテラル内の偶然の一致等を誤って拾う場合がある(許容範囲内の近似)。
 *
 * 実行方法: npx tsx scripts/generate-table-page-map.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SRC_PATH = join(__dirname, '..', 'src', 'index.ts');
const source = readFileSync(SRC_PATH, 'utf-8');
const lines = source.split('\n');

type RouteDef = { method: string; path: string; startLine: number };

const routeRe = /^app\.(get|post|put|delete|patch|use)\(\s*'([^']+)'/;
const routes: RouteDef[] = [];
lines.forEach((line, i) => {
  const m = line.match(routeRe);
  if (m && m[1] !== 'use') {
    routes.push({ method: m[1].toUpperCase(), path: m[2], startLine: i + 1 });
  }
});
routes.sort((a, b) => a.startLine - b.startLine);

function routeAtLine(lineNo: number): RouteDef | null {
  let result: RouteDef | null = null;
  for (const r of routes) {
    if (r.startLine <= lineNo) result = r;
    else break;
  }
  return result;
}

// STATUS_TABLE_DEFINITIONSからテーブル名一覧を抜き出す(このスクリプト自体が
// import type errorを起こさないよう、正規表現でソースから直接テーブル名を集める)。
const tableNameRe = /\{\s*name:\s*'([a-zA-Z0-9_]+)'/g;
const defsBlockMatch = source.match(/export const STATUS_TABLE_DEFINITIONS[^;]*?;\n\n/s);
const defsBlock = defsBlockMatch ? defsBlockMatch[0] : '';
const tableNames = new Set<string>();
let m: RegExpExecArray | null;
while ((m = tableNameRe.exec(defsBlock)) !== null) {
  tableNames.add(m[1]);
}

const tablePageMap: Record<string, { method: string; path: string }[]> = {};

for (const tableName of tableNames) {
  const identifierRe = new RegExp(`\\b${tableName}\\b`);
  const routeSet = new Map<string, { method: string; path: string }>();
  lines.forEach((line, i) => {
    const lineNo = i + 1;
    if (!identifierRe.test(line)) return;
    const route = routeAtLine(lineNo);
    if (!route) return;
    // ルート定義自体の行(app.get('/path', ...)の行)でテーブル名がマッチする
    // ことは無い(パス文字列にテーブル名が入る可能性はあるが稀なため許容)。
    const key = `${route.method} ${route.path}`;
    routeSet.set(key, { method: route.method, path: route.path });
  });
  if (routeSet.size > 0) {
    tablePageMap[tableName] = [...routeSet.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
  }
}

const output = `/**
 * D1の各テーブルが、src/index.ts のどのルート(ページ/API/Webhook)から
 * 参照されているかを静的解析した結果(自動生成)。
 * scripts/generate-table-page-map.ts の実行結果を書き出したもの。
 *
 * 正規表現ベースの近似解析であり、コメント内の言及等を誤って拾う場合がある。
 * テーブル名がこのマップに存在しない場合は、src/index.ts 内のルートからは
 * 参照が見つからなかったことを意味する(他ファイルからのみ参照、またはロジック上
 * 未使用のテーブルである可能性がある)。
 *
 * 再生成: npx tsx scripts/generate-table-page-map.ts
 */
export type TablePageRef = { method: string; path: string };
export const TABLE_PAGE_MAP: Record<string, TablePageRef[]> = ${JSON.stringify(tablePageMap, null, 2)};
`;

const outPath = join(__dirname, '..', 'src', 'data', 'tablePageMap.ts');
writeFileSync(outPath, output);
console.log('written:', outPath, `(${Object.keys(tablePageMap).length} / ${tableNames.size} tables mapped)`);
