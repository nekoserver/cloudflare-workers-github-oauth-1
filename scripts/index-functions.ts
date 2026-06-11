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
import {
  parseHunks,
  diffForRange,
  classifyFunctionChanges,
  type HunkInfo,
  type FunctionSnapshot,
} from '../src/utils/git-diff';

const ROOT = path.resolve(__dirname, '..');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseFunctions, findCallers } = require(path.join(ROOT, 'src/utils/parse-functions'));

const REPO_ID = 1;

// ---------------------------------------------------------------------------
// ファイルユーティリティ
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// git ユーティリティ
// ---------------------------------------------------------------------------

function git(cmd: string): string | null {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

interface CommitMeta {
  hash: string;
  at: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  isMerge: boolean;
  branchName: string;
}

function getCommitMeta(): CommitMeta | null {
  const hash = git('git rev-parse HEAD');
  if (!hash) return null;

  const at          = git('git log -1 --format="%ci" HEAD') ?? '';
  const subject     = git('git log -1 --format="%s" HEAD') ?? '';
  const authorName  = git('git log -1 --format="%an" HEAD') ?? '';
  const authorEmail = git('git log -1 --format="%ae" HEAD') ?? '';
  const parents     = git('git log -1 --format="%P" HEAD') ?? '';
  const branchName  = git('git rev-parse --abbrev-ref HEAD') ?? '';

  // --shortstat から "N files changed, M insertions(+), K deletions(-)" を解析
  const stat = git('git show --shortstat --format="" HEAD') ?? '';
  const fc  = stat.match(/(\d+) file/)?.[1]  ?? '0';
  const ins = stat.match(/(\d+) insertion/)?.[1] ?? '0';
  const del = stat.match(/(\d+) deletion/)?.[1]  ?? '0';

  return {
    hash,
    at,
    subject,
    authorName,
    authorEmail,
    filesChanged: parseInt(fc,  10),
    insertions:   parseInt(ins, 10),
    deletions:    parseInt(del, 10),
    isMerge:      parents.includes(' '),
    branchName,
  };
}

/** ファイルの最終コミット日時（ISO 8601）を返す */
function getLastModifiedAt(filePath: string): string | null {
  return git(`git log -1 --format="%ci" -- "${filePath}"`);
}

/** HEAD~1 との diff ハンクを返す（初回コミット時は git show HEAD で代替） */
function getFileHunks(filePath: string): HunkInfo[] {
  const diff =
    git(`git diff HEAD~1 HEAD --unified=0 -- "${filePath}"`) ??
    git(`git show HEAD --unified=0 -- "${filePath}"`) ??
    '';
  return parseHunks(diff);
}

/** HEAD~1 時点のファイル内容を返す（新規ファイルなら null） */
function getPrevFileContent(repoRelPath: string): string | null {
  return git(`git show HEAD~1:"${repoRelPath}"`);
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

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

const commit = getCommitMeta();
const lines: string[] = [];

// ts_commit_log への INSERT（コミット情報を記録）
if (commit) {
  lines.push(
    `INSERT OR IGNORE INTO ts_commit_log (repo_id, commit_hash, commit_at, author_email, branch_name, subject, files_changed, insertions, deletions, is_merge_commit)` +
      ` VALUES (${REPO_ID}, '${esc(commit.hash)}', '${esc(commit.at)}', '${esc(commit.authorEmail)}',` +
      ` '${esc(commit.branchName)}', '${esc(commit.subject)}',` +
      ` ${commit.filesChanged}, ${commit.insertions}, ${commit.deletions}, ${commit.isMerge ? 1 : 0});`
  );
}

for (const file of targetFiles) {
  const r = rel(file);
  const source = fs.readFileSync(file, 'utf-8');
  const functions: FunctionSnapshot[] = parseFunctions(source).map(
    (f: { name: string; startLine: number; endLine: number }) => ({
      name: f.name, startLine: f.startLine, endLine: f.endLine,
    })
  );

  const lastModifiedAt = getLastModifiedAt(file);
  const hunks = getFileHunks(file);

  // ---- ts_function_catalog UPSERT ----
  const fullFunctions: Array<{
    name: string; startLine: number; endLine: number; isExported: boolean; isAsync: boolean;
  }> = parseFunctions(source);

  for (const fn of fullFunctions) {
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
      fn.name, fileContents, r
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

  // ---- ts_function_activity_log INSERT（差分があったファイルのみ）----
  if (commit && hunks.length > 0) {
    const prevSource = getPrevFileContent(r);
    const prevFuncs: FunctionSnapshot[] = prevSource
      ? (parseFunctions(prevSource) as Array<{ name: string; startLine: number; endLine: number }>).map(f => ({
          name: f.name, startLine: f.startLine, endLine: f.endLine,
        }))
      : [];

    const changes = classifyFunctionChanges(prevFuncs, functions, hunks);

    for (const ch of changes) {
      const nsl = ch.newStartLine !== null ? String(ch.newStartLine) : 'NULL';
      const nel = ch.newEndLine   !== null ? String(ch.newEndLine)   : 'NULL';
      lines.push(
        `INSERT OR IGNORE INTO ts_function_activity_log` +
          ` (repo_id, commit_hash, commit_at, commit_subject, author_name, author_email, branch_name,` +
          ` file_path, function_name, change_type, lines_added, lines_deleted, new_start_line, new_end_line)` +
          ` VALUES (${REPO_ID}, '${esc(commit.hash)}', '${esc(commit.at)}', '${esc(commit.subject)}',` +
          ` '${esc(commit.authorName)}', '${esc(commit.authorEmail)}', '${esc(commit.branchName)}',` +
          ` '${esc(r)}', '${esc(ch.name)}', '${ch.changeType}',` +
          ` ${ch.linesAdded}, ${ch.linesDeleted}, ${nsl}, ${nel});`
      );
    }
  }
}

console.log(lines.join('\n'));
