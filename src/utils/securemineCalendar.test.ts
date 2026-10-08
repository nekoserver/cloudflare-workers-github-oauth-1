import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { getCalendarMonth, getSecuremineCalendarScript } from './securemineCalendar';
import { vi } from 'vitest';
function mount(result: {year:number;month:number;days:number[]}, fail = false) {
  const calls: {url:string;options:any}[] = [];
  const dom = new JSDOM('<section><h2 id="calendarMonth"></h2><button id="calendarRefresh">同期</button><table id="commitCalendar"><tbody></tbody></table><small id="calendarStatus"></small></section><script>'+getSecuremineCalendarScript()+'</script>', {runScripts:'dangerously',url:'https://example.com/taskmine',beforeParse(window) {
    (window as any).fetch=async(url:string, options:any)=>{calls.push({url,options});return {ok:!fail,status:fail?500:200,json:async()=>result};};
  }});
  return {dom,d:dom.window.document,calls};
}
describe('SecureMine commit calendar', () => {
  it('uses the accessed month in JST at month and year boundaries',()=>{
    expect(getCalendarMonth(new Date('2026-09-30T15:00:00Z'))).toEqual({year:2026,month:10,today:1});
    expect(getCalendarMonth(new Date('2026-12-31T15:00:00Z'))).toEqual({year:2027,month:1,today:1});
  });
  it('highlights only days with commits and requests data before a Redmine connection',async()=>{
    const {dom,d,calls}=mount({year:2026,month:10,days:[1,8,31]});
    await vi.waitFor(()=>expect(d.querySelectorAll('.has-commits')).toHaveLength(3));
    expect([...d.querySelectorAll('.has-commits')].map(x=>x.textContent)).toEqual(['1','8','31']);
    expect(d.querySelectorAll('.calendar-day')).toHaveLength(31);
    expect(d.querySelector('tbody tr')!.children[4].textContent).toBe('1');
    expect(calls[0]).toMatchObject({url:'/api/taskmine/commit-calendar',options:{credentials:'same-origin'}});
    dom.window.close();
  });
  it('renders leap day and an empty month without highlights',async()=>{
    const {dom,d}=mount({year:2024,month:2,days:[]});
    await vi.waitFor(()=>expect(d.querySelector('#calendarMonth')!.textContent).toBe('2024年2月'));
    expect(d.querySelectorAll('.calendar-day')).toHaveLength(29);
    expect(d.querySelectorAll('.has-commits')).toHaveLength(0);
    expect(d.querySelector('#calendarStatus')!.textContent).toContain('ありません');
    dom.window.close();
  });
  it('distinguishes retrieval failure from no commits',async()=>{
    const {dom,d}=mount({year:2026,month:10,days:[]},true);
    await vi.waitFor(()=>expect(d.querySelector('#calendarStatus')!.textContent).toContain('取得できません'));
    expect(d.querySelectorAll('.calendar-day').length).toBeGreaterThan(0);
    dom.window.close();
  });
});
