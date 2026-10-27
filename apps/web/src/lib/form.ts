import type { ErrorCode } from '@contatos/contracts';
import { type AnyFieldApi, type AnyFormApi, revalidateLogic } from '@tanstack/react-form';

import { ApiError } from './http';

/**
 * Comportamento comum dos formulários (docs/06 §6.7): valida ao sair do campo e, depois do primeiro
 * envio, a cada alteração; o erro vindo da API some quando o campo é editado.
 */
export const formBehavior = {
  validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
  listeners: {
    onChange: ({ fieldApi }: { fieldApi: AnyFieldApi }) => {
      clearServerError(fieldApi);
    },
  },
};

/**
 * Envia revalidando os valores atuais: com Enter no último campo (sem sair dele), o erro gravado
 * quando ele ainda estava vazio bloquearia o envio.
 */
export async function submitForm(form: AnyFormApi): Promise<void> {
  await form.validate('blur');
  await form.handleSubmit();
}

export function fieldDomId(formId: string, name: string): string {
  return `${formId}-${name}`;
}

/** Mensagens de um campo, vindas de strings ou de issues do Standard Schema (Zod), sem repetição. */
export function errorMessages(errors: readonly unknown[]): string[] {
  const messages = errors.flatMap(function collect(error: unknown): string[] {
    if (typeof error === 'string') return [error];
    if (Array.isArray(error)) return error.flatMap(collect);
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return typeof error.message === 'string' ? [error.message] : [];
    }
    return [];
  });
  return [...new Set(messages)];
}

/** Erros só aparecem depois que a pessoa sai do campo ou tenta enviar, não durante a digitação. */
export function visibleFieldErrors(field: AnyFieldApi): string[] {
  const shown = field.state.meta.isBlurred || field.form.state.submissionAttempts > 0;
  return shown ? errorMessages(field.state.meta.errors) : [];
}

/** `errors[]` de um 422 vai para os campos do formulário; devolve se algum campo recebeu erro. */
export function applyServerErrors(form: AnyFormApi, error: ApiError): boolean {
  const fields = Object.keys(form.state.values as object);
  const known = error.errors.filter(({ field }) => fields.includes(field));
  for (const { field, message } of known) {
    form.setFieldMeta(field, (meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onServer: message },
    }));
  }
  return known.length > 0;
}

function clearServerError(field: AnyFieldApi): void {
  if (field.state.meta.errorMap.onServer === undefined) return;
  field.setMeta((meta) => ({ ...meta, errorMap: { ...meta.errorMap, onServer: undefined } }));
}

/** Texto para o usuário por código de erro; o resto (rede, 5xx) cai na mensagem genérica. */
export function apiErrorMessage(
  error: unknown,
  messages: Partial<Record<ErrorCode, string>>,
  fallback: string,
): string {
  return (error instanceof ApiError ? messages[error.code] : undefined) ?? fallback;
}
