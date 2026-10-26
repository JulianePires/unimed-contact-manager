import type { SessionsRepository } from '../repositories/sessions';

export function logout(sessions: SessionsRepository, sessionToken: string): Promise<void> {
  return sessions.delete(sessionToken);
}
