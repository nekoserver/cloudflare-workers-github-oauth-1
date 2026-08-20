#!/usr/bin/env npx tsx
/**
 * heritage_master シードSQL生成スクリプト
 *
 * 使い方:
 *   npx tsx scripts/generate-heritage-master-seed.ts [chunkSize] > /tmp/heritage_master_seed.sql
 *
 * src/data/heritageList.ts (HERITAGE_LIST) を宣言順に走査し、4桁ゼロパディングIDを
 * 0001から採番してheritage_masterテーブル向けのINSERT文をチャンク分割して標準出力する。
 * 分類用アイコン(classification_icon)はHeritageItem.e (遺産種別ごとの個別アイコン、
 * webglHeritage.tsのitemIcon(d) = d.eと同一のソース)を使う。
 * 自由アイコン(free_icon)はwebglHeritage.tsの世界遺産カテゴリ共通アイコン(🏛️、
 * kind.iconとして凡例・カテゴリラベル等で実際に使われている値)を使う。
 *
 * 出力SQLに `--` コメントは含めない(D1コンソールへの貼り付け事故防止のため)。
 */

import { HERITAGE_LIST } from '../src/data/heritageList';
import { buildHeritageMasterRows, buildHeritageMasterInsertStatements } from '../src/utils/heritage-master-seed';

const chunkSize = Number(process.argv[2]) || 200;

const rows = buildHeritageMasterRows(HERITAGE_LIST);
const statements = buildHeritageMasterInsertStatements(rows, chunkSize);

for (const [i, stmt] of statements.entries()) {
  process.stderr.write(`chunk ${i + 1}/${statements.length}\n`);
  process.stdout.write(stmt);
  process.stdout.write('\n\n');
}
