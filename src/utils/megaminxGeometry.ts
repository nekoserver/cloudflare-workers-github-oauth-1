// 正十二面体(Megaminx)の幾何情報を、手打ちの組み合わせ表に頼らず
// 黄金比による標準的な頂点座標から純粋に計算で導出する。
//
// 面(どの5頂点が同じ面に属するか、その巡回順)は「面中心方向への内積」を
// 使う方法を最初に試したところ、面法線の座標公式の取り違え(検証手段が
// 無いテスト環境では気づけない典型的なバグ)により誤った面分割になることが
// 実際に発生した(このリポジトリのテスト環境にはWebGL描画が無く目視確認
// できない)。そのため、外部の座標公式には頼らず、頂点間の実距離だけから
// 隣接グラフ(各頂点は必ず3本の辺を持つ)を構築し、「有向辺をたどって
// 一周する面探索(half-edgeメッシュのface tracing)」で面を導出する。
// この方法は面の数・各面5頂点・全辺の被覆(2回ずつ)が自動的に保証される
// ため、外部公式の取り違えによるバグが原理的に起きない。

export type Vec3 = readonly [number, number, number];

const PHI = (1 + Math.sqrt(5)) / 2;

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function distance(a: Vec3, b: Vec3): number {
  const d = subtract(a, b);
  return Math.sqrt(dot(d, d));
}

/** ロドリゲスの回転公式。axisは単位ベクトルであること。 */
export function rotateAroundAxis(v: Vec3, axis: Vec3, angleRad: number): Vec3 {
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const k = axis;
  const kCrossV = cross(k, v);
  const kDotV = dot(k, v);
  return add(
    add(scale(v, cosA), scale(kCrossV, sinA)),
    scale(k, kDotV * (1 - cosA))
  );
}

/** 正十二面体の20頂点(黄金比による標準座標、正規化して単位球面上に置く)。 */
export function buildVertices(): Vec3[] {
  const raw: Array<[number, number, number]> = [];
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        raw.push([sx, sy, sz]);
      }
    }
  }
  for (const sy of [1, -1]) {
    for (const sz of [1, -1]) {
      raw.push([0, sy / PHI, sz * PHI]);
    }
  }
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      raw.push([sx / PHI, sy * PHI, 0]);
    }
  }
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      raw.push([sx * PHI, 0, sz / PHI]);
    }
  }
  return raw.map((v) => normalize(v));
}

/** 各頂点の辺隣接リスト(頂点index)。頂点間の最短距離を辺とみなす(次数3)。 */
function buildAdjacency(vertices: Vec3[]): number[][] {
  let minDist = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = 0; j < vertices.length; j++) {
      if (i === j) continue;
      const d = distance(vertices[i], vertices[j]);
      if (d < minDist) minDist = d;
    }
  }
  return vertices.map((v, i) =>
    vertices
      .map((w, j) => ({ j, d: distance(v, w) }))
      .filter((x) => x.j !== i && x.d < minDist * 1.05)
      .map((x) => x.j)
  );
}

/**
 * 有向辺(prev -> cur)から出発し、面の境界を一周してたどる。
 * curの隣接頂点(prevを除く)のうち、直前の進行方向から見て最も
 * 外向き(cur自身の位置ベクトルをその場の外向き法線の近似として使う)に
 * 左回りとなる頂点を次の頂点として選び続ける。凸多面体では十分な近似になる。
 */
function traceFace(start: number, second: number, adjacency: number[][], vertices: Vec3[]): number[] | null {
  const face = [start, second];
  let prev = start;
  let cur = second;
  for (let step = 0; step < 20; step++) {
    const candidates = adjacency[cur].filter((n) => n !== prev);
    let best: number | null = null;
    let bestScore = -Infinity;
    for (const n of candidates) {
      const d1 = subtract(vertices[cur], vertices[prev]);
      const d2 = subtract(vertices[n], vertices[cur]);
      const score = dot(cross(d1, d2), vertices[cur]);
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    if (best === null) return null;
    if (best === start) return face;
    face.push(best);
    prev = cur;
    cur = best;
  }
  return null;
}

export type FaceInfo = {
  normal: Vec3;
  /** この面に属する頂点(角ピース)のグローバルindex。面を外側から見て一周する順。 */
  cornerSlots: number[];
  /** この面に属する辺(辺ピース)のグローバルindex。cornerSlots[k]とcornerSlots[k+1]の間の辺。 */
  edgeSlots: number[];
};

export type DodecahedronGeometry = {
  vertices: Vec3[];
  faces: FaceInfo[];
  /** グローバル辺index -> 端点の頂点index2つ */
  edgeVertices: [number, number][];
};

export function buildDodecahedronGeometry(): DodecahedronGeometry {
  const vertices = buildVertices();
  const adjacency = buildAdjacency(vertices);

  const seenDirectedEdges = new Set<string>();
  const cornerFaces: number[][] = [];
  for (let a = 0; a < vertices.length; a++) {
    for (const b of adjacency[a]) {
      const key = `${a}_${b}`;
      if (seenDirectedEdges.has(key)) continue;
      const face = traceFace(a, b, adjacency, vertices);
      if (!face || face.length !== 5) continue;
      for (let k = 0; k < 5; k++) {
        seenDirectedEdges.add(`${face[k]}_${face[(k + 1) % 5]}`);
      }
      cornerFaces.push(face);
    }
  }

  const edgeKeyToId = new Map<string, number>();
  const edgeVertices: [number, number][] = [];
  function getOrCreateEdgeId(a: number, b: number): number {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    const existing = edgeKeyToId.get(key);
    if (existing !== undefined) return existing;
    const id = edgeVertices.length;
    edgeVertices.push([a, b]);
    edgeKeyToId.set(key, id);
    return id;
  }

  const faces: FaceInfo[] = cornerFaces.map((corners) => {
    const edgeSlots = corners.map((a, k) => getOrCreateEdgeId(a, corners[(k + 1) % 5]));
    const centroid = corners.reduce((acc, i) => add(acc, vertices[i]), [0, 0, 0] as Vec3);
    return { normal: normalize(centroid), cornerSlots: corners, edgeSlots };
  });

  return { vertices, faces, edgeVertices };
}
