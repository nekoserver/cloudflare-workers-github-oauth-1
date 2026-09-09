import { describe, it, expect } from 'vitest';
import { buildDodecahedronGeometry, dot, subtract } from './utils/megaminxGeometry';

// 対象: Megaminx(正十二面体パズル)の土台となる正十二面体の幾何情報
// (src/utils/megaminxGeometry.ts)。手打ちの隣接表を使わず、黄金比の
// 標準座標から純粋に計算で導出しているため、組み合わせ的な性質
// (面の数・頂点の数・隣接関係)を自動テストで検証する。WebGL描画が
// 無いこのテスト環境では目視確認ができないため、この構造検証が
// 唯一の正しさの根拠になる(CLAUDE.mdルール9: コード変更前にテストで
// 正しさを証明する)。
//
// 故障シナリオ:
//   (1) 面の頂点集め(内積上位5件)が正五角形にならない不正な形状になる
//   (2) 辺の重複排除に失敗し、30本ちょうどにならない
//   (3) 各頂点が3面に属さない(角ピースが3色にならない)、または
//       各辺が2面に属さない(辺ピースが2色にならない)
//   (4) 面の巡回順(cornerSlots)が幾何的に隣接していない頂点を含む
//       (面の回転操作で誤ったピースを動かしてしまう)

describe('buildDodecahedronGeometry', () => {
  const geo = buildDodecahedronGeometry();

  it('頂点は20個、面は12個ある', () => {
    expect(geo.vertices).toHaveLength(20);
    expect(geo.faces).toHaveLength(12);
  });

  it('辺はちょうど30本になる(重複排除が正しく機能している)', () => {
    expect(geo.edgeVertices).toHaveLength(30);
  });

  it('各面は5つの頂点を持ち、正五角形(全辺が等しい長さ)になる', () => {
    for (const face of geo.faces) {
      expect(face.cornerSlots).toHaveLength(5);
      const pts = face.cornerSlots.map((i) => geo.vertices[i]);
      const sideLengths = pts.map((p, k) => {
        const q = pts[(k + 1) % 5];
        const d = subtract(p, q);
        return Math.sqrt(dot(d, d));
      });
      const first = sideLengths[0];
      for (const len of sideLengths) {
        expect(len).toBeCloseTo(first, 5);
      }
    }
  });

  it('各面は5本の辺を持つ', () => {
    for (const face of geo.faces) {
      expect(face.edgeSlots).toHaveLength(5);
      expect(new Set(face.edgeSlots).size).toBe(5);
    }
  });

  it('各頂点はちょうど3つの面に属する(角ピースは3色)', () => {
    const countByVertex = new Array(20).fill(0);
    for (const face of geo.faces) {
      for (const v of face.cornerSlots) countByVertex[v]++;
    }
    for (const count of countByVertex) {
      expect(count).toBe(3);
    }
  });

  it('各辺はちょうど2つの面に属する(辺ピースは2色)', () => {
    const countByEdge = new Array(30).fill(0);
    for (const face of geo.faces) {
      for (const e of face.edgeSlots) countByEdge[e]++;
    }
    for (const count of countByEdge) {
      expect(count).toBe(2);
    }
  });

  it('各面はちょうど5つの隣接面(辺を共有する面)を持つ', () => {
    const adjacency: Set<number>[] = geo.faces.map(() => new Set<number>());
    const edgeToFaces = new Map<number, number[]>();
    geo.faces.forEach((face, fi) => {
      for (const e of face.edgeSlots) {
        const list = edgeToFaces.get(e) ?? [];
        list.push(fi);
        edgeToFaces.set(e, list);
      }
    });
    for (const facesOfEdge of edgeToFaces.values()) {
      expect(facesOfEdge).toHaveLength(2);
      const [a, b] = facesOfEdge;
      adjacency[a].add(b);
      adjacency[b].add(a);
    }
    for (const s of adjacency) {
      expect(s.size).toBe(5);
    }
  });

  it('面の巡回順(cornerSlots)は隣り合う頂点同士が実際に辺で結ばれている', () => {
    const edgeKeySet = new Set(geo.edgeVertices.map(([a, b]) => (a < b ? `${a}_${b}` : `${b}_${a}`)));
    for (const face of geo.faces) {
      for (let k = 0; k < 5; k++) {
        const a = face.cornerSlots[k];
        const b = face.cornerSlots[(k + 1) % 5];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        expect(edgeKeySet.has(key)).toBe(true);
      }
    }
  });

  it('各面の法線は、その面の頂点への内積が他の頂点より明確に大きい(正しい面選出)', () => {
    for (const face of geo.faces) {
      const dotsOnFace = face.cornerSlots.map((i) => dot(geo.vertices[i], face.normal));
      const minOnFace = Math.min(...dotsOnFace);
      const offFace = geo.vertices
        .map((v, i) => ({ i, d: dot(v, face.normal) }))
        .filter((x) => !face.cornerSlots.includes(x.i));
      const maxOffFace = Math.max(...offFace.map((x) => x.d));
      expect(minOnFace).toBeGreaterThan(maxOffFace);
    }
  });
});
