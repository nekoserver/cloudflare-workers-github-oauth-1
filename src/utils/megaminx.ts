// Megaminx(正十二面体パズル)の状態管理・回転操作。
// src/utils/megaminxGeometry.tsで構築した(テストで構造検証済みの)幾何情報を
// 土台に、角ピース(20個・3色)・辺ピース(30個・2色)・中心ピース(12個・1色)の
// 現在位置と向きを純粋な3Dベクトル回転として管理する。
//
// 設計方針: 「どのスロットが次にどのスロットへ移るか」を手打ちの対応表に
// せず、実際にRodriguesの回転公式でスロットの3D座標を回転させ、回転後に
// 最も近いスロットへ対応付ける(nearest-match)。ピースが持つステッカーの
// 向きベクトルも同じ回転で実際に回すため、「配置換えの対応表」と
// 「ステッカーの向き」が食い違うバグが原理的に起きない。

import {
  type DodecahedronGeometry,
  type Vec3,
  add,
  buildDodecahedronGeometry,
  dot,
  rotateAroundAxis,
} from './megaminxGeometry';

export type Sticker = { homeFace: number; dir: Vec3 };

export type MegaminxState = {
  /** スロットindex(=頂点index, 0..19) -> 現在そこにある角ピースid */
  cornerOccupant: number[];
  /** 角ピースid -> 現在のステッカー(3枚)の向き */
  cornerStickers: Sticker[][];
  /** スロットindex(=辺index, 0..29) -> 現在そこにある辺ピースid */
  edgeOccupant: number[];
  /** 辺ピースid -> 現在のステッカー(2枚)の向き */
  edgeStickers: Sticker[][];
};

function edgeCenter(geometry: DodecahedronGeometry, edgeId: number): Vec3 {
  const [a, b] = geometry.edgeVertices[edgeId];
  return add(geometry.vertices[a], geometry.vertices[b]);
}

export function createSolvedState(geometry: DodecahedronGeometry): MegaminxState {
  const cornerHomeFaces: number[][] = geometry.vertices.map(() => []);
  const edgeHomeFaces: number[][] = geometry.edgeVertices.map(() => []);
  geometry.faces.forEach((face, faceIndex) => {
    for (const v of face.cornerSlots) cornerHomeFaces[v].push(faceIndex);
    for (const e of face.edgeSlots) edgeHomeFaces[e].push(faceIndex);
  });

  const cornerStickers: Sticker[][] = cornerHomeFaces.map((faceIds) =>
    faceIds.map((f) => ({ homeFace: f, dir: geometry.faces[f].normal }))
  );
  const edgeStickers: Sticker[][] = edgeHomeFaces.map((faceIds) =>
    faceIds.map((f) => ({ homeFace: f, dir: geometry.faces[f].normal }))
  );

  return {
    cornerOccupant: geometry.vertices.map((_, i) => i),
    cornerStickers,
    edgeOccupant: geometry.edgeVertices.map((_, i) => i),
    edgeStickers,
  };
}

function nearestSlot(rotatedPos: Vec3, candidateSlots: number[], slotPos: (slot: number) => Vec3): number {
  let best = candidateSlots[0];
  let bestScore = -Infinity;
  for (const s of candidateSlots) {
    const score = dot(rotatedPos, slotPos(s));
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/**
 * faceIndexの面を1/5回転(direction=+1で正回転、-1で逆回転)する。
 * この面に属する5つの角スロット・5つの辺スロットに乗っているピースを
 * 実際に3D回転させ、回転後の位置に最も近いスロットへ配置し直す。
 * ピースのステッカー方向ベクトルも同じ回転で実際に回すため、
 * 配置とステッカー色が食い違うことはない。
 */
export function applyMove(
  state: MegaminxState,
  geometry: DodecahedronGeometry,
  faceIndex: number,
  direction: 1 | -1
): MegaminxState {
  const face = geometry.faces[faceIndex];
  const angle = direction * ((2 * Math.PI) / 5);

  const newCornerOccupant = state.cornerOccupant.slice();
  const newCornerStickers = state.cornerStickers.map((s) => s.slice());
  for (const slot of face.cornerSlots) {
    const rotatedPos = rotateAroundAxis(geometry.vertices[slot], face.normal, angle);
    const destSlot = nearestSlot(rotatedPos, face.cornerSlots, (s) => geometry.vertices[s]);
    const pieceId = state.cornerOccupant[slot];
    newCornerOccupant[destSlot] = pieceId;
    newCornerStickers[pieceId] = state.cornerStickers[pieceId].map((st) => ({
      homeFace: st.homeFace,
      dir: rotateAroundAxis(st.dir, face.normal, angle),
    }));
  }

  const newEdgeOccupant = state.edgeOccupant.slice();
  const newEdgeStickers = state.edgeStickers.map((s) => s.slice());
  for (const slot of face.edgeSlots) {
    const rotatedPos = rotateAroundAxis(edgeCenter(geometry, slot), face.normal, angle);
    const destSlot = nearestSlot(rotatedPos, face.edgeSlots, (s) => edgeCenter(geometry, s));
    const pieceId = state.edgeOccupant[slot];
    newEdgeOccupant[destSlot] = pieceId;
    newEdgeStickers[pieceId] = state.edgeStickers[pieceId].map((st) => ({
      homeFace: st.homeFace,
      dir: rotateAroundAxis(st.dir, face.normal, angle),
    }));
  }

  return {
    cornerOccupant: newCornerOccupant,
    cornerStickers: newCornerStickers,
    edgeOccupant: newEdgeOccupant,
    edgeStickers: newEdgeStickers,
  };
}

const SOLVED_DOT_THRESHOLD = 0.999;

export function isSolved(state: MegaminxState, geometry: DodecahedronGeometry): boolean {
  for (let slot = 0; slot < state.cornerOccupant.length; slot++) {
    if (state.cornerOccupant[slot] !== slot) return false;
  }
  for (let slot = 0; slot < state.edgeOccupant.length; slot++) {
    if (state.edgeOccupant[slot] !== slot) return false;
  }
  for (const stickers of state.cornerStickers) {
    for (const s of stickers) {
      if (dot(s.dir, geometry.faces[s.homeFace].normal) < SOLVED_DOT_THRESHOLD) return false;
    }
  }
  for (const stickers of state.edgeStickers) {
    for (const s of stickers) {
      if (dot(s.dir, geometry.faces[s.homeFace].normal) < SOLVED_DOT_THRESHOLD) return false;
    }
  }
  return true;
}

/** 指定した面(faceIndex)に現在表示されている12枚(中心1+角5+辺5)のステッカーの色(=homeFace)を返す。 */
export function getFaceColors(
  state: MegaminxState,
  geometry: DodecahedronGeometry,
  faceIndex: number
): { center: number; corners: number[]; edges: number[] } {
  const face = geometry.faces[faceIndex];
  function colorOf(occupant: number, stickers: Sticker[][], slot: number): number {
    const pieceId = occupant;
    let best = stickers[pieceId][0];
    let bestScore = -Infinity;
    for (const s of stickers[pieceId]) {
      const score = dot(s.dir, face.normal);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best.homeFace;
  }
  const corners = face.cornerSlots.map((slot) => colorOf(state.cornerOccupant[slot], state.cornerStickers, slot));
  const edges = face.edgeSlots.map((slot) => colorOf(state.edgeOccupant[slot], state.edgeStickers, slot));
  return { center: faceIndex, corners, edges };
}

export function createDefaultMegaminx(): { geometry: DodecahedronGeometry; state: MegaminxState } {
  const geometry = buildDodecahedronGeometry();
  const state = createSolvedState(geometry);
  return { geometry, state };
}
