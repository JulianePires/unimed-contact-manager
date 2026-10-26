const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface SessionPolicy {
  idleMinutes: number;
  maxDays: number;
}

/** `last_seen_at` é renovado no máximo uma vez por minuto (ADR-006). */
export const TOUCH_INTERVAL_MS = MINUTE_MS;

/** Expiração deslizante por inatividade, limitada pelo prazo absoluto desde a criação. */
export function sessionExpiresAt(
  policy: SessionPolicy,
  { createdAt, lastSeenAt }: { createdAt: Date; lastSeenAt: Date },
): Date {
  const idle = lastSeenAt.getTime() + policy.idleMinutes * MINUTE_MS;
  const absolute = createdAt.getTime() + policy.maxDays * DAY_MS;
  return new Date(Math.min(idle, absolute));
}

export function isSessionActive(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() > now.getTime();
}

export function shouldTouchSession(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() >= TOUCH_INTERVAL_MS;
}
