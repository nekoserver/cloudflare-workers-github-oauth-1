import { describe, expect, it } from 'vitest';
import { resolveStatusTablePreviewQuery } from './index';

describe('aichat_images status preview', () => {
  it('画像本体を取得せず、ログインユーザーのメタデータだけを返す', () => {
    const query = resolveStatusTablePreviewQuery(
      'aichat_images',
      'SELECT * FROM aichat_images WHERE user_id = {USER_ID} LIMIT 20',
      'github-user',
      null,
      null,
    );

    expect(query).not.toBeNull();
    expect(query?.params).toEqual(['github-user']);
    expect(query?.sql).toContain('WHERE user_id = ?');
    expect(query?.sql).toContain('length(image_data_url)');
    expect(query?.sql).toContain('END AS image_data_url');
    expect(query?.sql).not.toMatch(/SELECT\s+\*/i);
    expect(query?.sql).toContain('LIMIT 20');
  });
});
