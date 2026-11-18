import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { getAiChatPage } from './views/aichat';

// ユーザー指定(2026-11-07): AIチャットの応答とログ保存をDurable Object(AichatJob)で行い、ブラウザの接続が切れても途切れさせない。
const toml = readFileSync('wrangler.toml', 'utf8');
const index = readFileSync('src/index.ts', 'utf8');
const entry = readFileSync('src/worker-entry.ts', 'utf8');
const types = readFileSync('src/types.ts', 'utf8');
const durable = readFileSync('src/durable/aichatJob.ts', 'utf8');

describe('AIチャットのジョブ: つなぎ込み', () => {
  it('wrangler.tomlにAICHAT_JOBのバインディングと、SQLiteのクラスを足すマイグレーションがある(既存のv1は書き換えない)', () => {
    expect(toml).toMatch(/\[\[durable_objects\.bindings\]\]\nname = "AICHAT_JOB"\nclass_name = "AichatJob"/);
    expect(toml).toMatch(/\[\[migrations\]\]\ntag = "v1"\nnew_sqlite_classes = \["DemoContainer"\]/);
    expect(toml).toMatch(/\[\[migrations\]\]\ntag = "v2"\nnew_sqlite_classes = \["AichatJob"\]/);
  });

  it('BindingsにAICHAT_JOBがあり、エントリモジュールがクラスを再exportする', () => {
    expect(types).toContain('AICHAT_JOB?: DurableObjectNamespace;');
    expect(entry).toContain("export { AichatJob } from './durable/aichatJob';");
  });

  it('Durable Objectはalarmで同じWorkerのアプリへ要求を渡し、DurableObjectStateのwaitUntilを使う', () => {
    expect(durable).toContain("import app from '../index';");
    expect(durable).toContain('app.fetch(request, env');
    expect(durable).toContain('alarm()');
  });

  it('ジョブの登録と取得はAIチャットと同じ認証で、取得は送信者(user.sub)に限る', () => {
    expect(index).toContain("app.post('/api/aichat/jobs', aichatAuthMiddleware,");
    expect(index).toContain("app.get('/api/aichat/jobs/:jobId', aichatAuthMiddleware,");
    expect(index).toMatch(/owner: user\.sub/);
    expect(index).toContain("'/api/aichat'");
  });
});

describe('AIチャットのジョブ: ページ', () => {
  const page = getAiChatPage({ username: 'u', aiChatModel: 'm' });
  it('入力窓の送信はジョブを登録して途中経過を取りに行き、/api/aichatへ直接POSTしない', () => {
    expect(page).toContain('startAichatJob(');
    expect(page).toContain('pollAichatJob(');
    const submit = page.slice(page.indexOf("chatForm.addEventListener('submit'"), page.lastIndexOf('resumePendingAichatJobs();'));
    expect(submit).toContain('runAichatJob(payload, currentMsg,');
    expect(submit).not.toContain("fetch('/api/aichat'");
  });
  it('読み込み時に、残っているジョブを続きから表示する', () => {
    expect(page).toContain('resumePendingAichatJobs()');
  });
  it('生成したHTMLの全scriptがnode --checkに通る', () => {
    const scripts = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(() => execFileSync(process.execPath, ['--check'], { input: script })).not.toThrow();
    }
  });
});
