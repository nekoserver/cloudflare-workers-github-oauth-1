import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('deployment script', () => {
  it('applies remote D1 migrations before deploying the Worker', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts.deploy).toBe(
      'npm run db:migrate:remote && npm run deploy:worker',
    );
    expect(packageJson.scripts['deploy:worker']).toBe('wrangler deploy');
  });
});
