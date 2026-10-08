import {describe,it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {getSecuremineSectionTabsScript} from './securemineSectionTabs';
function mount() {
  return new JSDOM(`<div class="layout"><section id="issueWorkspace"></section><section id="detail"></section><section id="projectSection"></section><section id="commitSection"></section></div><button class="section-toggle" id="issuesToggle" aria-controls="issueWorkspace detail" aria-expanded="true">課題</button><button class="section-toggle" id="projectsToggle" aria-controls="projectSection" aria-expanded="true">プロジェクト</button><button class="section-toggle" id="commitsToggle" aria-controls="commitSection" aria-expanded="true">コミット</button><script>${getSecuremineSectionTabsScript()}</script>`,{runScripts:'dangerously'});
}
describe('SecureMine right-edge section controls',()=>{
  it('opens and closes each section independently without removing their contents',()=>{
    const dom=mount(),d=dom.window.document;
    (d.querySelector('#issuesToggle') as HTMLElement).click();
    expect((d.querySelector('#issueWorkspace') as HTMLElement).hidden).toBe(true);
    expect((d.querySelector('#detail') as HTMLElement).hidden).toBe(true);
    expect((d.querySelector('#projectSection') as HTMLElement).hidden).toBe(false);
    (d.querySelector('#projectsToggle') as HTMLElement).click();
    (d.querySelector('#commitsToggle') as HTMLElement).click();
    expect((d.querySelector('#projectSection') as HTMLElement).hidden).toBe(true);
    expect((d.querySelector('#commitSection') as HTMLElement).hidden).toBe(true);
    (d.querySelector('#issuesToggle') as HTMLElement).click();
    expect((d.querySelector('#issueWorkspace') as HTMLElement).hidden).toBe(false);
    expect(d.querySelector('#issuesToggle')!.getAttribute('aria-expanded')).toBe('true');
    dom.window.close();
  });
  it('packs colliding keyboard moves without overlap and keeps controls inside a resized viewport',()=>{
    const dom=mount(),d=dom.window.document;
    const tabs=Array.from(d.querySelectorAll<HTMLElement>('.section-toggle'));
    for(let i=0;i<8;i++)tabs[0].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
    function check(){
      const boxes=tabs.map(t=>({top:parseFloat(t.style.top),height:parseFloat(t.style.height)})).sort((a,b)=>a.top-b.top);
      expect(boxes[0].top).toBeGreaterThanOrEqual(0);
      expect(boxes[2].top+boxes[2].height).toBeLessThanOrEqual(dom.window.innerHeight);
      for(let i=1;i<boxes.length;i++)expect(boxes[i].top-boxes[i-1].top).toBeGreaterThanOrEqual(boxes[i-1].height+8);
    }
    check();Object.defineProperty(dom.window,'innerHeight',{value:220,configurable:true});dom.window.dispatchEvent(new dom.window.Event('resize'));check();
    tabs[2].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Home'}));check();
    expect(tabs.every(t=>t.getAttribute('aria-expanded')==='true')).toBe(true);
    dom.window.close();
  });
});
