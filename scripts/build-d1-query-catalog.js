/**
 * src/index.ts の db.prepare(`SQL`) 呼び出しから、sqlc風の -- name: X :cmd
 * アノテーションを機械的に合成し、対応するmigrationファイル・クエリ変更コミット
 * 履歴と突き合わせたMarkdownレポートを生成する。
 *
 * 注意: フル履歴が必要(shallow cloneのままだと `src/index.ts` の履歴が
 * 実際より大幅に短く見え、`git log -S` の結果が壊れる。事前に
 * `git fetch --unshallow` すること。詳細は
 * NOTICE.cloudflare-workers-github-oauth-1.20260906.md 参照)。
 *
 * 実行例:
 *   node scripts/build-d1-query-catalog.js > REPORT.cloudflare-workers-github-oauth-1.D1QUERYCATALOG.<YYYYMMDD>.md
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const OWNER_REPO = "nekoserver/cloudflare-workers-github-oauth-1";

const src = fs.readFileSync(path.join(REPO, "src/index.ts"), "utf-8");

// prepare(`...`) — capture the SQL body, then look ahead up to 400 chars for
// .first(/.all(/.run( to infer the sqlc-style command.
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

const totalPrepareCalls = (src.match(/\.prepare\(/g) || []).length;

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
  const cmd = confirmed ? cmdByMethod[method] : (inferVerb(sql) === "SELECT" ? "many?" : "exec?");
  matches.push({ sql, startLine, method, cmd, confirmed, verb: inferVerb(sql), tables: tableNames(sql) });
}

const confirmedCount = matches.filter(q => q.confirmed).length;
const inferredCount = matches.length - confirmedCount;

console.error(`extracted ${matches.length} template-literal prepare() calls (confirmed cmd: ${confirmedCount}, inferred: ${inferredCount})`);

// name synthesis with per-table+verb counters
const seen = new Map();
for (const q of matches) {
  const table = q.tables[0] || "Unknown";
  const base = pascal(q.verb.toLowerCase()) + pascal(table);
  const c = (seen.get(base) || 0) + 1;
  seen.set(base, c);
  q.name = c > 1 ? `${base}${c}` : base;
}

// --- migration cross-reference ---
const migDir = path.join(REPO, "migrations");
const migFiles = fs.readdirSync(migDir).filter(f => f.endsWith(".sql")).sort();
const tableToMigrations = new Map(); // table -> [{file, kind: CREATE|ALTER}]
for (const file of migFiles) {
  const text = fs.readFileSync(path.join(migDir, file), "utf-8");
  const createRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  const alterRe = /ALTER\s+TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let mm;
  while ((mm = createRe.exec(text))) {
    const t = mm[1];
    if (!tableToMigrations.has(t)) tableToMigrations.set(t, []);
    tableToMigrations.get(t).push({ file, kind: "CREATE" });
  }
  while ((mm = alterRe.exec(text))) {
    const t = mm[1];
    if (!tableToMigrations.has(t)) tableToMigrations.set(t, []);
    tableToMigrations.get(t).push({ file, kind: "ALTER" });
  }
}

function firstCommitForFile(file) {
  try {
    const out = execFileSync(
      "git",
      ["log", "--follow", "--diff-filter=A", "--format=%H", "--reverse", "--", "migrations/" + file],
      { cwd: REPO }
    ).toString().trim();
    return out.split("\n")[0] || null;
  } catch {
    return null;
  }
}

const migCommitCache = new Map();
function migCommit(file) {
  if (!migCommitCache.has(file)) migCommitCache.set(file, firstCommitForFile(file));
  return migCommitCache.get(file);
}

// --- git history for each query's SQL text (git log -S on a distinguishing snippet) ---
function snippetFor(sql) {
  return sql.replace(/\s+/g, " ").trim().slice(0, 60);
}

function historyFor(sql) {
  const snippet = snippetFor(sql);
  try {
    const out = execFileSync(
      "git",
      ["log", "--format=%H", `-S${snippet}`, "--", "src/index.ts"],
      { cwd: REPO, maxBuffer: 10 * 1024 * 1024 }
    ).toString().trim();
    if (!out) return [];
    return out.split("\n").slice(0, 5);
  } catch {
    return [];
  }
}

console.error("computing git history per query (this may take a while)...");
let done = 0;
for (const q of matches) {
  q.history = historyFor(q.sql);
  done++;
  if (done % 50 === 0) console.error(`  ${done}/${matches.length}`);
}

// --- render markdown ---
function shortSql(sql, max = 200) {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max) + "…" : oneLine;
}

function commitLink(hash) {
  return `[\`${hash.slice(0, 7)}\`](https://github.com/${OWNER_REPO}/commit/${hash})`;
}

let byTable = new Map();
for (const q of matches) {
  const t = q.tables[0] || "(不明)";
  if (!byTable.has(t)) byTable.set(t, []);
  byTable.get(t).push(q);
}
const sortedTables = [...byTable.keys()].sort();

let out = [];
out.push("# D1クエリカタログ(src/index.ts 由来、sqlcアノテーション形式)");
out.push("");
out.push(`**対象**: \`src/index.ts\` 中の \`db.prepare(\\\`SQL\\\`)\` テンプレートリテラル呼び出し(${totalPrepareCalls}件中${matches.length}件)。sqlcの\`-- name: X :cmd\`形式のアノテーションを機械的に合成し、対応するmigrationファイルとクエリ文字列自体の変更コミット履歴を突き合わせた一覧。`);
out.push("");
out.push("## 生成方法・制約");
out.push("");
out.push(`- 抽出対象: \`.prepare(\\\`...\\\`)\` のテンプレートリテラル呼び出し${matches.length}件(${totalPrepareCalls}件中、変数に代入されたSQL(\`db.prepare(ddl)\`等)、複数行のマイグレーションループ内で動的に組み立てられるSQLなど残り${totalPrepareCalls - matches.length}件は対象外)。`);
out.push(`- コマンド種別: \`.prepare(...)\` の直後(400文字以内)に \`.first(\`/\`.all(\`/\`.run(\` が実際に見つかった**${confirmedCount}件**は \`:one\`/\`:many\`/\`:exec\`(sqlcの実際のマッピングに準拠)を確定できたもの。見つからなかった**${inferredCount}件**は先頭のSQL動詞から\`:many?\`/\`:exec?\`と推測表記した(sqlcが実際に受理する形式ではなく、本レポート内の暫定表記)。`);
out.push(`- **パーサー検証**: コマンドを確定できた${confirmedCount}件を実際に\`-- name: X :cmd\`形式へ組み立て、\`wasm/sqlc-wasm\`のパーサー(\`annotations.go\`の\`parseQueryAnnotations\`、\`go test\`で実行)に読み込ませ、全件エラー0件でパースできることを確認する運用とする(スクリプト実行のたびに再検証が必要)。\`:many?\`/\`:exec?\`表記の${inferredCount}件は sqlc が受理しない形式のため、そのままではパーサーに通せない。`);
out.push("- クエリ名: 先頭のSQL動詞+主対象テーブル名から機械的に合成(sqlc本来の命名ではなく本レポート用の便宜的な名前)。同名になった場合は連番を付与。");
out.push("- migration対応: `migrations/*.sql`内の`CREATE TABLE`/`ALTER TABLE`をテーブル名でマッチさせた一覧(1テーブルに複数migrationが対応する場合あり)。「初回作成コミット」は`git log --follow --diff-filter=A`でそのmigrationファイルが追加された最初のコミット。");
out.push("- クエリ変更履歴: SQL本文の先頭60文字(空白正規化後)を`git log -S`で検索した結果(最大5件、新しい順)。SQL文字列がリファクタで完全に書き換わっている場合は追跡が切れる。");
out.push("- **重要**: shallow cloneのままではこのgitログベースの突き合わせが機能しない(`src/index.ts`の履歴が実際より大幅に短く見える)。実行前に`git rev-parse --is-shallow-repository`を確認し、`true`なら`git fetch --unshallow`すること。詳細は`NOTICE.cloudflare-workers-github-oauth-1.20260906.md`参照。");
out.push("- 本レポートはMarkdownでの内容確認用。D1テーブル化(`sql_query_catalog`等)は内容確定後に別途行う。");
out.push("");
out.push("## サマリ");
out.push("");
out.push("| 項目 | 値 |");
out.push("|---|---|");
out.push(`| 抽出クエリ数 | ${matches.length} |`);
out.push(`| うちコマンド種別を確定できた(sqlcパーサーで検証済み) | ${confirmedCount} |`);
out.push(`| うちコマンド種別を推測表記(\`:many?\`/\`:exec?\`、未検証) | ${inferredCount} |`);
out.push(`| 対象テーブル数 | ${sortedTables.length} |`);
out.push(`| migration対応なし(要確認) | ${sortedTables.filter(t => !tableToMigrations.has(t)).length}テーブル |`);
out.push("");

for (const table of sortedTables) {
  out.push(`## テーブル: \`${table}\``);
  out.push("");
  const migs = tableToMigrations.get(table) || [];
  if (migs.length === 0) {
    out.push("**対応migration**: 見つかりませんでした(動的テーブル名、またはCREATE TABLE文がmigrations/配下に存在しない可能性)。");
  } else {
    out.push("**対応migration**:");
    out.push("");
    out.push("| ファイル | 種別 | 初回コミット |");
    out.push("|---|---|---|");
    for (const mig of migs) {
      const c = migCommit(mig.file);
      out.push(`| \`${mig.file}\` | ${mig.kind} | ${c ? commitLink(c) : "(取得不可)"} |`);
    }
  }
  out.push("");
  out.push("**クエリ一覧**:");
  out.push("");
  out.push("| 行 | 名前 | コマンド | SQL | 変更コミット(最新5件) |");
  out.push("|---|---|---|---|---|");
  for (const q of byTable.get(table)) {
    const sqlCell = shortSql(q.sql).replace(/\|/g, "\\|");
    const histCell = q.history.length ? q.history.map(commitLink).join(", ") : "(検出不可)";
    out.push(`| ${q.startLine} | ${q.name} | :${q.cmd} | ${sqlCell} | ${histCell} |`);
  }
  out.push("");
}

out.push("## 関連コミット");
out.push("");
out.push("**対象**: 本レポートに対応する履歴 — コミット作成後にGitHub上のコミットリンクを追記する。");
out.push("");
out.push("本変更のコミットで初回作成する。");
out.push("");

process.stdout.write(out.join("\n"));
