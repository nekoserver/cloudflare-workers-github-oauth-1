import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getSecuremineRedmineFeaturesScript } from './securemineRedmineFeatures';

function fixture() {
  const dom = new JSDOM(`<section><p id="redmineFeaturesStatus"></p><div id="redmineFeaturesLinks"></div></section><script>${getSecuremineRedmineFeaturesScript()}\nwindow.renderFeatures = renderRedmineFeatures;</script>`, {runScripts:'dangerously'});
  return { dom, d:dom.window.document, render:(account:unknown,project:unknown=null)=>(dom.window as any).renderFeatures(account,project) };
}
const account = {url:'https://r9.nekomaneki.work',key:'private-key-never-in-links',user:{admin:false}};

describe('SecureMine Redmine feature navigation', () => {
  it('opens native features on the connected server without passing API credentials', () => {
    const {dom,d,render}=fixture();render(account);
    expect(d.querySelector<HTMLAnchorElement>('[data-redmine-feature="my-page"]')?.href).toBe('https://r9.nekomaneki.work/my/page');
    expect(d.querySelector<HTMLAnchorElement>('[data-redmine-feature="gantt"]')?.href).toBe('https://r9.nekomaneki.work/issues/gantt');
    for(const link of d.querySelectorAll<HTMLAnchorElement>('a')) {
      expect(new URL(link.href).origin).toBe('https://r9.nekomaneki.work');
      expect(link.href).not.toContain(account.key);
      expect(link.rel).toContain('noopener');
    }
    expect(d.querySelector('[data-redmine-feature="administration"]')).toBeNull();
    dom.window.close();
  });
  it('keeps base paths and changes project/account context without retaining old links', () => {
    const {dom,d,render}=fixture();
    render({...account,url:'https://work.example/redmine/'},{id:7,identifier:'team',name:'Team'});
    expect(d.querySelector<HTMLAnchorElement>('[data-redmine-feature="wiki"]')?.pathname).toBe('/redmine/projects/team/wiki');
    render({...account,url:'https://other.example'},{id:8,identifier:'../admin',name:'Other'});
    expect(d.querySelector<HTMLAnchorElement>('[data-redmine-feature="wiki"]')?.href).toBe('https://other.example/projects/8/wiki');
    expect(d.querySelector('#redmineFeaturesLinks')!.textContent).not.toContain('Team');
    render(null);
    expect(d.querySelectorAll('a')).toHaveLength(0);
    expect(d.querySelector('#redmineFeaturesStatus')!.textContent).toContain('接続');
    dom.window.close();
  });
  it('rejects unsafe destinations and only displays administration for a confirmed admin', () => {
    const {dom,d,render}=fixture();
    render({...account,user:{admin:true}});
    expect(d.querySelector('[data-redmine-feature="administration"]')).not.toBeNull();
    for(const url of ['javascript:alert(1)','http://redmine.example','https://user:password@example.com','https://example.com/?key=secret','https://example.com/#secret']) {
      render({...account,url});expect(d.querySelectorAll('a')).toHaveLength(0);
    }
    dom.window.close();
  });
});
