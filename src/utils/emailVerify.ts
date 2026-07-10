export interface EmailVerifyResult {
  ok: boolean;
  status: number;
  data?: Record<string, unknown>;
  error?: string;
}

export async function verifyEmailAbstract(apiKey: string, email: string): Promise<EmailVerifyResult> {
  const url = 'https://emailvalidation.abstractapi.com/v1/?api_key=' + encodeURIComponent(apiKey) + '&email=' + encodeURIComponent(email);
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => undefined) as Record<string, unknown> | undefined;
    if (!res.ok) {
      const errMsg = data && typeof data.error !== 'undefined' ? JSON.stringify(data.error) : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: errMsg };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: String((err as Error)?.message ?? err) };
  }
}
