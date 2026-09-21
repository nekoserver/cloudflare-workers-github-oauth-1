/**
 * migrations/0129・0130・0154 適用後の
 * d1_query_catalog テーブルへ、src/index.ts の db.prepare(`SQL`) 呼び出し一覧をINSERTするSQLを生成する。
 *
 * scripts/build-d1-query-catalog.js と同じ抽出ロジック(重複実装、リポジトリの
 * 既存スクリプト群と同じくスタンドアロンで完結させる方針に合わせた)。
 *
 * 実行例:
 *   node scripts/generate-d1-query-catalog-inserts.js > /tmp/d1-query-catalog-inserts.sql
 *   npx wrangler d1 execute workers-github-oauth --remote --file=/tmp/d1-query-catalog-inserts.sql
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");

const src = fs.readFileSync(path.join(REPO, "src/index.ts"), "utf-8");
const prepareRe = /\.prepare\(\s*`([^`]*)`\s*\)/gs;

function lineOf(offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (src[i] === "\n") line++;
  return line;
}

function inferVerb(sql) {
  const s = sql.trim().toUpperCase();
  if (s.startsWith("SELECT")) return "SELECT";
  if (s.startsWith("INSERT")) return "INSERT";
  if (s.startsWith("UPDATE")) return "UPDATE";
  if (s.startsWith("DELETE")) return "DELETE";
  if (s.startsWith("CREATE")) return "CREATE";
  return "OTHER";
}

function tableNames(sql) {
  const names = new Set();
  const patterns = [
    /\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /\bINTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /\bUPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /\bTABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    // CREATE [UNIQUE] INDEX ... ON <table>(...) — インデックス作成文の対象テーブル
    /\bON\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(sql))) names.add(m[1]);
  }
  return [...names];
}

// isDynamicTableRef: PRAGMA table_info(${tableName}) のように、テーブル名が
// JS側のテンプレートリテラル変数展開(${...})に依存していて静的に解決できない
// クエリを検出する。build-d1-query-catalog.jsと同じ判定ロジック。
function isDynamicTableRef(sql) {
  return /\$\{[^}]*\}/.test(sql);
}

function pascal(s) {
  return s.split(/[_\s]+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

const cmdByMethod = { first: "one", all: "many", run: "exec" };

let matches = [];
let m;
while ((m = prepareRe.exec(src))) {
  const sql = m[1].trim();
  if (!sql) continue;
  const startLine = lineOf(m.index);
  const after = src.slice(prepareRe.lastIndex, prepareRe.lastIndex + 400);
  const methodMatch = after.match(/\.\s*(first|all|run)\s*\(/);
  const method = methodMatch ? methodMatch[1] : null;
  const confirmed = !!method;
  const cmd = confirmed ? cmdByMethod[method] : (inferVerb(sql) === "SELECT" ? "many" : "exec");
  matches.push({ sql, startLine, confirmed, cmd, verb: inferVerb(sql), tables: tableNames(sql) });
}

const seen = new Map();
for (const q of matches) {
  const table = q.tables[0] || "Unknown";
  const base = pascal(q.verb.toLowerCase()) + pascal(table);
  const c = (seen.get(base) || 0) + 1;
  seen.set(base, c);
  q.name = c > 1 ? `${base}${c}` : base;
  q.table = q.tables[0] || null;
}

if (matches.length === 0) {
  throw new Error("No catalog queries were extracted; refusing to generate a destructive synchronization file");
}
const duplicateNames = matches
  .map(q => q.name.toLowerCase())
  .filter((name, index, names) => names.indexOf(name) !== index);
if (duplicateNames.length > 0) {
  throw new Error(`Duplicate catalog query names: ${[...new Set(duplicateNames)].join(", ")}`);
}

// --- migration cross-reference (first matching migration file only) ---
const migDir = path.join(REPO, "migrations");
const migFiles = fs.readdirSync(migDir).filter(f => f.endsWith(".sql")).sort();
const tableToFirstMigration = new Map();
for (const file of migFiles) {
  const text = fs.readFileSync(path.join(migDir, file), "utf-8");
  const createRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let mm;
  while ((mm = createRe.exec(text))) {
    const t = mm[1];
    if (!tableToFirstMigration.has(t)) tableToFirstMigration.set(t, file);
  }
}

// --- most recent commit touching each query's SQL text ---
function snippetFor(sql) {
  return sql.replace(/\s+/g, " ").trim().slice(0, 60);
}

// latestCommitFor: そのクエリのSQL本文を最後に変更したコミットのハッシュと、
// そのコミットの著者日時(YYYY-MM-DD HH:MM:SS、著者のローカルタイムゾーン)を
// 1回のgit呼び出しでまとめて取得する。
function latestCommitFor(sql) {
  const snippet = snippetFor(sql);
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%H%x1f%ad", "--date=format:%Y-%m-%d %H:%M:%S", `-S${snippet}`, "--", "src/index.ts"],
      { cwd: REPO, maxBuffer: 10 * 1024 * 1024 }
    ).toString().trim();
    if (!out) return { hash: null, at: null };
    const [hash, at] = out.split("\x1f");
    return { hash: hash || null, at: at || null };
  } catch {
    return { hash: null, at: null };
  }
}

console.error(`generating INSERTs for ${matches.length} queries...`);
let done = 0;
for (const q of matches) {
  q.migrationFile = q.table ? (tableToFirstMigration.get(q.table) || null) : null;
  const { hash, at } = latestCommitFor(q.sql);
  q.lastCommit = hash;
  q.lastCommitAt = at;
  done++;
  if (done % 50 === 0) console.error(`  ${done}/${matches.length}`);
}

function sqlQuote(s) {
  return "'" + s.replace(/'/g, "''") + "'";
}

function sqlValue(s) {
  return s === null ? "NULL" : sqlQuote(s);
}

const BATCH_SIZE = 40;
let out = [];
// 同じ生成結果は同じ世代IDになる。各行へ世代IDを書き込み、最後に今回の抽出結果へ
// 含まれない旧行を削除することで、行番号変更・クエリ削除・NULLを含む旧レコードを
// 次回同期まで残さない。
const syncGeneration = crypto.createHash("sha256")
  .update(JSON.stringify(matches.map(q => [q.name, q.sourceLine, q.sql])))
  .digest("hex");
for (let i = 0; i < matches.length; i += BATCH_SIZE) {
  const batch = matches.slice(i, i + BATCH_SIZE);
  out.push(
    "INSERT INTO d1_query_catalog (query_name, command, command_confirmed, table_name, source_file, source_line, sql_text, migration_file, last_commit_hash, last_commit_at, sync_generation) VALUES\n" +
    batch.map(q =>
      `(${sqlValue(q.name)}, ${sqlValue(q.cmd)}, ${q.confirmed ? 1 : 0}, ${sqlValue(q.table)}, 'src/index.ts', ${q.startLine}, ${sqlValue(q.sql)}, ${sqlValue(q.migrationFile)}, ${sqlValue(q.lastCommit)}, ${sqlValue(q.lastCommitAt)}, ${sqlValue(syncGeneration)})`
    ).join(",\n") +
    "\nON CONFLICT(query_name) DO UPDATE SET command = excluded.command, command_confirmed = excluded.command_confirmed, table_name = excluded.table_name, source_file = excluded.source_file, source_line = excluded.source_line, sql_text = excluded.sql_text, migration_file = excluded.migration_file, last_commit_hash = excluded.last_commit_hash, last_commit_at = excluded.last_commit_at, sync_generation = excluded.sync_generation, recorded_at = datetime('now');"
  );
}

out.push(`DELETE FROM d1_query_catalog WHERE sync_generation IS NULL OR sync_generation <> ${sqlValue(syncGeneration)};`);

process.stdout.write(out.join("\n\n") + "\n");
console.error(`wrote ${matches.length} rows in ${Math.ceil(matches.length / BATCH_SIZE)} batched INSERT statements`);
