import { type SessionPolicy, sessionExpiresAt } from '../domain/session-policy';
import type { SessionsRepository } from '../repositories/sessions';

export interface SessionDeps {
  sessions: SessionsRepository;
  policy: SessionPolicy;
  now: () => Date;
}

export interface ClientInfo {
  userAgent: string | undefined;
  ip: string | undefined;
}

/** Novo identificador a cada autenticação (proteção contra session fixation). */
export function startSession(
  { sessions, policy, now }: SessionDeps,
  userId: string,
  client: ClientInfo,
): Promise<string> {
  const createdAt = now();
  return sessions.create({
    userId,
    now: createdAt,
    expiresAt: sessionExpiresAt(policy, { createdAt, lastSeenAt: createdAt }),
    ...client,
  });
}
