import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { forwardTaskmineRedmine, validateTaskmineRedmineTarget } from './taskmineRedmine';

const headers = {'X-Redmine-URL':'https://mynw.nekomaneki.work/redmine/', 'X-Redmine-API-Key':'private-key', 'X-Redmine-Path':'users/current.json', 'X-Redmine-Method':'GET'};
const request = (overrides: Record<string,string> = {}, body?: string) => new Request('https://workspace.example/api/taskmine/redmine', {method:'POST',headers:{...headers,...overrides},body});
describe('Taskmine Redmine relay', () => {
  it('accesses Redmine without browser CORS and preserves subdirectory URLs and API authentication', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({user:{id:7,login:'alice'}}),{headers:{'Content-Type':'application/json','Set-Cookie':'remote=secret'}}));
    const result = await forwardTaskmineRedmine(request(),fetcher);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({user:{id:7,login:'alice'}});
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://mynw.nekomaneki.work/redmine/users/current.json');
    const init=fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get('X-Redmine-API-Key')).toBe('private-key');
    expect(new Headers(init.headers).get('Cookie')).toBeNull();
    expect(init.redirect).toBe('manual');
    expect(result.headers.get('Set-Cookie')).toBeNull();
    expect(result.headers.get('Cache-Control')).toBe('no-store');
  });
  it.each(['http://redmine.example','https://127.0.0.1','https://2130706433','https://10.0.0.2','https://169.254.169.254','https://[::1]','https://localhost','https://secret.internal','https://alice:password@redmine.example','https://mynw.nekomaneki.work?key=secret'])('rejects invalid or private targets %s', base => {
    expect(()=>validateTaskmineRedmineTarget(base,'users/current.json','GET')).toThrow();
  });
  it.each(['../admin.json','https://elsewhere.example/users/current.json','//elsewhere.example','users/current.json?key=secret','attachments/download/3/%2e%2e%2fsecret','admin.json'])('rejects non-Redmine API paths %s', path => {
    expect(()=>validateTaskmineRedmineTarget(headers['X-Redmine-URL'],path,'GET')).toThrow();
  });
  it('does not forward cross-origin calls or unsupported methods', async () => {
    const fetcher=vi.fn();
    expect((await forwardTaskmineRedmine(request({Origin:'https://elsewhere.example'}),fetcher)).status).toBe(403);
    expect((await forwardTaskmineRedmine(request({'X-Redmine-Method':'DELETE'}),fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('explains invalid API keys, permissions, HTML responses and redirects', async () => {
    for(const [status,type,errorCode] of [[401,'text/html','REDMINE_AUTH'],[403,'text/html','REDMINE_FORBIDDEN'],[302,'text/html','REDMINE_REDIRECT'],[200,'text/html','REDMINE_FORMAT']] as const){
      const result=await forwardTaskmineRedmine(request(),async()=>new Response('<html>Login</html>',{status,headers:{'Content-Type':type,Location:'https://elsewhere.example'}}));
      const data=await result.json() as any;
      expect(data.errorCode).toBe(errorCode);
      expect(data.error).not.toContain('private-key');
    }
  });
  it('reports upstream network failures rather than hiding them', async () => {
    const result=await forwardTaskmineRedmine(request(),async()=>{throw new Error('TLS failure');});
    expect(result.status).toBe(502);
    expect(await result.json()).toMatchObject({errorCode:'REDMINE_NETWORK'});
  });
  it('streams uploads and downloads while restricting writes to supported Redmine resources', async () => {
    const upload=request({'X-Redmine-Path':'uploads.json?filename=a.txt','X-Redmine-Method':'POST','Content-Type':'application/octet-stream'},'file content');
    const fetcher=vi.fn(async (_url: string,_init?: RequestInit)=>new Response('{"upload":{"token":"uploaded"}}',{status:201,headers:{'Content-Type':'application/json'}}));
    expect((await forwardTaskmineRedmine(upload,fetcher)).status).toBe(201);
    expect(await new Response(fetcher.mock.calls[0][1]?.body).text()).toBe('file content');
    const download=request({'X-Redmine-Path':'attachments/download/3/a.txt'});
    const result=await forwardTaskmineRedmine(download,async()=>new Response('file content',{headers:{'Content-Type':'text/plain'}}));
    expect(await result.text()).toBe('file content');
    expect(result.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(()=>validateTaskmineRedmineTarget(headers['X-Redmine-URL'],'users/current.json','POST')).toThrow();
  });
  it('requires application authentication before relaying credentials', async () => {
    const app=new Hono();
    app.post('/api/taskmine/redmine',authMiddleware,()=>{throw new Error('must not forward');});
    const response=await app.request(request());
    expect(response.status).toBe(401);
  });
});
