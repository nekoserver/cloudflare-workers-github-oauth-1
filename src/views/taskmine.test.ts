import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { getTaskminePage } from './taskmine';

function page() { return new JSDOM(getTaskminePage(), { runScripts: 'dangerously', url: 'https://example.com/taskmine' }); }
describe('Taskmine', () => {
  it('renders executable scripts and demo issues; filters and shows detail safely', () => {
    const dom = page();
    const d = dom.window.document;
    expect(d.querySelectorAll('.issue').length).toBeGreaterThan(0);
    const search = d.querySelector<HTMLInputElement>('#search')!;
    search.value = 'ログイン'; search.dispatchEvent(new dom.window.Event('input'));
    expect(d.querySelectorAll('.issue')).toHaveLength(1);
    (d.querySelector('.issue') as HTMLElement).click();
    expect(d.querySelector('#detail')!.textContent).toContain('変更履歴');
    expect(d.querySelector('#detail')!.textContent).toContain('ログイン');
    dom.window.close();
  });
  it('creates demo issues, records updates, and treats markup as text', () => {
    const dom = page(); const d = dom.window.document;
    (d.querySelector('#newIssue') as HTMLElement).click();
    (d.querySelector('#subject') as HTMLInputElement).value = '<img src=x onerror=alert(1)>';
    d.querySelector('#editor')!.dispatchEvent(new dom.window.Event('submit', {cancelable:true}));
    expect(d.querySelector('#detail')!.textContent).toContain('<img');
    expect(d.querySelector('#detail img')).toBeNull();
    expect(d.querySelectorAll('.issue')).toHaveLength(5);
    (d.querySelector('#editIssue') as HTMLElement).click();
    (d.querySelector('#notes') as HTMLTextAreaElement).value = '確認しました';
    d.querySelector('#editor')!.dispatchEvent(new dom.window.Event('submit', {cancelable:true}));
    expect(d.querySelector('#detail')!.textContent).toContain('確認しました');
    dom.window.close();
  });
  it('previews Markdown safely and persists the selected theme', () => {
    const dom = page(); const d = dom.window.document;
    (d.querySelector('#newIssue') as HTMLElement).click();
    const input = d.querySelector<HTMLTextAreaElement>('#description')!;
    input.value = '**完了** <img src=x onerror=alert(1)> [危険](javascript:alert(1))';
    input.dispatchEvent(new dom.window.Event('input'));
    expect(d.querySelector('#preview strong')?.textContent).toBe('完了');
    expect(d.querySelector('#preview img')).toBeNull();
    expect(d.querySelector('#preview a')).toBeNull();
    (d.querySelector('#theme') as HTMLElement).click();
    expect(d.documentElement.dataset.theme).toBe('light');
    expect(d.cookie).toContain('user_theme=light');
    dom.window.close();
  });
  it('reports an invalid server address without leaving demo mode', () => {
    const dom = page(); const d = dom.window.document;
    (d.querySelector('#serverUrl') as HTMLInputElement).value = 'http://insecure.example';
    (d.querySelector('#apiKey') as HTMLInputElement).value = 'secret';
    d.querySelector('#connection')!.dispatchEvent(new dom.window.Event('submit', {cancelable:true}));
    expect(d.querySelector('#message')!.textContent).toContain('HTTPS');
    expect(d.querySelectorAll('.issue')).toHaveLength(4);
    expect(dom.window.localStorage.length).toBe(0);
    dom.window.close();
  });
});

function remotePage(fail = false) {
  const calls: {url: URL; options: any}[] = [];
  let time = Date.now();
  const dom = new JSDOM(getTaskminePage(), {runScripts:'dangerously', url:'https://example.com/taskmine', beforeParse(window) {
    window.Date.now = () => time += 2000;
    const w = window as any;
    w.AbortSignal.timeout = () => undefined;
    w.fetch = async (input: string, options: any) => {
      const transport = new URL(input, "https://example.com");
      const url = new URL(transport.searchParams.get("path")!, transport.searchParams.get("base")! + "/"); calls.push({url, options});
      expect(transport.pathname).toBe("/api/taskmine/redmine");
      expect(options.credentials).toBe("same-origin");
      if(fail) throw new Error('CORS failure');
      let data: any;
      if(url.pathname.endsWith('/projects.json')) data = {projects:[{id:7,name:'Remote'}],total_count:1};
      else if(url.pathname.endsWith('/issue_statuses.json')) data = {issue_statuses:[{id:1,name:'Open'}]};
      else if(url.pathname.endsWith('/issue_priorities.json')) data = {issue_priorities:[{id:2,name:'Normal'}]};
      else if(url.pathname.endsWith('/trackers.json')) data = {trackers:[{id:1,name:'Task'}]};
      else if(url.pathname.endsWith('/memberships.json')) data = {memberships:[{user:{id:4,name:'Member'}}],total_count:1};
      else if(url.pathname.endsWith('/uploads.json')) data = {upload:{token:'upload-token'}};
      else if(options.method==='POST') data = {issue:{id:9}};
      else if(url.pathname.endsWith('/9.json')) data = {issue:{id:9,subject:'Remote issue',project:{id:7,name:'Remote'},status:{id:1,name:'Open'},priority:{id:2,name:'Normal'},tracker:{id:1,name:'Task'},journals:[]}};
      else data = {issues:[],total_count:0};
      return {status:200,ok:true,json:async()=>data};
    };
  }});
  const d=dom.window.document;
  (d.querySelector('#serverUrl') as HTMLInputElement).value='https://redmine.example/redmine/';
  (d.querySelector('#apiKey') as HTMLInputElement).value='private-api-key';
  d.querySelector('#connection')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
  return {dom,d,calls};
}
describe('Taskmine Redmine REST integration', () => {
  it('connects a subdirectory server, filters assigned issues, creates and reloads a real issue', async () => {
    const {dom,d,calls}=remotePage();
    await vi.waitFor(()=>expect(d.querySelector('#mode')!.textContent).toContain('https://redmine.example/redmine'));
    (d.querySelector('#mine') as HTMLElement).click();
    await vi.waitFor(()=>expect(calls.some(c=>c.url.searchParams.get('assigned_to_id')==='me')).toBe(true));
    (d.querySelector('#newIssue') as HTMLElement).click();
    await vi.waitFor(()=>expect(d.querySelector('#assignee')!.textContent).toContain('Member'));
    (d.querySelector('#subject') as HTMLInputElement).value='Remote issue';
    const file = new dom.window.File(['evidence'], 'capture.txt', {type:'text/plain'});
    Object.defineProperty(d.querySelector('#files'), 'files', {value:[file]});
    d.querySelector('#editor')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
    await vi.waitFor(()=>expect(d.querySelector('#detail')!.textContent).toContain('変更履歴'));
    const upload = calls.find(c=>c.url.pathname.endsWith('/uploads.json'))!;
    expect(upload.options.body).toBe(file);
    expect(upload.options.headers['Content-Type']).toBe('application/octet-stream');
    const post = calls.find(c=>c.options.method==='POST' && c.url.pathname.endsWith('/issues.json'))!;
    expect(post.url.pathname).toBe('/redmine/issues.json');
    expect(JSON.parse(post.options.body).issue).toMatchObject({subject:'Remote issue',project_id:7, uploads:[{token:'upload-token',filename:'capture.txt',content_type:'text/plain'}]});
    (d.querySelector('#editIssue') as HTMLElement).click();
    await vi.waitFor(()=>expect(d.querySelector('#assignee')!.textContent).toContain('Member'));
    (d.querySelector('#notes') as HTMLTextAreaElement).value='updated';
    (d.querySelector('#ratio') as HTMLInputElement).value='80';
    d.querySelector('#editor')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
    await vi.waitFor(()=>expect(calls.some(c=>c.options.method==='PUT')).toBe(true));
    const update=calls.find(c=>c.options.method==='PUT')!;
    expect(update.url.pathname).toBe('/redmine/issues/9.json');
    expect(JSON.parse(update.options.body).issue).toMatchObject({notes:'updated',done_ratio:80});
    await vi.waitFor(()=>expect(d.querySelector('#detail')!.textContent).toContain('変更履歴'));
    expect(calls.every(c=>c.options.headers['X-Redmine-API-Key']==='private-api-key')).toBe(true);
    expect(d.querySelector<HTMLInputElement>('#apiKey')!.value).toBe('');
    expect(dom.window.localStorage.length).toBe(0);
    expect(d.cookie).not.toContain('private-api-key');
    dom.window.close();
  });
  it('shows connection failures and keeps the demo usable', async () => {
    const {dom,d}=remotePage(true);
    await vi.waitFor(()=>expect(d.querySelector('#message')!.textContent).toContain('Worker'));
    expect(d.querySelectorAll('.issue')).toHaveLength(4);
    expect(d.querySelector('#account')!.children).toHaveLength(1);
    expect(d.querySelector<HTMLButtonElement>('#connection button')!.disabled).toBe(false);
    dom.window.close();
  });
});
