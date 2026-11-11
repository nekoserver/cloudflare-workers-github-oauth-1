import { expect, it, vi } from 'vitest';
import { getDemoContainer } from './demoContainerStub';

// 旧 getContainer(binding, 'demo') と同じ呼び方: binding.get(binding.idFromName('demo'))。
// 同じ名前を使うので、今の Durable Object とその保存データに届く(公式の移行ガイド)。
it('idFromName("demo") の Durable Object を返す', () => {
  const stub = { name: 'stub' };
  const ns = { idFromName: vi.fn(() => 'id-demo'), get: vi.fn(() => stub) };
  expect(getDemoContainer(ns as never)).toBe(stub);
  expect(ns.idFromName).toHaveBeenCalledWith('demo');
  expect(ns.get).toHaveBeenCalledWith('id-demo');
});
