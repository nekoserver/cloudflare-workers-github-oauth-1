import { describe, it, expect } from 'vitest';
import { computeHourlyRate, estimateCostUsd, computeCumulativeConnectedSeconds, CONFIGURED_INSTANCE_SPEC } from './cfContainerCost';

describe('computeHourlyRate', () => {
  it('standard-1(0.5vCPU/4GiB/8GB)の単価を正しく計算する', () => {
    const rate = computeHourlyRate(CONFIGURED_INSTANCE_SPEC);
    expect(rate.vcpuUsdPerHour).toBeCloseTo(0.036, 6);
    expect(rate.memoryUsdPerHour).toBeCloseTo(0.036, 6);
    expect(rate.diskUsdPerHour).toBeCloseTo(0.002016, 6);
    expect(rate.totalUsdPerHour).toBeCloseTo(0.074016, 6);
  });
});

describe('estimateCostUsd', () => {
  it('1時間分の累計接続秒数(3600秒)なら単価のtotalUsdPerHourと一致する', () => {
    const cost = estimateCostUsd(3600, CONFIGURED_INSTANCE_SPEC);
    expect(cost).toBeCloseTo(0.074016, 6);
  });

  it('0秒ならコスト0', () => {
    expect(estimateCostUsd(0, CONFIGURED_INSTANCE_SPEC)).toBe(0);
  });

  it('負の秒数(時計ズレ等の異常値)でも負のコストにしない', () => {
    expect(estimateCostUsd(-100, CONFIGURED_INSTANCE_SPEC)).toBe(0);
  });
});

describe('computeCumulativeConnectedSeconds', () => {
  const base = '2026-10-16T10:00:00.000Z';
  const plus = (sec: number) => new Date(Date.parse(base) + sec * 1000).toISOString();

  it('start→stopの1区間を正しく積算する', () => {
    const events = [
      { action: 'start', result: 'success', createdAt: plus(0) },
      { action: 'stop', result: 'success', createdAt: plus(600) },
    ];
    expect(computeCumulativeConnectedSeconds(events, new Date(plus(9999)))).toBe(600);
  });

  it('複数区間(start→stop→start→stop)を合算する', () => {
    const events = [
      { action: 'start', result: 'success', createdAt: plus(0) },
      { action: 'stop', result: 'success', createdAt: plus(100) },
      { action: 'start', result: 'success', createdAt: plus(200) },
      { action: 'stop', result: 'success', createdAt: plus(250) },
    ];
    expect(computeCumulativeConnectedSeconds(events, new Date(plus(9999)))).toBe(150);
  });

  it('現在も起動中(最後がstart/restartで未stop)なら、nowまでの経過も加算する', () => {
    const events = [{ action: 'start', result: 'success', createdAt: plus(0) }];
    expect(computeCumulativeConnectedSeconds(events, new Date(plus(300)))).toBe(300);
  });

  it('restartは区間を継続扱い(閉じない)にする', () => {
    const events = [
      { action: 'start', result: 'success', createdAt: plus(0) },
      { action: 'restart', result: 'success', createdAt: plus(100) },
      { action: 'stop', result: 'success', createdAt: plus(200) },
    ];
    expect(computeCumulativeConnectedSeconds(events, new Date(plus(9999)))).toBe(200);
  });

  it('result=failureの行は無視する(失敗した操作を接続時間に数えない)', () => {
    const events = [
      { action: 'start', result: 'success', createdAt: plus(0) },
      { action: 'stop', result: 'failure', createdAt: plus(50) },
      { action: 'stop', result: 'success', createdAt: plus(100) },
    ];
    expect(computeCumulativeConnectedSeconds(events, new Date(plus(9999)))).toBe(100);
  });

  it('入力順がcreated_at昇順でなくても正しく積算する(内部でソートする)', () => {
    const events = [
      { action: 'stop', result: 'success', createdAt: plus(100) },
      { action: 'start', result: 'success', createdAt: plus(0) },
    ];
    expect(computeCumulativeConnectedSeconds(events, new Date(plus(9999)))).toBe(100);
  });

  it('イベントが1件もなければ0を返す', () => {
    expect(computeCumulativeConnectedSeconds([], new Date(plus(9999)))).toBe(0);
  });
});
