import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

// 対象: /public-keys・/login のIndexedDB(public-key-authデータベース, keypairsストア)
// 保存形式を{keyPair, userId, label}へ変更した際、変更前に登録済みだった
// エントリ(値がCryptoKeyPairそのもの)が新形式を前提とするコードで壊れた
// バグの修正。
//
// 症状: /loginページのパスキーログイン一覧に「(undefined)でログイン」と
// 表示され、クリックすると「この端末に秘密鍵が見つかりません」になる
// (旧形式エントリにはuserIdが無く、req.result.keyPairもundefinedのため)。
//
// 故障シナリオ:
//   (1) loadKeyPair系がreq.result.keyPairのみを見て、旧形式(値自体が
//       CryptoKeyPair)のフォールバックを持たない
//   (2) /loginページのlistLocalKeysがuserId無しのエントリをそのまま
//       ボタン化し、「(undefined)でログイン」という壊れたボタンを表示する
//   (3) /public-keysページを開いても、旧形式エントリが新形式へ書き換わらず
//       ずっと壊れたままになる

const publicKeysSrc = fs.readFileSync(path.join(__dirname, 'views', 'publicKeys.ts'), 'utf-8');
const loginSrc = fs.readFileSync(path.join(__dirname, 'views', 'login.ts'), 'utf-8');

describe('publicKeys.ts: 旧形式IndexedDBエントリへの耐性', () => {
  it('loadKeyPairはreq.result.keyPairが無ければreq.result自体をフォールバックとして使う', () => {
    expect(publicKeysSrc).toContain('resolve(req.result.keyPair || req.result);');
  });

  it('migrateLegacyKeyPairsでサーバー側の登録済み一覧と突き合わせて旧形式エントリを新形式へ書き換える', () => {
    expect(publicKeysSrc).toContain('function migrateLegacyKeyPairs(serverKeys)');
    expect(publicKeysSrc).toContain('if (value && !value.userId)');
  });

  it('loadKeys()がmigrateLegacyKeyPairsを呼び出す', () => {
    const start = publicKeysSrc.indexOf('function loadKeys()');
    const body = publicKeysSrc.slice(start, start + 500);
    expect(body).toContain('migrateLegacyKeyPairs(keys)');
  });
});

describe('login.ts: 旧形式IndexedDBエントリへの耐性', () => {
  it('userIdの無いエントリ(旧形式・未移行)は一覧から除外する', () => {
    const start = loginSrc.indexOf('function listLocalKeys()');
    const body = loginSrc.slice(start, start + 900);
    expect(body).toContain("filter(function(entry) { return !!entry.userId; })");
  });

  it('秘密鍵ロード時もreq.result.keyPairが無ければreq.result自体をフォールバックとして使う', () => {
    expect(loginSrc).toContain('resolve(req.result ? (req.result.keyPair || req.result) : null);');
  });
});
