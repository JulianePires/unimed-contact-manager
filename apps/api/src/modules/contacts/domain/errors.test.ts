import { describe, expect, it } from 'vitest';

import {
  contactNotFound,
  mobileConflict,
  preconditionRequired,
  rejectedAnonymization,
  rejectedUpdate,
} from './errors';

const id = '0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e';

describe('mobileConflict (T-UB07, ADR-001)', () => {
  it('dado conflito com contato ativo, então MOBILE_ALREADY_EXISTS com o id', () => {
    expect(mobileConflict({ id, deactivatedAt: null })).toMatchObject({
      status: 409,
      code: 'MOBILE_ALREADY_EXISTS',
      extras: { contactId: id },
    });
  });

  it('dado conflito com contato inativo, então MOBILE_BELONGS_TO_INACTIVE_CONTACT com o id', () => {
    expect(
      mobileConflict({ id, deactivatedAt: new Date('2026-10-25T10:00:00.000Z') }),
    ).toMatchObject({
      status: 409,
      code: 'MOBILE_BELONGS_TO_INACTIVE_CONTACT',
      extras: { contactId: id },
    });
  });

  it('dado conflitante que sumiu antes da consulta, então MOBILE_ALREADY_EXISTS sem id', () => {
    const error = mobileConflict(undefined);

    expect(error).toMatchObject({ status: 409, code: 'MOBILE_ALREADY_EXISTS' });
    expect(error.extras).toEqual({});
  });
});

describe('contactNotFound (RN06)', () => {
  it('é 404 genérico, sem revelar se o contato existe', () => {
    expect(contactNotFound()).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

describe('regras do ciclo de vida (T-UB06)', () => {
  it('PATCH sem If-Match → 428 PRECONDITION_REQUIRED', () => {
    expect(preconditionRequired()).toMatchObject({ status: 428, code: 'PRECONDITION_REQUIRED' });
  });

  it('edição sem efeito: contato existe → 412; não existe ou eliminado → 404', () => {
    expect(rejectedUpdate({ id })).toMatchObject({ status: 412, code: 'CONTACT_MODIFIED' });
    expect(rejectedUpdate(undefined)).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('eliminação sem efeito: ainda ativo → 409 com o id; não existe ou já eliminado → 404', () => {
    expect(rejectedAnonymization({ id, deactivatedAt: null })).toMatchObject({
      status: 409,
      code: 'CONTACT_MUST_BE_INACTIVE',
      extras: { contactId: id },
    });
    expect(rejectedAnonymization(undefined)).toMatchObject({ status: 404 });
  });
});
