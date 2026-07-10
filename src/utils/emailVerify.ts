export interface SendEmailResult {
  ok: boolean;
  status: number;
  error?: string;
}

export async function sendTestEmailResend(apiKey: string, to: string): Promise<SendEmailResult> {
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
        subject: 'テストメール',
        text: 'これはResend経由のテストメール送信です。',
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
