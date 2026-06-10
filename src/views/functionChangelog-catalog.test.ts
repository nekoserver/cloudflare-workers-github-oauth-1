import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(path.join(__dirname, 'functionChangelog.ts'), 'utf-8');

// ===========================================================
// カタログモード & ファイル選択視覚分別テスト
// ===========================================================

describe('functionChangelog: CatalogFunctionRow インターフェース', () => {
  it('CatalogFunctionRow が export されている', () => {
    expect(src).toContain('export interface CatalogFunctionRow');
  });

  it('CatalogFunctionRow に start_line と end_line が含まれる', () => {
    const idx = src.indexOf('export interface CatalogFunctionRow');
    const block = src.slice(idx, idx + 400);
    expect(block).toContain('start_line');
    expect(block).toContain('end_line');
  });

  it('CatalogFunctionRow に caller_count が含まれる', () => {
    const idx = src.indexOf('export interface CatalogFunctionRow');
    const block = src.slice(idx, idx + 400);
    expect(block).toContain('caller_count');
  });
});

describe('functionChangelog: FunctionChangelogInput に catalogRows と indexedFiles が追加されている', () => {
  it('FunctionChangelogInput に catalogRows が含まれる', () => {
    const idx = src.indexOf('export interface FunctionChangelogInput');
    const block = src.slice(idx, idx + 600);
    expect(block).toContain('catalogRows');
  });

  it('FunctionChangelogInput に indexedFiles が含まれる', () => {
    const idx = src.indexOf('export interface FunctionChangelogInput');
    const block = src.slice(idx, idx + 600);
    expect(block).toContain('indexedFiles');
  });
});

describe('functionChangelog: ファイル選択で optgroup による視覚分別', () => {
  it('インデックス済みファイル用 optgroup ラベルが存在する', () => {
    expect(src).toMatch(/optgroup.*インデックス済み/);
  });

  it('未インデックスファイル用 disabled optgroup が存在する', () => {
    expect(src).toMatch(/optgroup[^>]*disabled[^>]*>/);
  });
});

describe('functionChangelog: カタログモードの UI 要素', () => {
  it('カタログモード切替ボタンが HTML に存在する', () => {
    expect(src).toMatch(/id=["']btnCatalogToggle["']/);
  });

  it('カタログテーブル用ラッパー要素が存在する', () => {
    expect(src).toMatch(/id=["']catalogWrap["']/);
  });

  it('catalogRows を JSON として渡す変数が存在する', () => {
    expect(src).toContain('CATALOG_ROWS');
  });

  it('INDEXED_FILES 変数が存在する', () => {
    expect(src).toContain('INDEXED_FILES');
  });
});

describe('functionChangelog: カタログテーブルのカラム', () => {
  it('カタログラップ内にファイルパス列がある', () => {
    expect(src).toContain('col-cat-file');
  });

  it('カタログラップ内に行番号列がある', () => {
    expect(src).toContain('col-cat-lines');
  });

  it('カタログラップ内に呼び出し元数列がある', () => {
    expect(src).toContain('col-cat-callers');
  });
});

describe('functionChangelog: カタログテーブルの行数カラムとソート', () => {
  it('行数カラム（col-cat-linecount）が存在する', () => {
    expect(src).toContain('col-cat-linecount');
  });

  it('行数カラムは説明カラムと行カラムの間に配置される', () => {
    const purposeIdx = src.indexOf('<th class="col-cat-purpose"');
    const lineCountIdx = src.indexOf('<th class="col-cat-linecount');
    const linesIdx = src.indexOf('<th class="col-cat-lines');
    expect(purposeIdx).toBeGreaterThan(-1);
    expect(lineCountIdx).toBeGreaterThan(purposeIdx);
    expect(linesIdx).toBeGreaterThan(lineCountIdx);
  });

  it('行数ヘッダにソット用 id（thCatLineCount）がある', () => {
    expect(src).toMatch(/id=["']thCatLineCount["']/);
  });

  it('呼び出し元ヘッダにソート用 id（thCatCallers)がある', () => {
    expect(src).toMatch(/id=["']thCatCallers["']/);
  });

  it('ソート状態を保持する catalogSortKey 変数が存在する', () => {
    expect(src).toContain('catalogSortKey');
  });

  it('ソート方向をトグルするロジックが存在する', () => {
    expect(src).toContain('catalogSortDir');
  });

  it('行数の計算（end_line - start_line + 1）が実装されている', () => {
    expect(src).toMatch(/end_line\s*-\s*r\.start_line\s*\+\s*1/);
  });

  it('空セルの colspan が 7 になっている', () => {
    expect(src).toMatch(/catalogBody[^]{0,200}colspan="7"/);
  });
});

describe('functionChangelog: 呼び出し元ありの行のハイライト', () => {
  it('caller_count が 1 以上の行に has-callers クラスを付与する', () => {
    expect(src).toMatch(/caller_count\s*>\s*0[^]{0,100}has-callers/);
  });

  it('has-callers の背景色は light-dark で定義されている（固定色禁止）', () => {
    const idx = src.indexOf('.has-callers');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 200);
    expect(block).toContain('light-dark(');
  });
});
