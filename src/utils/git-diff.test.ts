import { describe, it, expect } from 'vitest';
import { parseHunks, diffForRange, classifyFunctionChanges, type FunctionSnapshot } from './git-diff';

// unified diff サンプル（--unified=0 形式）
const SAMPLE_DIFF = `
diff --git a/src/foo.ts b/src/foo.ts
index abc..def 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -10,3 +10,5 @@
-old line A
-old line B
-old line C
+new line 1
+new line 2
+new line 3
+new line 4
+new line 5
@@ -30,2 +32,0 @@
-removed line X
-removed line Y
@@ -50,0 +50,3 @@
+pure insert 1
+pure insert 2
+pure insert 3
`.trim();

describe('parseHunks', () => {
  it('3つのハンクを正しくパースする', () => {
    const hunks = parseHunks(SAMPLE_DIFF);
    expect(hunks).toHaveLength(3);
  });

  it('第1ハンク: old 10,3 / new 10,5', () => {
    const h = parseHunks(SAMPLE_DIFF)[0];
    expect(h.oldStart).toBe(10);
    expect(h.oldCount).toBe(3);
    expect(h.newStart).toBe(10);
    expect(h.newCount).toBe(5);
    expect(h.addedLines).toBe(5);
    expect(h.deletedLines).toBe(3);
  });

  it('第2ハンク: 純粋削除（newCount=0）', () => {
    const h = parseHunks(SAMPLE_DIFF)[1];
    expect(h.newCount).toBe(0);
    expect(h.deletedLines).toBe(2);
    expect(h.addedLines).toBe(0);
  });

  it('第3ハンク: 純粋追加（oldCount=0）', () => {
    const h = parseHunks(SAMPLE_DIFF)[2];
    expect(h.oldCount).toBe(0);
    expect(h.addedLines).toBe(3);
    expect(h.deletedLines).toBe(0);
  });

  it('ハンク行数省略（,1 省略）を正しく処理する', () => {
    const diff = '@@ -5 +5 @@\n-x\n+y\n';
    const h = parseHunks(diff)[0];
    expect(h.oldCount).toBe(1);
    expect(h.newCount).toBe(1);
  });

  it('diff がない場合は空配列を返す', () => {
    expect(parseHunks('')).toHaveLength(0);
    expect(parseHunks('no hunk here\njust text')).toHaveLength(0);
  });
});

describe('diffForRange', () => {
  it('関数範囲内のハンクを集計する', () => {
    const hunks = parseHunks(SAMPLE_DIFF);
    // 関数が行 8〜20 にある場合、第1ハンク（new 10–14）が重なる
    const r = diffForRange(hunks, 8, 20);
    expect(r.linesAdded).toBe(5);
    expect(r.linesDeleted).toBe(3);
  });

  it('純粋削除ハンク（newCount=0）が関数範囲内なら集計する', () => {
    const hunks = parseHunks(SAMPLE_DIFF);
    // 第2ハンク: newStart=32 が関数範囲 [30,40] 内
    const r = diffForRange(hunks, 30, 40);
    expect(r.linesDeleted).toBe(2);
    expect(r.linesAdded).toBe(0);
  });

  it('純粋追加ハンク（oldCount=0）が関数範囲内なら集計する', () => {
    const hunks = parseHunks(SAMPLE_DIFF);
    // 第3ハンク: newStart=50, newCount=3 → new 50–52 が [48,60] に重なる
    const r = diffForRange(hunks, 48, 60);
    expect(r.linesAdded).toBe(3);
    expect(r.linesDeleted).toBe(0);
  });

  it('関数範囲外のハンクは無視する', () => {
    const hunks = parseHunks(SAMPLE_DIFF);
    const r = diffForRange(hunks, 100, 200);
    expect(r.linesAdded).toBe(0);
    expect(r.linesDeleted).toBe(0);
  });

  it('ハンクがない場合は 0,0 を返す', () => {
    const r = diffForRange([], 1, 100);
    expect(r.linesAdded).toBe(0);
    expect(r.linesDeleted).toBe(0);
  });

  it('範囲の端で境界ハンクを正しく判定する（境界ぴったり重なり）', () => {
    const diff = '@@ -1,1 +5,1 @@\n-a\n+b\n';
    const hunks = parseHunks(diff);
    expect(diffForRange(hunks, 5, 5).linesAdded).toBe(1);
    expect(diffForRange(hunks, 6, 10).linesAdded).toBe(0);
  });
});

// ---------------------------------------------------
// classifyFunctionChanges テスト
// ---------------------------------------------------

const MODIFY_DIFF = `@@ -10,3 +10,4 @@
-old
+new1
+new2
`.trim();

describe('classifyFunctionChanges', () => {
  const prev: FunctionSnapshot[] = [
    { name: 'alpha', startLine: 5,  endLine: 15 },
    { name: 'beta',  startLine: 20, endLine: 30 },
    { name: 'gamma', startLine: 35, endLine: 50 },
  ];
  const curr: FunctionSnapshot[] = [
    { name: 'alpha', startLine: 5,  endLine: 16 }, // modified (line range changed)
    { name: 'delta', startLine: 20, endLine: 30 }, // new (beta deleted, delta added)
    { name: 'gamma', startLine: 37, endLine: 52 }, // not touched (no diff)
  ];
  const hunks = parseHunks(MODIFY_DIFF); // hunk at new lines 10-13, overlaps alpha (5-16)

  it('diff がある既存関数を modify として検出する', () => {
    const changes = classifyFunctionChanges(prev, curr, hunks);
    const alpha = changes.find(c => c.name === 'alpha');
    expect(alpha).toBeDefined();
    expect(alpha!.changeType).toBe('modify');
    expect(alpha!.linesAdded).toBe(2);
    expect(alpha!.linesDeleted).toBe(1);
  });

  it('前バージョンにない関数を add として検出する', () => {
    const changes = classifyFunctionChanges(prev, curr, hunks);
    const delta = changes.find(c => c.name === 'delta');
    expect(delta).toBeDefined();
    expect(delta!.changeType).toBe('add');
    expect(delta!.newStartLine).toBe(20);
    expect(delta!.newEndLine).toBe(30);
  });

  it('add のとき linesAdded は関数の行数（diff がない場合）', () => {
    const changes = classifyFunctionChanges([], curr, []);
    const delta = changes.find(c => c.name === 'delta')!;
    expect(delta.linesAdded).toBe(30 - 20 + 1);
  });

  it('現行バージョンにない関数を delete として検出する', () => {
    const changes = classifyFunctionChanges(prev, curr, hunks);
    const beta = changes.find(c => c.name === 'beta');
    expect(beta).toBeDefined();
    expect(beta!.changeType).toBe('delete');
    expect(beta!.linesDeleted).toBe(30 - 20 + 1);
    expect(beta!.newStartLine).toBeNull();
    expect(beta!.newEndLine).toBeNull();
  });

  it('diff が当たっていない既存関数は結果に含まれない', () => {
    const changes = classifyFunctionChanges(prev, curr, hunks);
    const gamma = changes.find(c => c.name === 'gamma' && c.changeType === 'modify');
    expect(gamma).toBeUndefined();
  });

  it('空入力はすべて空を返す', () => {
    expect(classifyFunctionChanges([], [], [])).toHaveLength(0);
  });

  it('前バージョンが空ならすべて add になる', () => {
    const changes = classifyFunctionChanges([], curr, []);
    expect(changes.every(c => c.changeType === 'add')).toBe(true);
    expect(changes).toHaveLength(curr.length);
  });

  it('現行バージョンが空ならすべて delete になる', () => {
    const changes = classifyFunctionChanges(prev, [], []);
    expect(changes.every(c => c.changeType === 'delete')).toBe(true);
    expect(changes).toHaveLength(prev.length);
  });
});
