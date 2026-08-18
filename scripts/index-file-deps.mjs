#!/usr/bin/env node
/**
 * ファイル間依存関係(import)インデクサー
 *
 * 使い方:
 *   node scripts/index-file-deps.mjs
 *
 * src/ 以下の全 .ts ファイル(*.test.ts, *.d.ts を除く)を ast-grep(WASM, Rust製)で
 * パースし、相対パスのimport/re-export文からファイル間の依存エッジを抽出する。
 * 外部パッケージ(相対パスで始まらないimport)はファイル間依存の対象外として除外する。
 *
 * このスクリプトは意図的に .mjs(プレーンなNode ESM)にしている。
 * @ast-grep/wasm パッケージ内部で `.wasm` ファイルをESM importしており、
 * tsx(CJSトランスパイル)経由で読み込むと「Invalid or unexpected token」で
 * 壊れるため、tsxを介さずNodeネイティブのESMで直接実行する必要がある。
 *
 * 出力された SQL は D1 コンソールでそのまま実行すること。毎回 src/ 全体を
 * 再計算するため、対象ファイルの既存エッジを一旦 DELETE してから INSERT する
 * (関数カタログのような差分更新ではなく、フルリフレッシュ)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTreeSitter, registerDynamicLanguage, parse } from '@ast-grep/wasm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO_ID = 1;

function getAllTsFiles(dir) {
  const results = [];
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

function rel(abs) {
  return path.relative(ROOT, abs).replace(/\\/g, '/');
}

function esc(s) {
  return s.replace(/'/g, "''");
}

/**
 * 相対import指定子(例: './foo', '../utils/bar')を実ファイルの絶対パスへ解決する。
 * 拡張子省略(.ts / index.ts)を試し、見つからなければnullを返す(握りつぶさず
 * 呼び出し元でunresolvedとして記録する)。
 */
function resolveRelativeImport(fromFileAbs, specifier) {
  const baseDir = path.dirname(fromFileAbs);
  const target = path.resolve(baseDir, specifier);
  const candidates = [target + '.ts', path.join(target, 'index.ts')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

async function extractEdgesFromFile(absPath) {
  const src = fs.readFileSync(absPath, 'utf-8');
  const root = parse('typescript', src).root();
  const edges = [];
  const unresolved = [];

  const importNodes = [
    ...root.findAll({ rule: { kind: 'import_statement' } }),
    ...root.findAll({ rule: { kind: 'export_statement' } }),
  ];

  for (const node of importNodes) {
    const sourceNode = node.field('source');
    if (!sourceNode) continue;
    const raw = sourceNode.text();
    const specifier = raw.slice(1, -1); // 前後のクォートを除去
    if (!specifier.startsWith('.')) continue; // 外部パッケージは対象外

    const resolved = resolveRelativeImport(absPath, specifier);
    if (!resolved) {
      unresolved.push(specifier);
      continue;
    }
    edges.push({ sourceFile: rel(absPath), targetFile: rel(resolved) });
  }

  return { edges, unresolved };
}

async function main() {
  await initializeTreeSitter();
  await registerDynamicLanguage({
    typescript: {
      libraryPath: path.join(ROOT, 'node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm'),
    },
  });

  const files = getAllTsFiles(path.join(ROOT, 'src'));
  const lines = [];
  const allEdges = [];
  const unresolvedByFile = {};

  for (const absPath of files) {
    const { edges, unresolved } = await extractEdgesFromFile(absPath);
    allEdges.push(...edges);
    if (unresolved.length > 0) {
      unresolvedByFile[rel(absPath)] = unresolved;
    }
  }

  const touchedSourceFiles = [...new Set(files.map(rel))];
  for (const sourceFile of touchedSourceFiles) {
    lines.push(`DELETE FROM ts_file_dependencies WHERE repo_id=${REPO_ID} AND source_file='${esc(sourceFile)}';`);
  }

  // 同一ファイルペアへの複数import(名前付きimportの複数行等)は1エッジに集約する
  const dedupKeys = new Set();
  for (const edge of allEdges) {
    const key = `${edge.sourceFile} ${edge.targetFile}`;
    if (dedupKeys.has(key)) continue;
    dedupKeys.add(key);
    lines.push(
      `INSERT INTO ts_file_dependencies (repo_id, source_file, target_file, updated_at)` +
        ` VALUES (${REPO_ID}, '${esc(edge.sourceFile)}', '${esc(edge.targetFile)}', datetime('now'))` +
        ` ON CONFLICT(repo_id, source_file, target_file) DO UPDATE SET updated_at = excluded.updated_at;`
    );
  }

  console.log(lines.join('\n'));

  const unresolvedFileCount = Object.keys(unresolvedByFile).length;
  if (unresolvedFileCount > 0) {
    console.error(`\n# 解決できなかった相対import(${unresolvedFileCount}ファイル、標準エラー出力):`);
    for (const [file, specifiers] of Object.entries(unresolvedByFile)) {
      console.error(`#   ${file}: ${specifiers.join(', ')}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
