#!/usr/bin/env npx tsx
/**
 * 関数カタログ更新スクリプト
 *
 * 使い方:
 *   npx tsx scripts/index-functions.ts [<file1.ts> <file2.ts> ...]
 *
 * 引数なしの場合は src/ 以下の全 .ts ファイルを対象にする。
 * 出力された SQL を D1 コンソールで実行すること。
 *
 * 新関数（purpose='(自動検出)'）が含まれる場合は purpose を日本語に修正してから実行する。
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { parseHunks, diffForRange, type HunkInfo } from '../src/utils/git-diff';

const ROOT = path.resolve(__dirname, '..');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseFunctions, findCallers } = require(path.join(ROOT, 'src/utils/parse-functions'));

const REPO_ID = 1;

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsFiles(full));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      results.push(full);
    }
  }
  return results;
}

function rel(abs: string): string {
  return path.relative(ROOT, abs).replace(/\\/g, '/');
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

/** ファイルの最終コミット日時（ISO 8601）を返す。git 外なら null */
function getLastModifiedAt(filePath: string): string | null {
  try {
    const out = execSync(`git log -1 --format="%ci" -- "${filePath}"`, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * ファイルに対する直前コミットとの diff ハンクを返す。
 * HEAD~1 が存在しない（初回コミット）場合は HEAD の内容全体を diff として扱う。
 */
function getFileHunks(filePath: string): HunkInfo[] {
  const tryCmd = (cmd: string): string | null => {
    try {
      return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      return null;
    }
  };

  const diff =
    tryCmd(`git diff HEAD~1 HEAD --unified=0 -- "${filePath}"`) ??
    tryCmd(`git show HEAD --unified=0 -- "${filePath}"`) ??
    '';

  return parseHunks(diff);
}

const args = process.argv.slice(2);
const targetFiles =
  args.length > 0
    ? args.map((a) => path.resolve(ROOT, a))
    : getAllTsFiles(path.join(ROOT, 'src'));

const allFiles = getAllTsFiles(path.join(ROOT, 'src'));
const fileContents = new Map<string, string>();
for (const f of allFiles) {
  fileContents.set(rel(f), fs.readFileSync(f, 'utf-8'));
}

const lines: string[] = [];

for (const file of targetFiles) {
  const r = rel(file);
  const source = fs.readFileSync(file, 'utf-8');
  const functions: Array<{
    name: string;
    startLine: number;
    endLine: number;
    isExported: boolean;
    isAsync: boolean;
  }> = parseFunctions(source);

  const lastModifiedAt = getLastModifiedAt(file);
  const hunks = getFileHunks(file);

  for (const fn of functions) {
    const { linesAdded, linesDeleted } = diffForRange(hunks, fn.startLine, fn.endLine);
    const lastMod = lastModifiedAt ? `'${esc(lastModifiedAt)}'` : 'NULL';

    lines.push(
      `INSERT INTO ts_function_catalog (repo_id, file_path, function_name, purpose, is_exported, is_async, start_line, end_line, lines_added, lines_deleted, last_modified_at)` +
        ` VALUES (${REPO_ID}, '${esc(r)}', '${esc(fn.name)}', '(自動検出)', ${fn.isExported ? 1 : 0}, ${fn.isAsync ? 1 : 0}, ${fn.startLine}, ${fn.endLine}, ${linesAdded}, ${linesDeleted}, ${lastMod})` +
        ` ON CONFLICT(repo_id, file_path, function_name) DO UPDATE SET` +
        ` start_line = excluded.start_line, end_line = excluded.end_line,` +
        ` is_exported = excluded.is_exported, is_async = excluded.is_async,` +
        ` lines_added = excluded.lines_added, lines_deleted = excluded.lines_deleted,` +
        ` last_modified_at = COALESCE(excluded.last_modified_at, ts_function_catalog.last_modified_at);`
    );

    const callers: Array<{ callerFile: string; callerLine: number }> = findCallers(
      fn.name,
      fileContents,
      r
    );

    if (callers.length > 0) {
      lines.push(
        `DELETE FROM ts_function_callers WHERE callee_id = (SELECT id FROM ts_function_catalog WHERE repo_id=${REPO_ID} AND file_path='${esc(r)}' AND function_name='${esc(fn.name)}');`
      );
      for (const caller of callers) {
        lines.push(
          `INSERT OR IGNORE INTO ts_function_callers (repo_id, callee_id, caller_file, caller_line)` +
            ` VALUES (${REPO_ID},` +
            ` (SELECT id FROM ts_function_catalog WHERE repo_id=${REPO_ID} AND file_path='${esc(r)}' AND function_name='${esc(fn.name)}'),` +
            ` '${esc(caller.callerFile)}', ${caller.callerLine});`
        );
      }
    }
  }
}

console.log(lines.join('\n'));
