#!/usr/bin/env node
// MoonBitのソース(moonbit/<pkg>/*.mbt)をJSバックエンドでコンパイルし、
// src/generated/moonbit/<pkg>.js(ESモジュール)として書き出す。
//
// 生成物はリポジトリにコミットする。Workers Builds(本番ビルド)ではMoonBitの
// ツールチェインを使わず、コミット済みのJSをそのままバンドルする。
//
// コンパイラ: @moonbit/moonc-worker(公式のブラウザ向けmoonc)。標準ライブラリの
// .mi/.coreはこのコンパイラと同じビルドで作られたものが必要なため、ペアになる
// @marianoguerra/tutuca-playground-payloadを使う(版を混ぜると壊れた診断が出る)。
// cli.moonbitlang.comに届かない環境(Claude Codeのサンドボックス等)でもnpmだけで動く。
//
// 使い方:
//   node scripts/build-moonbit.mjs          生成物を書き出す
//   node scripts/build-moonbit.mjs --check  生成物がソースと一致するか確認する(不一致なら終了コード1)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLCHAIN_DIR = join(ROOT, '.moonbit-toolchain');
const COMPILER = '@moonbit/moonc-worker@0.1.202608195';
const PAYLOAD = '@marianoguerra/tutuca-playground-payload@0.23.0';

// パッケージごとの設定。exportsはJSから呼ぶ関数(pub fn)の名前
const PACKAGES = [{ name: 'buildlog', pkg: 'nekoserver/buildlog', exports: ['analyze_build_log'] }];

function ensureToolchain() {
  const marker = join(TOOLCHAIN_DIR, 'node_modules', '@moonbit', 'moonc-worker', 'package.json');
  if (existsSync(marker)) return;
  mkdirSync(TOOLCHAIN_DIR, { recursive: true });
  execFileSync('npm', ['install', '--prefix', TOOLCHAIN_DIR, '--no-save', '--no-audit', '--no-fund', '--ignore-scripts', COMPILER, PAYLOAD], { stdio: 'inherit' });
}

function loadToolchain() {
  ensureToolchain();
  const require = createRequire(join(TOOLCHAIN_DIR, 'package.json'));
  const moonc = require('@moonbit/moonc-worker');
  const payload = join(TOOLCHAIN_DIR, 'node_modules', '@marianoguerra', 'tutuca-playground-payload', 'playground');
  const manifest = JSON.parse(readFileSync(join(payload, 'manifest.json'), 'utf8'));
  const workerVersion = JSON.parse(readFileSync(join(TOOLCHAIN_DIR, 'node_modules', '@moonbit', 'moonc-worker', 'package.json'), 'utf8')).version;
  if (workerVersion.split('+')[0] !== manifest.mooncWorker) {
    throw new Error(`コンパイラ(${workerVersion})と標準ライブラリ(${manifest.mooncWorker}向け)の版が一致しません`);
  }
  const js = manifest.targets.js;
  const read = (p) => new Uint8Array(readFileSync(join(payload, 'fs', 'js', p)));
  const std = js.std.map((p) => [p, read(p)]);
  // 標準ライブラリのリンクに必要なのはabortとcore本体のみ(tutuca固有のcoreは使わない)
  const cores = js.linkOrder.filter((p) => /_abort_abort\.core$|_bundle_core\.core$/.test(p)).map(read);
  if (cores.length !== 2) throw new Error('標準ライブラリのcore(abort/bundle_core)が見つかりません');
  return { moonc, std, cores, toolchain: manifest.toolchain, workerVersion };
}

function compile(tc, { name, pkg, exports }) {
  const dir = join(ROOT, 'moonbit', name);
  const files = readdirSync(dir).filter((f) => f.endsWith('.mbt') && !f.endsWith('_test.mbt')).sort();
  const mbtFiles = files.map((f) => [f, readFileSync(join(dir, f), 'utf8')]);
  const built = tc.moonc.buildPackage({
    mbtFiles, miFiles: [], indirectImportMiFiles: [], stdMiFiles: tc.std, target: 'js', pkg,
    pkgSources: [`${pkg}:.`], isMain: false, errorFormat: 'human', enableValueTracing: false, noOpt: false,
  });
  const diagnostics = (built.diagnostics || []).filter((d) => d.trim());
  if (!built.core) throw new Error(`${name}: コンパイルに失敗しました\n${diagnostics.join('\n')}`);
  // 警告も生成物の品質に関わるため、残っていれば失敗にする
  if (diagnostics.length) throw new Error(`${name}: 警告があります\n${diagnostics.join('\n')}`);
  const linked = tc.moonc.linkCore({
    coreFiles: [...tc.cores, built.core], main: pkg, pkgSources: [`${pkg}:.`], target: 'js',
    exportedFunctions: exports, outputFormat: 'wasm', testMode: false, debug: false, noOpt: false,
    sourceMap: false, sources: {}, stopOnMain: false,
  });
  const js = Buffer.from(linked.result).toString('utf8');
  // Workersはグローバルスコープ(モジュール読み込み時)での乱数生成・タイマー・I/Oを禁止しており、
  // 含まれているとデプロイ時の検証(code 10021)で失敗する。MoonBitのMap等は読み込み時に乱数シードを作るため検出して止める
  const forbidden = ['getRandomValues', 'Math.random', 'setTimeout', 'setInterval', 'fetch('].filter((w) => js.includes(w));
  if (forbidden.length) throw new Error(`${name}: Workersのグローバルスコープで禁止されている処理が生成物に含まれます: ${forbidden.join(', ')}(Map/Set等の乱数シードを使う型を避けること)`);
  const header = `// このファイルは scripts/build-moonbit.mjs が moonbit/${name}/ から生成する。手で編集しないこと。\n` +
    `// コンパイラ: @moonbit/moonc-worker ${tc.workerVersion} (moonc ${tc.toolchain}) / target: js\n`;
  return header + js;
}

const check = process.argv.includes('--check');
const tc = loadToolchain();
let stale = 0;
for (const p of PACKAGES) {
  const out = join(ROOT, 'src', 'generated', 'moonbit', `${p.name}.js`);
  const code = compile(tc, p);
  if (check) {
    const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
    if (current !== code) { stale++; console.error(`NG: ${out} がソースと一致しません。node scripts/build-moonbit.mjs を実行してください`); }
    else console.log(`OK: ${p.name}`);
  } else {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, code);
    console.log(`wrote ${out} (${code.length} bytes)`);
  }
}
process.exit(stale ? 1 : 0);
