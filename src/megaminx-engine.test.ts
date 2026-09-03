import { describe, it, expect } from 'vitest';
import { buildDodecahedronGeometry } from './utils/megaminxGeometry';
import { applyMove, createSolvedState, getFaceColors, isSolved, type MegaminxState } from './utils/megaminx';

// 対象: Megaminx(正十二面体パズル)のピース状態管理・面回転(src/utils/megaminx.ts)。
// 幾何情報(src/utils/megaminxGeometry.ts)は構造検証済みだが、その上に載る
// 「回転操作が本当に物理的に正しい配置換え・向き変更を行うか」は別のロジックの
// ため、こちらも独立してテストする。WebGL描画が無いテスト環境では目視確認が
// できないため、以下の性質を根拠に正しさを検証する:
//   - 初期状態はsolved
//   - 1回転すればsolvedでなくなる
//   - 同じ面を5回回すと(360度)必ずsolvedに戻る
//   - 正回転→逆回転で必ずsolvedに戻る(往復の一貫性)
//   - スクランブル後、手順を逆順・逆方向で再生すればsolvedに戻る
//   - 1回の回転で変化するのは、その面に属するスロットだけ(無関係な
//     ピースが巻き込まれない)
//
// 故障シナリオ:
//   (1) 配置換え(occupant)とステッカー方向の回転が食い違い、5回転しても
//       solvedに戻らない
//   (2) 逆回転の角度・配置換え方向が正回転と非対称でinverseにならない
//   (3) 面に無関係なスロットまで巻き込んでしまう

function freshState(): { geometry: ReturnType<typeof buildDodecahedronGeometry>; state: MegaminxState } {
  const geometry = buildDodecahedronGeometry();
  const state = createSolvedState(geometry);
  return { geometry, state };
}

describe('createSolvedState / isSolved', () => {
  it('初期状態はsolvedである', () => {
    const { geometry, state } = freshState();
    expect(isSolved(state, geometry)).toBe(true);
  });

  it('1回でも面を回すとsolvedでなくなる', () => {
    const { geometry, state } = freshState();
    const moved = applyMove(state, geometry, 0, 1);
    expect(isSolved(moved, geometry)).toBe(false);
  });
});

describe('applyMove — 360度で復元する', () => {
  it('同じ面を同じ方向へ5回回すとsolvedに戻る(72度×5=360度)', () => {
    const { geometry, state } = freshState();
    let cur = state;
    for (let i = 0; i < 5; i++) {
      cur = applyMove(cur, geometry, 3, 1);
    }
    expect(isSolved(cur, geometry)).toBe(true);
  });

  it('全12面それぞれについて5回転で復元する', () => {
    const { geometry } = freshState();
    for (let faceIndex = 0; faceIndex < 12; faceIndex++) {
      let cur = createSolvedState(geometry);
      for (let i = 0; i < 5; i++) {
        cur = applyMove(cur, geometry, faceIndex, 1);
      }
      expect(isSolved(cur, geometry)).toBe(true);
    }
  });
});

describe('applyMove — 正回転と逆回転は互いに打ち消し合う', () => {
  it('ある面を+1回転してから-1回転するとsolvedに戻る', () => {
    const { geometry, state } = freshState();
    const forward = applyMove(state, geometry, 5, 1);
    const back = applyMove(forward, geometry, 5, -1);
    expect(isSolved(back, geometry)).toBe(true);
  });

  it('複数手のスクランブルを逆順・逆方向で再生するとsolvedに戻る', () => {
    const { geometry, state } = freshState();
    const moves: Array<[number, 1 | -1]> = [
      [0, 1], [3, -1], [7, 1], [1, 1], [9, -1], [4, 1],
    ];
    let cur = state;
    for (const [face, dir] of moves) {
      cur = applyMove(cur, geometry, face, dir);
    }
    expect(isSolved(cur, geometry)).toBe(false);
    for (let i = moves.length - 1; i >= 0; i--) {
      const [face, dir] = moves[i];
      cur = applyMove(cur, geometry, face, (dir === 1 ? -1 : 1) as 1 | -1);
    }
    expect(isSolved(cur, geometry)).toBe(true);
  });
});

describe('applyMove — 面に無関係なピースを巻き込まない', () => {
  it('回した面に属さない角スロットのピースは変化しない', () => {
    const { geometry, state } = freshState();
    const faceIndex = 2;
    const face = geometry.faces[faceIndex];
    const untouchedSlots = geometry.vertices.map((_, i) => i).filter((i) => !face.cornerSlots.includes(i));

    const moved = applyMove(state, geometry, faceIndex, 1);
    for (const slot of untouchedSlots) {
      expect(moved.cornerOccupant[slot]).toBe(state.cornerOccupant[slot]);
    }
  });

  it('回した面に属さない辺スロットのピースは変化しない', () => {
    const { geometry, state } = freshState();
    const faceIndex = 2;
    const face = geometry.faces[faceIndex];
    const untouchedSlots = geometry.edgeVertices.map((_, i) => i).filter((i) => !face.edgeSlots.includes(i));

    const moved = applyMove(state, geometry, faceIndex, 1);
    for (const slot of untouchedSlots) {
      expect(moved.edgeOccupant[slot]).toBe(state.edgeOccupant[slot]);
    }
  });

  it('回した面の5つの角スロットの中でピースが並べ替わる(集合として不変・順序が変わる)', () => {
    const { geometry, state } = freshState();
    const faceIndex = 6;
    const face = geometry.faces[faceIndex];
    const beforeSet = new Set(face.cornerSlots.map((s) => state.cornerOccupant[s]));

    const moved = applyMove(state, geometry, faceIndex, 1);
    const afterSet = new Set(face.cornerSlots.map((s) => moved.cornerOccupant[s]));
    expect(afterSet).toEqual(beforeSet);

    const beforeOrder = face.cornerSlots.map((s) => state.cornerOccupant[s]);
    const afterOrder = face.cornerSlots.map((s) => moved.cornerOccupant[s]);
    expect(afterOrder).not.toEqual(beforeOrder);
  });
});

describe('getFaceColors', () => {
  it('solved状態では、各面の中心・角5枚・辺5枚すべてがその面自身の色になる', () => {
    const { geometry, state } = freshState();
    for (let faceIndex = 0; faceIndex < 12; faceIndex++) {
      const colors = getFaceColors(state, geometry, faceIndex);
      expect(colors.center).toBe(faceIndex);
      for (const c of colors.corners) expect(c).toBe(faceIndex);
      for (const c of colors.edges) expect(c).toBe(faceIndex);
    }
  });

  it('回転した面自身は、回転後も全ステッカーがその面の色のまま(自面回転は自面の色を変えない)', () => {
    const { geometry, state } = freshState();
    const faceIndex = 8;
    const moved = applyMove(state, geometry, faceIndex, 1);
    const colors = getFaceColors(moved, geometry, faceIndex);
    for (const c of colors.corners) expect(c).toBe(faceIndex);
    for (const c of colors.edges) expect(c).toBe(faceIndex);
  });

  it('回転すると、隣接面のステッカー構成が変化する(その面自身の色以外が混ざり、実際に色が動いたことを検証)', () => {
    // 面自身のホームカラーは回転してもその面に留まり続ける(正しい挙動)ため、
    // 「faceIndexの色が他の面に移る」ことは期待しない。代わりに、隣接面
    // 自身の元々の色以外のステッカーが混ざり込むこと(=ピースが実際に
    // 移動したこと)を検証する。
    const { geometry, state } = freshState();
    const faceIndex = 8;
    const moved = applyMove(state, geometry, faceIndex, 1);
    let mixedFound = false;
    for (let f = 0; f < 12; f++) {
      if (f === faceIndex) continue;
      const colors = getFaceColors(moved, geometry, f);
      if (colors.corners.some((c) => c !== f) || colors.edges.some((c) => c !== f)) {
        mixedFound = true;
        break;
      }
    }
    expect(mixedFound).toBe(true);
  });
});
