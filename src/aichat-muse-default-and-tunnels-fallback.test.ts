// @vitest-environment jsdom
// ユーザー指定(2026-11-12):
// 1. AIチャットの初期の言語モデルは Muse(AI_CHAT_MODEL は Slack 応答と共通なので変えない)。
// 2. Muse の ⚙ に「直送に失敗したら tunnels.rb をフォールバック経路として使う」チェックボックス(既定 OFF)。
//    ON のときだけ、muse-vm に届かなかった失敗で tunnels.rb(/neko askgk muse_prompt=)へ送る。
//    届いた可能性がある失敗(タイムアウト・認証・利用上限)では送らない(推論の二重実行を避ける)。
import { describe, expect, it, vi } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { AICHAT_MUSE_HEALTH_SCRIPT } from './views/aichatMuseHealth';
import { interpretMusePrompt, interpretMuseTunnelsFallback } from './utils/aichatSlashCommand';
import { resolveMuseTunnelsFallback } from './utils/museWorkerAsk';

describe('初期の言語モデル', () => {
  it('AI_CHAT_MODEL が llama でも、AIチャットの初期選択は Muse', () => {
    const html = getAiChatPage({ username: 'u', aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', modelColors: {} });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const select = doc.getElementById('modelSelect') as HTMLSelectElement;
    expect(select.querySelector('option[selected]')?.getAttribute('value')).toBe('muse');
    expect(select.querySelectorAll('option[selected]')).toHaveLength(1);
  });
});

const script = new Function(AICHAT_MUSE_HEALTH_SCRIPT + '\nreturn {readMuseSignalSettings,openMuseSignalModal};')();
const cookie = (v: unknown) => 'aichat_muse_signal=' + encodeURIComponent(JSON.stringify(v));

describe('⚙ の tunnels.rb フォールバック(既定 OFF)', () => {
  it('未設定・古い設定は OFF。明示的に true のときだけ ON(ブラウザ・サーバーとも)', () => {
    for (const c of ['', cookie({ enabled: true, intervalSeconds: 600 }), cookie({ tunnelsFallback: 'yes' })]) {
      expect(script.readMuseSignalSettings(c).tunnelsFallback).toBe(false);
      expect(resolveMuseTunnelsFallback(c)).toBe(false);
    }
    expect(script.readMuseSignalSettings(cookie({ tunnelsFallback: true })).tunnelsFallback).toBe(true);
    expect(resolveMuseTunnelsFallback(cookie({ tunnelsFallback: true }))).toBe(true);
  });
  it('チェックボックスは既定で外れていて、保存で設定に入る', () => {
    document.body.innerHTML = '';
    const save = vi.fn();
    script.openMuseSignalModal({ getSettings: () => ({ enabled: true, intervalSeconds: 600 }), saveSettings: save, resetSettings: vi.fn(), getNextZ: () => 1 });
    const box = document.querySelector<HTMLInputElement>('[data-muse-tunnels-fallback]')!;
    expect(box).not.toBeNull(); expect(box.checked).toBe(false);
    expect(box.parentElement!.textContent).toContain('tunnels.rb');
    box.click();
    [...document.querySelectorAll('button')].find(b => b.textContent === '保存')!.click();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ tunnelsFallback: true }));
  });
});

describe('直送に失敗したときの tunnels.rb フォールバック', () => {
  const tunnels = () => vi.fn().mockResolvedValue({ reply: 'tunnels の回答', llmModel: 'muse-1' });
  it('OFF なら tunnels.rb へ送らない', async () => {
    const askTunnelSigner = tunnels();
    const r = await interpretMusePrompt('質問', { askMuseDirect: vi.fn().mockResolvedValue({ ok: false, error: 'muse_connection_failed' }), askTunnelSigner });
    expect(askTunnelSigner).not.toHaveBeenCalled();
    expect(r.handled && r.response).toContain('❌');
  });
  it.each(['muse_connection_failed', 'container_not_running', 'tailscale_wasm_not_configured'])('ON で %s なら tunnels.rb へ muse_prompt で1回送る', async (error) => {
    const askTunnelSigner = tunnels();
    const r = await interpretMusePrompt('質問', { askMuseDirect: vi.fn().mockResolvedValue({ ok: false, error }), askTunnelSigner }, 'Muse', { tunnelsFallback: true });
    expect(askTunnelSigner).toHaveBeenCalledExactlyOnceWith('muse_prompt="質問"');
    expect(r).toMatchObject({ handled: true, saveAsAiResponse: true, museAskgk: true });
    expect(r.handled && r.response).toContain('tunnels の回答');
    expect(r.handled && r.response).toContain('tunnels.rb');
  });
  it.each(['llm_timeout', 'muse_authentication_failed', 'muse_usage_limit', 'muse_execution_failed'])('ON でも %s(届いた可能性がある)なら送らない', async (error) => {
    const askTunnelSigner = tunnels();
    await interpretMusePrompt('質問', { askMuseDirect: vi.fn().mockResolvedValue({ ok: false, error }), askTunnelSigner }, 'Muse', { tunnelsFallback: true });
    expect(askTunnelSigner).not.toHaveBeenCalled();
  });
  it('送る前の確認(コンテナ経由の tailnet)で止まったときも、ON なら tunnels.rb へ送る', async () => {
    const askTunnelSigner = tunnels();
    const r = await interpretMuseTunnelsFallback('質問', { askTunnelSigner }, 'tailnet上にmuse-vmを確認できません');
    expect(askTunnelSigner).toHaveBeenCalledExactlyOnceWith('muse_prompt="質問"');
    expect(r.handled && r.response).toContain('tunnels の回答');
  });
  it('tunnels.rb も失敗したら、両方の失敗が分かるように返す', async () => {
    const r = await interpretMusePrompt('質問', { askMuseDirect: vi.fn().mockResolvedValue({ ok: false, error: 'muse_connection_failed' }), askTunnelSigner: vi.fn().mockRejectedValue(new Error('signer down')) }, 'Muse', { tunnelsFallback: true });
    expect(r.handled && r.response).toContain('❌');
    expect(r.handled && r.response).toContain('signer down');
    expect(r.handled && r.response).toContain('tunnels.rb');
  });
});
