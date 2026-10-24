import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { getSecureminePage } from './securemine';

function page(demo = true) {
  const dom = new JSDOM(getSecureminePage(), { runScripts: 'dangerously', url: 'https://example.com/securemine' });
  if (demo) { const select = dom.window.document.querySelector('#account')! as unknown as HTMLSelectElement; select.value = 'demo'; select.dispatchEvent(new dom.window.Event('change')); }
  return dom;
}
describe('SecureMine', () => {
  it('uses r9 as the initial connection URL without requiring the user to type it', () => {
    const dom = page(false);
    expect(dom.window.document.querySelector<HTMLInputElement>('#serverUrl')!.value).toBe('https://r9.nekomaneki.work');
    dom.window.close();
  });

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

function remotePage(fail = false, empty = false, restored = false) {
  const control = { fail, empty, failLogin: false, failIssues: false, updated: false, issues: [] as any[], tick: () => {} };
  const calls: {url: URL; options: any}[] = [];
  let time = Date.now();
  const dom = new JSDOM(getSecureminePage(), {runScripts:'dangerously', url:'https://example.com/securemine', beforeParse(window) {
    window.Date.now = () => time += 2000;
    const w = window as any;
    w.AbortSignal.timeout = () => undefined;
    w.setInterval = (handler: () => void) => { control.tick = handler; return 1; };
    w.fetch = async (input: string, options: any) => {
      if (input === '/api/securemine/session') return {ok:true,status:200,json:async()=>({account:restored ? {id:'saved',name:'Work',url:'https://redmine.example/redmine'} : null})};
      if (input === '/api/securemine/login') return {ok:!control.failLogin,status:control.failLogin ? 503 : 200,json:async()=>control.failLogin ? {error:'DB保存失敗'} : {loggedInAt:'2026-10-08T00:00:00Z'}};
      if (input === '/api/securemine/commit-calendar') return {ok:true,status:200,json:async()=>({year:2026,month:10,days:[]})};
      const transport = new URL(input, "https://example.com");
      const url = new URL(transport.searchParams.get("path")!, transport.searchParams.get("base")! + "/"); calls.push({url, options});
      expect(transport.pathname).toBe("/api/securemine/redmine");
      expect(options.credentials).toBe("same-origin");
      if(control.fail || control.failIssues && url.pathname.endsWith('/issues.json')) throw new Error('network failure');
      let data: any;
      if(url.pathname.endsWith('/current.json')) data = {user:{id:4,login:'alice',firstname:'Alice',lastname:'Test'}};
      else if(url.pathname.endsWith('/projects.json')) data = {projects:control.empty ? [] : [{id:7,name:control.updated ? 'Updated project' : 'Remote',identifier:'remote',description:'Real project <img src=x onerror=alert(1)>',updated_on:'2026-10-08T00:00:00Z'}],total_count:control.empty ? 0 : 1};
      else if(url.pathname.endsWith('/issue_statuses.json')) data = {issue_statuses:[{id:1,name:'Open'}]};
      else if(url.pathname.endsWith('/issue_priorities.json')) data = {issue_priorities:[{id:2,name:'Normal'}]};
      else if(url.pathname.endsWith('/trackers.json')) data = {trackers:[{id:1,name:'Task'}]};
      else if(url.pathname.endsWith('/memberships.json')) data = {memberships:[{user:{id:4,name:'Member'}}],total_count:1};
      else if(url.pathname.endsWith('/uploads.json')) data = {upload:{token:'upload-token'}};
      else if(options.method==='POST') data = {issue:{id:9}};
      else if(url.pathname.endsWith('/9.json')) data = {issue:{id:9,subject:control.updated ? 'Updated remote issue' : 'Remote issue',project:{id:7,name:'Remote'},status:{id:1,name:'Open'},priority:{id:2,name:'Normal'},tracker:{id:1,name:'Task'},journals:[]}};
      else data = {issues:control.issues,total_count:control.issues.length};
      return {status:200,ok:true,json:async()=>data};
    };
  }});
  const d=dom.window.document;
  (d.querySelector('#serverUrl') as HTMLInputElement).value='https://redmine.example/redmine/';
  (d.querySelector('#apiKey') as HTMLInputElement).value='private-api-key';
  if (!restored) d.querySelector('#connection')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
  return {dom,d,calls,control};
}
describe('SecureMine Redmine REST integration', () => {
  it('exposes native features for the connected project and clears them on demo switch', async () => {
    const {dom,d}=remotePage();
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期済み'));
    expect(d.querySelector<HTMLAnchorElement>('[data-redmine-feature="account"]')?.href).toBe('https://redmine.example/redmine/my/account');
    (d.querySelector('#projects button') as HTMLElement).click();
    await vi.waitFor(()=>expect(d.querySelector<HTMLAnchorElement>('[data-redmine-feature="wiki"]')?.href).toBe('https://redmine.example/redmine/projects/remote/wiki'));
    expect(d.querySelector('#redmineFeaturesLinks')!.innerHTML).not.toContain('private-api-key');
    const select=d.querySelector<HTMLSelectElement>('#account')!;select.value='demo';select.dispatchEvent(new dom.window.Event('change'));
    expect(d.querySelectorAll('#redmineFeaturesLinks a')).toHaveLength(0);
    dom.window.close();
  });

  it('connects a subdirectory server, filters assigned issues, creates and reloads a real issue', async () => {
    const {dom,d,calls}=remotePage();
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期済み'));
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
  it('shows connection failures without displaying demo issues as real data', async () => {
    const {dom,d}=remotePage(true);
    await vi.waitFor(()=>expect(d.querySelector('#message')!.textContent).toContain('Worker'));
    expect(d.querySelectorAll('.issue')).toHaveLength(0);
    expect(d.querySelector('#account')!.children).toHaveLength(2);
    expect(d.querySelector<HTMLButtonElement>('#connection button')!.disabled).toBe(false);
    dom.window.close();
  });
});


describe('SecureMine real-data workspace and synchronization', () => {
  it('starts disconnected with no sample data and asks for a Redmine connection', () => {
    const dom = page(false); const d = dom.window.document;
    expect(d.querySelectorAll('.issue')).toHaveLength(0);
    expect(d.querySelector('#mode')!.textContent).toContain('未接続');
    expect(d.querySelector<HTMLButtonElement>('#newIssue')!.disabled).toBe(true);
    expect(d.querySelector<HTMLDetailsElement>('#settings')!.open).toBe(false);
    expect(d.querySelector<HTMLElement>('#connectionStatus')!.hidden).toBe(true);
    dom.window.close();
  });
  it('shows real projects without connection identity labels even when there are no issues', async () => {
    const {dom,d,calls}=remotePage();
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期済み'));
    expect(calls.some(c=>c.url.pathname.endsWith('/users/current.json'))).toBe(true);
    expect(d.querySelector<HTMLElement>('#mode')!.hidden).toBe(true);
    expect(d.querySelector('#mode')!.textContent).toBe('');
    expect(d.querySelector('#projectOverview')!.textContent).toContain('プロジェクト一覧');
    expect(d.querySelector('#projectOverview')!.textContent).toContain('Real project <img');
    expect(d.querySelector('#projectOverview img')).toBeNull();
    expect(d.querySelector('#issues')!.textContent).toContain('課題はまだ登録されていません');
    expect(d.querySelector('#pageInfo')!.textContent).toBe('0件');
    dom.window.close();
  });
  it('accepts an authenticated account with no visible projects and explains permissions', async () => {
    const {dom,d}=remotePage(false,true);
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期済み'));
    expect(d.querySelector('#projectOverview')!.textContent).toContain('閲覧できるプロジェクトがありません');
    expect(d.querySelector<HTMLButtonElement>('#newIssue')!.disabled).toBe(true);
    dom.window.close();
  });
  it('refreshes project metadata and issues and preserves data if synchronization fails', async () => {
    const {dom,d,calls,control}=remotePage();
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期済み'));
    control.updated=true;
    control.issues=[{id:21,subject:'Backend change',project:{id:7,name:'Updated project'},status:{id:1,name:'Open'},priority:{id:2,name:'Normal'},tracker:{id:1,name:'Task'}}];
    (d.querySelector('#refresh') as HTMLElement).click();
    await vi.waitFor(()=>expect(d.querySelector('#issues')!.textContent).toContain('Backend change'));
    expect(d.querySelector('#projects')!.textContent).toContain('Updated project');
    expect(calls.filter(c=>c.url.pathname.endsWith('/projects.json'))).toHaveLength(2);
    control.fail=true;
    (d.querySelector('#refresh') as HTMLElement).click();
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期失敗'));
    expect(d.querySelector('#issues')!.textContent).toContain('Backend change');
    expect(d.querySelector<HTMLButtonElement>('#refresh')!.disabled).toBe(false);
    dom.window.close();
  });
  it('supports automatic synchronization and pauses it while editing', async () => {
    const {dom,d,calls,control}=remotePage();
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期済み'));
    const auto=d.querySelector<HTMLInputElement>('#autoSync')!; auto.checked=true;
    control.updated=true; control.tick();
    await vi.waitFor(()=>expect(d.querySelector('#projects')!.textContent).toContain('Updated project'));
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期済み'));
    (d.querySelector('#newIssue') as HTMLElement).click();
    await vi.waitFor(()=>expect(d.querySelector('#assignee')!.textContent).toContain('Member'));
    const count=calls.length;
    control.tick();
    expect(calls.length).toBe(count);
    expect(d.querySelector('#syncState')!.textContent).toContain('編集中');
    dom.window.close();
  });
});


describe('SecureMine refreshed details and issue failures', () => {
  it('reloads the selected issue detail when changes were made in Redmine', async () => {
    const {dom,d,control}=remotePage();
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期済み'));
    control.issues=[{id:9,subject:'Remote issue',project:{id:7,name:'Remote'},status:{id:1,name:'Open'},priority:{id:2,name:'Normal'},tracker:{id:1,name:'Task'}}];
    (d.querySelector('#refresh') as HTMLElement).click();
    await vi.waitFor(()=>expect(d.querySelectorAll('.issue')).toHaveLength(1));
    await vi.waitFor(()=>expect(d.querySelector<HTMLButtonElement>('#refresh')!.disabled).toBe(false));
    (d.querySelector('.issue') as HTMLElement).click();
    await vi.waitFor(()=>expect(d.querySelector('#detail')!.textContent).toContain('変更履歴'));
    control.updated=true;
    (d.querySelector('#refresh') as HTMLElement).click();
    await vi.waitFor(()=>expect(d.querySelector('#detail')!.textContent).toContain('Updated remote issue'));
    dom.window.close();
  });
  it('keeps the previous issue list when metadata refresh succeeds but issue retrieval fails', async () => {
    const {dom,d,control}=remotePage();
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期済み'));
    control.issues=[{id:9,subject:'Previously loaded',project:{id:7,name:'Remote'},status:{id:1,name:'Open'},priority:{id:2,name:'Normal'},tracker:{id:1,name:'Task'}}];
    (d.querySelector('#refresh') as HTMLElement).click();
    await vi.waitFor(()=>expect(d.querySelector('#issues')!.textContent).toContain('Previously loaded'));
    await vi.waitFor(()=>expect(d.querySelector<HTMLButtonElement>('#refresh')!.disabled).toBe(false));
    control.failIssues=true;
    (d.querySelector('#refresh') as HTMLElement).click();
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期失敗'));
    expect(d.querySelector('#issues')!.textContent).toContain('Previously loaded');
    expect(d.querySelector('#issues')!.textContent).not.toContain('まだ登録されていません');
    dom.window.close();
  });
});

describe('SecureMine login feedback and restoration', () => {
  it('shows a spinner until login is saved, then shows the green completion toast', async () => {
    const {dom,d}=remotePage();
    expect(d.querySelector('#brand')!.textContent).toBe('▣ SecureMine');
    expect(d.querySelector('.login-spinner')).not.toBeNull();
    expect(d.querySelector('#connection button')!.getAttribute('aria-busy')).toBe('true');
    expect((d.querySelector('#loginToast') as HTMLElement).hidden).toBe(true);
    await vi.waitFor(()=>expect((d.querySelector('#loginToast') as HTMLElement).hidden).toBe(false));
    expect(d.querySelector('#loginToast')!.textContent).toBe('ログイン完了');
    expect(d.querySelector('#brand')!.textContent).toBe('🔐SecureMine');
    expect(d.querySelector<HTMLDetailsElement>('#settings')!.open).toBe(false);
    expect(d.querySelector('#settings')!.classList.contains('is-connected')).toBe(true);
    expect(d.querySelector<HTMLElement>('#connectionStatus')!.hidden).toBe(false);
    const toastStyle = dom.window.getComputedStyle(d.querySelector('#loginToast')!);
    expect(toastStyle.left).toBe('50%');
    expect(toastStyle.top).toBe('50%');
    expect(toastStyle.transform).toBe('translate(-50%,-50%)');
    expect(d.querySelector('.login-spinner')).toBeNull();
    dom.window.close();
  });
  it('stops the spinner without showing completion when saving fails',async()=>{
    const {dom,d,control}=remotePage();control.failLogin=true;
    await vi.waitFor(()=>expect(d.querySelector('#message')!.textContent).toContain('DB保存失敗'));
    expect((d.querySelector('#loginToast') as HTMLElement).hidden).toBe(true);
    expect(d.querySelector('.login-spinner')).toBeNull();
    expect((d.querySelector('#account') as HTMLSelectElement).value).toBe('');
    dom.window.close();
  });
  it('restores the saved connection after page load using the HttpOnly cookie without a browser API key',async()=>{
    const {dom,d,calls}=remotePage(false,false,true);
    await vi.waitFor(()=>expect(d.querySelector('#syncState')!.textContent).toContain('同期済み'));
    expect((d.querySelector('#account') as HTMLSelectElement).value).toBe('saved');
    expect(d.querySelector('#brand')!.textContent).toBe('🔐SecureMine');
    expect(d.querySelector<HTMLDetailsElement>('#settings')!.open).toBe(false);
    expect(d.querySelector('#settings')!.classList.contains('is-connected')).toBe(true);
    expect(d.querySelector<HTMLElement>('#connectionStatus')!.hidden).toBe(false);
    expect(calls.every(c=>!c.options.headers['X-Redmine-API-Key'])).toBe(true);
    expect((d.querySelector('#loginToast') as HTMLElement).hidden).toBe(true);
    dom.window.close();
  });
});
