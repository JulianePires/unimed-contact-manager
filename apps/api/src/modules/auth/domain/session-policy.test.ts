import { describe, expect, it } from 'vitest';

import { isSessionActive, sessionExpiresAt, shouldTouchSession } from './session-policy';

const policy = { idleMinutes: 120, maxDays: 7 };
const createdAt = new Date('2026-10-01T12:00:00.000Z');
const at = (iso: string) => new Date(iso);

describe('sessionExpiresAt (ADR-006)', () => {
  it('dado uma sessão recém-criada, então expira após 2 h de inatividade', () => {
    expect(sessionExpiresAt(policy, { createdAt, lastSeenAt: createdAt })).toEqual(
      at('2026-10-01T14:00:00.000Z'),
    );
  });

  it('dado atividade recente, então a expiração desliza a partir do último acesso', () => {
    expect(
      sessionExpiresAt(policy, { createdAt, lastSeenAt: at('2026-10-03T08:30:00.000Z') }),
    ).toEqual(at('2026-10-03T10:30:00.000Z'));
  });

  it('dado atividade perto do limite absoluto, então não passa de 7 dias da criação', () => {
    expect(
      sessionExpiresAt(policy, { createdAt, lastSeenAt: at('2026-10-08T11:00:00.000Z') }),
    ).toEqual(at('2026-10-08T12:00:00.000Z'));
  });
});

describe('isSessionActive', () => {
  const expiresAt = at('2026-10-01T14:00:00.000Z');

  it.each([
    ['antes do prazo', '2026-10-01T13:59:59.999Z', true],
    ['exatamente no prazo', '2026-10-01T14:00:00.000Z', false],
    ['depois do prazo', '2026-10-01T14:00:00.001Z', false],
  ])('%s → %s', (_, now, expected) => {
    expect(isSessionActive(expiresAt, at(now))).toBe(expected);
  });
});

describe('shouldTouchSession (throttle de last_seen_at)', () => {
  it.each([
    ['59 s depois', '2026-10-01T12:00:59.000Z', false],
    ['1 min depois', '2026-10-01T12:01:00.000Z', true],
    ['10 min depois', '2026-10-01T12:10:00.000Z', true],
  ])('%s → %s', (_, now, expected) => {
    expect(shouldTouchSession(createdAt, at(now))).toBe(expected);
  });
});
