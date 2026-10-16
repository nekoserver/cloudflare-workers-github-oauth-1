import { describe, it, expect } from 'vitest';
import { resolveContainerAction, formatContainerStatusLabel, isContainerRunning } from './cfContainerStatus';

// 対象: /cf-containersの入力検証(resolveContainerAction)・状態表示
// (formatContainerStatusLabel・isContainerRunning)。
//
// 故障シナリオ:
//   (1) typoした操作名(例: 'strat')がそのまま受け付けられてしまう
//   (2) state=nullを「停止済み」と誤って表示してしまう
//   (3) stopped_with_codeでexitCodeが無い場合に表示が崩れる
//   (4) healthy/runningのどちらもisContainerRunningがtrueを返す必要がある
//       のにrunningだけしか判定しない

describe('resolveContainerAction', () => {
  it('start/stop/restartはそのまま返す', () => {
    expect(resolveContainerAction('start')).toBe('start');
    expect(resolveContainerAction('stop')).toBe('stop');
    expect(resolveContainerAction('restart')).toBe('restart');
  });

  it('未対応の操作名はnullを返す', () => {
    expect(resolveContainerAction('strat')).toBeNull();
    expect(resolveContainerAction('')).toBeNull();
    expect(resolveContainerAction('delete')).toBeNull();
  });
});

describe('formatContainerStatusLabel', () => {
  it('state=nullは「未起動または状態不明」(停止済みと誤認させない)', () => {
    expect(formatContainerStatusLabel(null)).toBe('未起動または状態不明');
  });

  it('running/healthy/stopping/stoppedはそれぞれ日本語ラベルになる', () => {
    expect(formatContainerStatusLabel({ lastChange: 0, status: 'running' })).toBe('起動中');
    expect(formatContainerStatusLabel({ lastChange: 0, status: 'healthy' })).toBe('起動中(ポート応答確認済み)');
    expect(formatContainerStatusLabel({ lastChange: 0, status: 'stopping' })).toBe('停止処理中');
    expect(formatContainerStatusLabel({ lastChange: 0, status: 'stopped' })).toBe('停止済み');
  });

  it('stopped_with_codeはexitCodeを含めて表示し、無い場合は「不明」にする', () => {
    expect(formatContainerStatusLabel({ lastChange: 0, status: 'stopped_with_code', exitCode: 1 })).toBe('停止済み(終了コード: 1)');
    expect(formatContainerStatusLabel({ lastChange: 0, status: 'stopped_with_code' })).toBe('停止済み(終了コード: 不明)');
  });
});

describe('isContainerRunning', () => {
  it('running・healthyはtrue', () => {
    expect(isContainerRunning({ lastChange: 0, status: 'running' })).toBe(true);
    expect(isContainerRunning({ lastChange: 0, status: 'healthy' })).toBe(true);
  });

  it('stopping・stopped・stopped_with_code・nullはfalse', () => {
    expect(isContainerRunning({ lastChange: 0, status: 'stopping' })).toBe(false);
    expect(isContainerRunning({ lastChange: 0, status: 'stopped' })).toBe(false);
    expect(isContainerRunning({ lastChange: 0, status: 'stopped_with_code' })).toBe(false);
    expect(isContainerRunning(null)).toBe(false);
  });
});
