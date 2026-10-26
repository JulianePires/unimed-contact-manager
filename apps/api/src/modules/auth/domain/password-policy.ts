import { type FieldError, passwordSchema, toFieldErrors } from '@contatos/contracts';

/** Parâmetros do argon2id: mínimo recomendado pela OWASP (19 MiB, 2 iterações, 1 via). */
export const PASSWORD_HASH_PARAMS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Política de senha do cadastro (docs/05 §5.3); vazio significa senha aceita. */
export function checkPasswordPolicy(password: string): FieldError[] {
  const result = passwordSchema.safeParse(password);
  return result.success
    ? []
    : toFieldErrors(result.error).map((error) => ({ ...error, field: 'password' }));
}
