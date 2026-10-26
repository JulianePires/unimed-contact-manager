import type { SessionsRepository } from '../repositories/sessions';

/** Encerra todas as sessões do usuário, inclusive a atual (UC03 FA1). */
export function logoutAll(sessions: SessionsRepository, userId: string): Promise<void> {
  return sessions.deleteAllOfUser(userId);
}
