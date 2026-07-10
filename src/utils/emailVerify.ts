export interface SendEmailResult {
  ok: boolean;
  status: number;
  error?: string;
}

async function sendResendEmail(apiKey: string, to: string, subject: string, text: string): Promise<SendEmailResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to,
        subject,
        text,
      }),
    });
    const data = await res.json().catch(() => undefined) as Record<string, unknown> | undefined;
    if (!res.ok) {
      const errMsg = data && typeof data.message !== 'undefined' ? String(data.message) : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: errMsg };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: String((err as Error)?.message ?? err) };
  }
}

export async function sendTestEmailResend(apiKey: string, to: string): Promise<SendEmailResult> {
  return sendResendEmail(apiKey, to, 'テストメール', 'これはResend経由のテストメール送信です。');
}

export async function sendLoginConfirmEmail(apiKey: string, to: string, confirmUrl: string): Promise<SendEmailResult> {
  return sendResendEmail(
    apiKey,
    to,
    'ログイン確認メール',
    `以下のリンクをクリックしてログインを完了してください。\n\n${confirmUrl}\n\nこのリンクの有効期限は30分です。心当たりがない場合はこのメールを破棄してください。`
  );
}
