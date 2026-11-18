import { describe, expect, it } from 'vitest';
import { getCfContainersPage } from './views/cfContainers';

describe('/cf-containers 再起動中の表示', () => {
  const html = getCfContainersPage();

  it('再起動中のログは黄色文字で点滅するCSSがある', () => {
    expect(html).toContain('#log.restarting');
    const rule = html.slice(html.indexOf('#log.restarting'), html.indexOf('}', html.indexOf('#log.restarting')));
    expect(rule).toContain('color: var(--warn)');
    expect(rule).toContain('animation: status-blink');
  });

  it('再起動のときだけ点滅クラスを付け、終わったら外す', () => {
    expect(html).toContain("log.classList.add('restarting')");
    expect(html).toContain("log.classList.remove('restarting')");
    expect(html).toContain("'再起動中…'");
  });
});
