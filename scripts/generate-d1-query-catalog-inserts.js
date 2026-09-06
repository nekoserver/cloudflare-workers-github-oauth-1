/**
 * migrations/0129_create_d1_query_catalog.sql の d1_query_catalog テーブルへ、
 * src/index.ts の db.prepare(`SQL`) 呼び出し一覧をINSERTするSQLを生成する。
 *
 * scripts/build-d1-query-catalog.js と同じ抽出ロジック(重複実装、リポジトリの
 * 既存スクリプト群と同じくスタンドアロンで完結させる方針に合わせた)。
 *
 * 実行例:
 *   node scripts/generate-d1-query-catalog-inserts.js > /tmp/d1-query-catalog-inserts.sql
 */
const fs = require("fs");
const path = require("path");
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
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(sql))) names.add(m[1]);
  }
  return [...names];
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

function latestCommitFor(sql) {
  const snippet = snippetFor(sql);
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%H", `-S${snippet}`, "--", "src/index.ts"],
      { cwd: REPO, maxBuffer: 10 * 1024 * 1024 }
    ).toString().trim();
    return out || null;
  } catch {
    return null;
  }
}

console.error(`generating INSERTs for ${matches.length} queries...`);
let done = 0;
for (const q of matches) {
  q.migrationFile = q.table ? (tableToFirstMigration.get(q.table) || null) : null;
  q.lastCommit = latestCommitFor(q.sql);
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
for (let i = 0; i < matches.length; i += BATCH_SIZE) {
  const batch = matches.slice(i, i + BATCH_SIZE);
  out.push(
    "INSERT INTO d1_query_catalog (query_name, command, command_confirmed, table_name, source_file, source_line, sql_text, migration_file, last_commit_hash) VALUES\n" +
    batch.map(q =>
      `(${sqlValue(q.name)}, ${sqlValue(q.cmd)}, ${q.confirmed ? 1 : 0}, ${sqlValue(q.table)}, 'src/index.ts', ${q.startLine}, ${sqlValue(q.sql)}, ${sqlValue(q.migrationFile)}, ${sqlValue(q.lastCommit)})`
    ).join(",\n") +
    "\nON CONFLICT(source_file, source_line) DO UPDATE SET query_name = excluded.query_name, command = excluded.command, command_confirmed = excluded.command_confirmed, table_name = excluded.table_name, sql_text = excluded.sql_text, migration_file = excluded.migration_file, last_commit_hash = excluded.last_commit_hash;"
  );
}

process.stdout.write(out.join("\n\n") + "\n");
console.error(`wrote ${matches.length} rows in ${out.length} batched INSERT statements`);
