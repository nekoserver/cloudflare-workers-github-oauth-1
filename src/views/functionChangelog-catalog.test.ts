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
