import { describe, it, expect } from 'vitest';
import { analyzeBuildLog, parseAnalysisOutput } from './moonbitBuildLog';
import { parseBuildTimings } from './containerBuildTimings';

type LegacyStep = { id: number; label: string; state: 'running' | 'done' | 'cached' | 'error' | 'canceled'; seconds: number | null };
// MoonBitへ移す前のTypeScript実装(比較の基準)。挙動が変わっていないことをこれと突き合わせて確かめる
function legacyParseBuildTimings(log: string): LegacyStep[] {
  const steps = new Map<number, LegacyStep>();
  for (const raw of log.split(/\r?\n|\r/)) {
    const line = raw.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trim();
    const match = line.match(/^(?:\d{4}-\d\d-\d\d[T ][\d:.]+Z?\s+)?#(\d+)\s+(.+)$/);
    if (!match) continue;
    const id = Number(match[1]); const text = match[2];
    if (!Number.isSafeInteger(id)) continue;
    const terminal = text.match(/^(DONE)(?:\s+([\d.]+)s)?$|^(CACHED)$|^(ERROR:)|^(CANCELED)$/);
    let step = steps.get(id);
    if (terminal) {
      if (!step) { step = { id, label: '（処理名未取得）', state:'running',seconds:null }; steps.set(id, step); }
      step.state = text.startsWith('DONE') ? 'done' : text === 'CACHED' ? 'cached' : text === 'CANCELED' ? 'canceled' : 'error';
      const seconds = terminal[2] === undefined ? null : Number(terminal[2]);
      step.seconds = seconds !== null && Number.isFinite(seconds) ? seconds : null;
      continue;
    }
    // Vertex output and transfer progress do not define a new instruction.
    if (/^\d/.test(text) || /^(?:transferring|exporting layers|exporting manifest|exporting config|naming to|unpacking to|pushing layers|pushing manifest|writing image)\b/.test(text)) continue;
    if (!/^\[|^(?:exporting to image|exporting cache|importing cache manifest|building with|resolve image config|preparing build context)\b/.test(text)) continue;
    if (step && step.label !== '（処理名未取得）' && step.label !== text.slice(0,1500)) {
      // Multiple Docker invocations may reuse #N; do not merge unrelated timings.
      throw new Error('ステップ番号が再使用されています。複数ビルドのログを分離してください');
    }
    if (step) step.label = text.slice(0, 1500);
    else steps.set(id, {id,label:text.slice(0,1500),state:'running',seconds:null});
  }
  if (steps.size > 500) throw new Error('ステップ数が500件を超えています');
  return [...steps.values()].sort((a,b)=>a.id-b.id);
}
const legacy = (log: string) => {
  try { return { ok: true, steps: legacyParseBuildTimings(log) }; }
  catch (error) { return { ok: false, detail: (error as Error).message }; }
};
const current = (log: string) => {
  const r = analyzeBuildLog(log);
  return r.ok ? { ok: true, steps: r.steps } : { ok: false, detail: r.detail };
};

describe('MoonBitのビルドログ解析', () => {
  it('タイムスタンプ付き・CRLF・ANSI・全角空白を含む実ログ形式で旧実装と一致する', () => {
    const log = [
      '2026-10-22T00:00:01.123Z #1 [internal] load build definition from Dockerfile',
      '2026-10-22T00:00:01.200Z #1 transferring dockerfile: 2.1kB done',
      '2026-10-22T00:00:01.300Z #1 DONE 0.1s',
      '\u001b[1m#2 [base 1/4] FROM docker.io/library/ubuntu:26.04\u001b[0m\r',
      '#2 resolve docker.io/library/ubuntu:26.04 0.2s done',
      '#2 CACHED',
      '#3 [base 2/4] RUN apt-get update && apt-get install -y curl',
      '#3 12.34 Reading package lists...',
      '#3 DONE 45.6s\r\n#4 exporting to image',
      '#4 exporting layers 3.0s done',
      '#4 naming to registry.cloudflare.com/x done',
      '#4 DONE 9.9s',
      '#5 [base 3/4] RUN false',
      '#5 ERROR: process "/bin/sh -c false" did not complete successfully',
      '#6 [base 4/4] RUN sleep 100',
      '#6 CANCELED',
      '　#7 building with "default" instance　',
      '#8 DONE .5s', '#9 DONE 1..2s', '#10 DONE 3.s', '#11 DONEX', '#012 [x] RUN y',
      '#99999999999999999999 [huge] RUN z', '#9007199254740991 [max] RUN z',
      'not a step line', '#', '#13', '#14 ', '#15\t[tab] RUN t',
    ].join('\n');
    expect(current(log)).toEqual(legacy(log));
    const r = analyzeBuildLog(log);
    expect(r.ok && r.steps.find((s) => s.id === 3)).toEqual({ id: 3, label: '[base 2/4] RUN apt-get update && apt-get install -y curl', state: 'done', seconds: 45.6 });
  });

  it('処理名は1500文字で切り、JSONに入れにくい文字も壊さずに返す', () => {
    const long = '[a] RUN ' + 'x'.repeat(2000);
    const tricky = '[b] RUN echo "q" \\ \u0001 \u{1F600} 日本語';
    const log = '#1 ' + long + '\n#2 ' + tricky + '\n#2 DONE 1s';
    expect(current(log)).toEqual(legacy(log));
    const r = analyzeBuildLog(log);
    expect(r.ok && r.steps[0].label.length).toBe(1500);
  });

  it('ランダムな行の組み合わせでも旧実装と一致する', () => {
    const parts = ['#1 [a] RUN a', '#1 DONE 1.5s', '#2 [b] RUN b', '#2 CACHED', '#3 exporting cache', '#3 ERROR: x',
      '#1 0.1 out', '#4 importing cache manifest', '#4 CANCELED', '#2 DONE', '#5 preparing build context', '\u001b[31m#5 DONE 2s\u001b[0m',
      '2026-01-02 03:04:05 #6 [c] RUN c', '#6 DONE 10s', 'garbage', '#7 writing image sha256:abc done', '#8 resolve image config for x'];
    let seed = 12345;
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let n = 0; n < 300; n++) {
      const lines = Array.from({ length: 1 + Math.floor(rand() * 12) }, () => parts[Math.floor(rand() * parts.length)]);
      const log = lines.join(rand() < 0.5 ? '\n' : '\r\n');
      expect(current(log), log).toEqual(legacy(log));
    }
  });

  it('同じステップ番号の再使用と件数超過は判別可能なエラーコードで返す', () => {
    expect(analyzeBuildLog('#1 [a] RUN a\n#1 DONE 1s\n#1 [b] RUN b')).toEqual({ ok: false, errorCode: 'step_id_reused', detail: 'ステップ番号が再使用されています。複数ビルドのログを分離してください' });
    const many = Array.from({ length: 501 }, (_, i) => '#' + (i + 1) + ' [s] RUN ' + i).join('\n');
    expect(analyzeBuildLog(many)).toMatchObject({ ok: false, errorCode: 'too_many_steps' });
    expect(() => parseBuildTimings(many)).toThrow('ステップ数が500件を超えています');
  });

  it('MoonBitの出力が想定と異なる形なら推測で補わずinvalid_outputにする', () => {
    expect(parseAnalysisOutput('not json')).toMatchObject({ ok: false, errorCode: 'invalid_output' });
    expect(parseAnalysisOutput('{"ok":true,"steps":[{"id":1,"label":"a","state":"weird","seconds":null}]}')).toMatchObject({ ok: false, errorCode: 'invalid_output' });
    expect(parseAnalysisOutput('{"ok":false,"errorCode":"unknown","detail":"x"}')).toMatchObject({ ok: false, errorCode: 'invalid_output' });
    expect(parseAnalysisOutput('{"ok":true,"steps":[]}')).toEqual({ ok: true, steps: [] });
  });

  it('空のログは空のステップ一覧を返す', () => {
    expect(analyzeBuildLog('')).toEqual({ ok: true, steps: [] });
  });
});
