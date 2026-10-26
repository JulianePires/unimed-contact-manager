import { z } from 'zod';

import type { FieldErrorCode } from './error-codes';
import { normalizeMobile, normalizePhone } from './phone';

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 120;
export const EMAIL_MAX_LENGTH = 254;

const emailFormat = z.email();

/** Registra a falha com o código de `errors[]`, recuperado por `toFieldErrors`. */
export function addFieldIssue(
  ctx: z.core.$RefinementCtx,
  code: FieldErrorCode,
  message: string,
): void {
  ctx.addIssue({ code: 'custom', message, params: { code } });
}

export const nameSchema = z
  .string({ error: 'Informe o nome.' })
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) addFieldIssue(ctx, 'REQUIRED', 'Informe o nome.');
    else if (value.length < NAME_MIN_LENGTH) {
      addFieldIssue(
        ctx,
        'NAME_TOO_SHORT',
        `O nome deve ter ao menos ${NAME_MIN_LENGTH} caracteres.`,
      );
    } else if (value.length > NAME_MAX_LENGTH) {
      addFieldIssue(ctx, 'NAME_TOO_LONG', `O nome deve ter até ${NAME_MAX_LENGTH} caracteres.`);
    }
  });

export const emailSchema = z
  .string({ error: 'Informe o e-mail.' })
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) addFieldIssue(ctx, 'REQUIRED', 'Informe o e-mail.');
    else if (value.length > EMAIL_MAX_LENGTH) {
      addFieldIssue(ctx, 'INVALID_EMAIL', `O e-mail deve ter até ${EMAIL_MAX_LENGTH} caracteres.`);
    } else if (!emailFormat.safeParse(value).success) {
      addFieldIssue(ctx, 'INVALID_EMAIL', 'Informe um e-mail válido.');
    }
  });

/** Celular em formato livre → E.164, exigindo número móvel (RN02, ADR-001). */
export const mobileSchema = z
  .string({ error: 'Informe o celular.' })
  .trim()
  .transform((value, ctx) => {
    if (value.length === 0) {
      addFieldIssue(ctx, 'REQUIRED', 'Informe o celular.');
      return z.NEVER;
    }
    const result = normalizeMobile(value);
    if (result.ok) return result.e164;
    if (result.code === 'NOT_A_MOBILE_NUMBER') {
      addFieldIssue(ctx, 'NOT_A_MOBILE_NUMBER', 'Informe um número de celular válido.');
    } else {
      addFieldIssue(ctx, 'INVALID_PHONE', 'Informe um número de telefone válido.');
    }
    return z.NEVER;
  });

/** Telefone opcional em formato livre → E.164; vazio vira `null` (sem telefone). */
export const phoneSchema = z
  .string({ error: 'Informe um número de telefone válido.' })
  .trim()
  .transform((value, ctx) => {
    if (value.length === 0) return null;
    const phone = normalizePhone(value);
    if (phone) return phone.e164;
    addFieldIssue(ctx, 'INVALID_PHONE', 'Informe um número de telefone válido.');
    return z.NEVER;
  });

export const isoDateTimeSchema = z.iso.datetime();
