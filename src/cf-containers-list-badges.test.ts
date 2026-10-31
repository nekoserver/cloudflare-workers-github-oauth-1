import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { getCfContainersPage } from './views/cfContainers';

// /cf-containers の「コンテナ一覧」: JSONのままではなく、各コンテナの行に要素を色分けしたバッジで出す(ユーザー指定 2026-10-31)。
// 状態の意味が分かるものは色を付け(ok=緑・warn=黄・ng=赤)、それ以外の値も灰色(info)で全部出す。
const html = getCfContainersPage();
const source = html.slice(html.indexOf('/* container-badges:start */'), html.indexOf('/* container-badges:end */'));
// eslint-disable-next-line no-new-func
const { containerRowBadges, instanceStateLevel } = new Function(source + '; return { containerRowBadges, instanceStateLevel };')();
type Badge = { label: string; level: string };

describe('コンテナ一覧のバッジ', () => {
  it('ページのscriptに、バッジを作る関数がある', () => {
    expect(source.length).toBeGreaterThan(0);
  });
  it('健康状態のインスタンス数を、意味ごとの色で出す(0は出さない)', () => {
    const badges: Badge[] = containerRowBadges({ id: 'a1', name: 'dynamicneko-sandboxterminal', version: 1, instances: 2, health: { instances: { active: 1, healthy: 1, starting: 1, scheduling: 0, failed: 2, stopped: 0 } } });
    expect(badges).toEqual(expect.arrayContaining([
      { label: 'active 1', level: 'ok' }, { label: 'healthy 1', level: 'ok' }, { label: 'starting 1', level: 'warn' }, { label: 'failed 2', level: 'ng' },
    ]));
    expect(badges.find(b => b.label.startsWith('scheduling'))).toBeUndefined();
    expect(badges).toEqual(expect.arrayContaining([{ label: 'version 1', level: 'info' }, { label: 'instances 2', level: 'info' }]));
  });
  it('名前の分からない項目も、値を灰色のバッジで出す(入れ子のオブジェクトは「キー.キー」)', () => {
    const badges: Badge[] = containerRowBadges({ id: 'a1', name: 'x', configuration: { instance_type: 'lite', image: 'registry/x@sha256:abc' }, scheduling_policy: 'durable_objects' });
    expect(badges).toEqual(expect.arrayContaining([
      { label: 'configuration.instance_type lite', level: 'info' }, { label: 'scheduling_policy durable_objects', level: 'info' },
    ]));
  });
  it('インスタンスの状態に色を付ける', () => {
    expect(['running', 'active', 'healthy'].map(instanceStateLevel)).toEqual(['ok', 'ok', 'ok']);
    expect(['starting', 'scheduling', 'stopping', 'provisioning'].map(instanceStateLevel)).toEqual(['warn', 'warn', 'warn', 'warn']);
    expect(['failed', 'stopped', 'error', 'crashed'].map(instanceStateLevel)).toEqual(['ng', 'ng', 'ng', 'ng']);
    expect(instanceStateLevel('unknown-x')).toBe('info');
  });
  it('各行に「インスタンス」ボタンがあり、wrangler containers instances を呼ぶ', () => {
    expect(html).toContain("'/cf-containers/proxy/debug/wrangler/containers-instances?app=' + encodeURIComponent(");
  });
});

const require = createRequire(import.meta.url);
const { wranglerInstancesArgs } = require('../containers/demo/server.js');
describe('wrangler containers instances の引数', () => {
  it('アプリのIDか名前だけを受け付け、--json を付ける', () => {
    expect(wranglerInstancesArgs('a0b1c2d3-e4f5-6789-abcd-ef0123456789')).toEqual(['containers', 'instances', 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', '--json']);
    expect(wranglerInstancesArgs('dynamicneko-sandboxterminal')).toEqual(['containers', 'instances', 'dynamicneko-sandboxterminal', '--json']);
  });
  it('記号やオプションのような値は受け付けない', () => {
    for (const bad of ['', '--help', 'a;rm -rf /', 'a b', 'x'.repeat(200)]) expect(wranglerInstancesArgs(bad)).toBeNull();
  });
});
