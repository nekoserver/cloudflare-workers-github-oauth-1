ALTER TABLE resend_webhook_sources ADD COLUMN webhook_secret TEXT;
ALTER TABLE resend_webhook_log ADD COLUMN email_from TEXT;
