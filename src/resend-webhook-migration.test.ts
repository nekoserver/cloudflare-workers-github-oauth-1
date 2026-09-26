import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const createLogMigration = readFileSync('migrations/0019_create_resend_webhook_log.sql', 'utf8');
const addWebhookSecretMigration = readFileSync('migrations/0023_add_webhook_secret_to_sources.sql', 'utf8');

describe('Resend webhook migrations', () => {
  it('adds email_from only in the later ALTER TABLE migration', () => {
    expect(createLogMigration).not.toMatch(/\bemail_from\b/);
    expect(addWebhookSecretMigration).toContain(
      'ALTER TABLE resend_webhook_log ADD COLUMN email_from TEXT;',
    );
  });
});
