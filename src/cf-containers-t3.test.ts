import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// T3 Codeをデモコンテナ(本体のコンテナ)で動かす構成の配線を確認する。
// 実際にコンテナが起動してT3が応答するかは、scripts/check-cf-containers.shとデプロイ後の確認で見る
// (このテストはファイルの記述だけを見ており、動作は保証しない)。
const dockerfile = readFileSync('containers/demo/Dockerfile', 'utf-8');
const entrypoint = readFileSync('containers/demo/entrypoint.sh', 'utf-8');
const proxy = readFileSync('containers/demo/t3-embed-proxy.cjs', 'utf-8');
const checkScript = readFileSync('scripts/check-cf-containers.sh', 'utf-8');

describe('Dockerfile: T3 Codeの導入', () => {
  it('バージョンを固定し、専用のRUNで入れてキャッシュを同じRUNで消す', () => {
    expect(dockerfile).toMatch(/ARG T3_VERSION=\d+\.\d+\.\d+/);
    const run = dockerfile.match(/RUN [^\n]*npm install -g t3@\$\{T3_VERSION\}[\s\S]*?(?=\n(?:#|RUN|COPY|ARG|ENV|FROM|WORKDIR|ENTRYPOINT|CMD|$))/);
    expect(run).not.toBeNull();
    expect(run![0]).toMatch(/npm cache clean --force/);
  });

  it('本体(約122MB)をイメージに取り込むため、ビルド時に t3 --version を実行する', () => {
    const run = dockerfile.match(/RUN [^\n]*npm install -g t3@[\s\S]*?t3 --version/);
    expect(run).not.toBeNull();
  });

  it('中継のファイルをイメージへ配置する', () => {
    expect(dockerfile).toMatch(/COPY t3-embed-proxy\.cjs \/usr\/local\/libexec\/t3-embed-proxy\.cjs/);
  });
});

describe('entrypoint.sh: T3 Codeと中継の起動', () => {
  it('T3 Codeはloopbackの3773だけで待ち受け、ブラウザを開かない', () => {
    expect(entrypoint).toMatch(/t3 serve[^\n]*--host 127\.0\.0\.1[^\n]*--port 3773[^\n]*--no-browser|t3 serve[^\n]*--no-browser[^\n]*--host 127\.0\.0\.1[^\n]*--port 3773/);
    expect(entrypoint).not.toMatch(/t3 serve[^\n]*0\.0\.0\.0/);
  });

  it('中継を起動し、どちらも落ちたら待ってから再起動する(高速な再起動の連続を避ける)', () => {
    expect(entrypoint).toMatch(/t3-embed-proxy\.cjs/);
    const loops = entrypoint.match(/while true; do[\s\S]*?sleep \d+[\s\S]*?done/g) ?? [];
    expect(loops.some((l) => l.includes('t3 serve'))).toBe(true);
    expect(loops.some((l) => l.includes('t3-embed-proxy.cjs'))).toBe(true);
  });

  it('ペアリングコードや認証情報をログへ出さない設定にしていない(ログは/tmpの専用ファイル)', () => {
    expect(entrypoint).toMatch(/>>\/tmp\/t3\.log/);
    expect(entrypoint).toMatch(/>>\/tmp\/t3-proxy\.log/);
  });

  it('新しい環境変数(設定スイッチ)を追加していない', () => {
    expect(entrypoint).not.toMatch(/T3_[A-Z_]+:-/);
  });
});

describe('t3-embed-proxy.cjs', () => {
  it('127.0.0.1の3774だけで待ち受け、3773へ中継する', () => {
    expect(proxy).toMatch(/server\.listen\(3774, '127\.0\.0\.1'\)/);
    expect(proxy).toMatch(/port: 3773/);
  });

  it('埋め込み元(frame-ancestors)を絞る。任意のoriginを許可しない', () => {
    const m = proxy.match(/frame-ancestors ([^"']+)/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/\*/);
  });
});

describe('check-cf-containers.sh', () => {
  it('イメージ内で t3 --version を確認する', () => {
    expect(checkScript).toMatch(/t3 --version/);
  });
});
