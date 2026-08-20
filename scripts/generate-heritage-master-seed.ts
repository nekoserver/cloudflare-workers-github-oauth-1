#!/usr/bin/env npx tsx
/**
 * heritage_master シードSQL生成スクリプト
 *
 * 使い方:
 *   npx tsx scripts/generate-heritage-master-seed.ts [chunkSize] > /tmp/heritage_master_seed.sql
 *
 * src/data/heritageList.ts (HERITAGE_LIST) を宣言順に走査し、4桁ゼロパディングIDを
 * 0001から採番してheritage_masterテーブル向けのINSERT文をチャンク分割して標準出力する。
 * 分類用アイコン(classification_icon)・自由アイコン(free_icon)は暫定的に
 * HeritageItem.e (既存アイコン)を複製している。将来AIによる本分類パスで差し替える想定。
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
