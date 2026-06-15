export function validateRevokeRequest(body: { userId: unknown; reason?: unknown }): { ok: true } | { ok: false; error: string } {
  if (!body.userId || typeof body.userId !== 'string' || body.userId.trim() === '') {
    return { ok: false, error: 'userId は必須です' };
  }
  return { ok: true };
}
