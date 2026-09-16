import { describe, expect, it } from 'vitest';
import { API_ENDPOINT_LIST } from './data/apiEndpointList';
import { getApisPage } from './views/apis';

describe('/apis ページ: 鍵の表示可否 API', () => {
  const html = getApisPage();

  it('POST /auth/public-key/available のリクエストとレスポンス例を掲載する', () => {
    const start = html.indexOf("method:'POST', path:'/auth/public-key/available'");
    expect(start).toBeGreaterThan(-1);

    const endpoint = html.slice(start, start + 700);
    expect(endpoint).toContain("body:[{n:'keys',req:true");
    expect(endpoint).toContain("userId:'nekoserver'");
    expect(endpoint).toContain("keyId:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'");
    expect(endpoint).toContain("res:{keyIds:['xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx']}");
  });

  it('GET /api/api-keys の説明に失効済みキーの表示期間を明記する', () => {
    const start = html.indexOf("method:'GET',  path:'/api/api-keys'");
    expect(start).toBeGreaterThan(-1);
    expect(html.slice(start, start + 300)).toContain('失効後7日以内');
  });

  it('ワークフロー参照用の静的一覧にも同じ内容を反映する', () => {
    expect(API_ENDPOINT_LIST).toContainEqual(expect.objectContaining({
      group: 'APIキー管理',
      method: 'POST',
      path: '/auth/public-key/available',
    }));

    const listEndpoint = API_ENDPOINT_LIST.find(
      (endpoint) => endpoint.method === 'GET' && endpoint.path === '/api/api-keys',
    );
    expect(listEndpoint?.desc).toContain('失効後7日以内');
  });
});
