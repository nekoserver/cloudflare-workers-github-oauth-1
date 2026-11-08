// D1 agent-inquiriesのマイグレーションを番号順にSQLiteへ当て、議題の過程(8段)の記録の制約を確かめる。
// SPEC.cloudflare-workers-github-oauth-1.20261108.proposal-rule.md 7章(2026-11-08に利用者が承認)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const DIR = new URL('../migrations-agent-inquiries/', import.meta.url);
const STEPS = ['proposal', 'alignment', 'issues', 'similar', 'abstraction', 'spec_approval', 'implementation', 'trial'];

function migrated() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON'); // D1は外部キーを常に強制する
  for (const name of readdirSync(DIR).filter((n) => n.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(name, DIR), 'utf8'));
  }
  db.prepare("INSERT INTO inquiry_cases (id, goal) VALUES ('c1', '目的')").run();
  db.prepare("INSERT INTO inquiry_entries (id, case_id, seq, clue, asked_by, agent, question) VALUES ('e1', 'c1', 1, '手がかり', 'user', 'user', '発言')").run();
  return db;
}

test('inquiry_casesに発案者(proposed_by)があり、既存の行は未設定のまま', () => {
  const db = migrated();
  assert.equal(db.prepare("SELECT proposed_by FROM inquiry_cases WHERE id = 'c1'").get().proposed_by, null);
  db.prepare("UPDATE inquiry_cases SET proposed_by = 'user' WHERE id = 'c1'").run();
  assert.equal(db.prepare("SELECT proposed_by FROM inquiry_cases WHERE id = 'c1'").get().proposed_by, 'user');
});

test('inquiry_case_stepsは8段を受け付け、既定はtodo', () => {
  const db = migrated();
  const insert = db.prepare("INSERT INTO inquiry_case_steps (case_id, step) VALUES ('c1', ?)");
  for (const step of STEPS) insert.run(step);
  const rows = db.prepare("SELECT step, status, updated_at FROM inquiry_case_steps WHERE case_id = 'c1'").all();
  assert.equal(rows.length, 8);
  for (const row of rows) {
    assert.equal(row.status, 'todo');
    assert.match(row.updated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  }
});

test('段と状態は決めた値だけ。同じ議題の同じ段は1行', () => {
  const db = migrated();
  assert.throws(() => db.prepare("INSERT INTO inquiry_case_steps (case_id, step) VALUES ('c1', 'review')").run(), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO inquiry_case_steps (case_id, step, status) VALUES ('c1', 'proposal', 'doing')").run(), /CHECK/);
  db.prepare("INSERT INTO inquiry_case_steps (case_id, step, status, note) VALUES ('c1', 'similar', 'skipped', '文言だけの修正')").run();
  assert.throws(() => db.prepare("INSERT INTO inquiry_case_steps (case_id, step) VALUES ('c1', 'similar')").run(), /UNIQUE|PRIMARY/);
});

test('無い議題には段を書けず、議題を消すと段も消え、根拠の問い合わせを消すとentry_idだけ空になる', () => {
  const db = migrated();
  assert.throws(() => db.prepare("INSERT INTO inquiry_case_steps (case_id, step) VALUES ('nope', 'proposal')").run(), /FOREIGN KEY/);
  db.prepare("INSERT INTO inquiry_case_steps (case_id, step, status, entry_id) VALUES ('c1', 'proposal', 'done', 'e1')").run();
  db.prepare("DELETE FROM inquiry_entries WHERE id = 'e1'").run();
  const row = db.prepare("SELECT status, entry_id FROM inquiry_case_steps WHERE case_id = 'c1' AND step = 'proposal'").get();
  assert.equal(row.entry_id, null);
  assert.equal(row.status, 'done');
  db.prepare("DELETE FROM inquiry_cases WHERE id = 'c1'").run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inquiry_case_steps').get().n, 0);
});
