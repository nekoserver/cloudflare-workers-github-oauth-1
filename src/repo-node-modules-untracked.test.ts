import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

// 対象: リポジトリの node_modules の扱い(2026-11-15)。
// fee856be で、node_modules が自分自身を指すシンボリックリンクとして紛れ込んだ。
// .gitignore の「node_modules/」は末尾のスラッシュのためディレクトリにしか当たらず、シンボリックリンクを除外できなかった。
// その結果、リポジトリの中で npx vitest が起動できず、push前のガード(scripts/claude-push-guard.js)が必ず失敗していた。
//
// 故障シナリオ:
//   (1) node_modules がgitで追跡されたままになる
//   (2) node_modules がシンボリックリンクのとき、.gitignore で除外されず再び追加される

const ROOT = path.join(__dirname, '..');
const git = (...args: string[]) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });

describe('node_modules をgitで追跡しない', () => {
  it('node_modules は追跡されていない', () => {
    expect(git('ls-files', '--', 'node_modules').trim()).toBe('');
  });

  it('node_modules は(シンボリックリンクでも).gitignoreで除外される', () => {
    // 「node_modules/」だと実体がディレクトリのときしか当たらない。末尾のスラッシュ無しの規則で除外する
    expect(git('check-ignore', '-v', '--no-index', 'node_modules').trim()).toBe('.gitignore:1:node_modules\tnode_modules');
  });
});
