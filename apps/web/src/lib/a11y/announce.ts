export type Politeness = 'polite' | 'assertive';

export interface Announcement {
  id: number;
  message: string;
}

type Listener = () => void;

const current: Record<Politeness, Announcement | null> = { polite: null, assertive: null };
const listeners = new Set<Listener>();
let sequence = 0;

/**
 * Anuncia uma mensagem a leitores de tela pelo <LiveAnnouncer/> (docs/06 §6.7): resultados de busca,
 * marcos de importação, confirmações. `assertive` só para o que exige atenção imediata (erros).
 * Mensagens repetidas são anunciadas de novo, pois cada uma recebe um id.
 */
export function announce(message: string, politeness: Politeness = 'polite'): void {
  sequence += 1;
  current[politeness] = { id: sequence, message };
  for (const listener of listeners) listener();
}

export function subscribeAnnouncements(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentAnnouncement(politeness: Politeness): Announcement | null {
  return current[politeness];
}
