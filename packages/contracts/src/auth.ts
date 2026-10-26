import { z } from 'zod';

import { addFieldIssue, emailSchema, nameSchema } from './fields';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const graphemes = new Intl.Segmenter();
const passwordLength = (value: string) => [...graphemes.segment(value)].length;

/** Política de senha (docs/05 §5.3): 12–128 caracteres, contados como o usuário os vê (grafemas). */
export const passwordSchema = z.string({ error: 'Informe a senha.' }).superRefine((value, ctx) => {
  const length = passwordLength(value);
  if (length === 0) addFieldIssue(ctx, 'REQUIRED', 'Informe a senha.');
  else if (length < PASSWORD_MIN_LENGTH) {
    addFieldIssue(
      ctx,
      'PASSWORD_TOO_SHORT',
      `A senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    );
  } else if (length > PASSWORD_MAX_LENGTH) {
    addFieldIssue(
      ctx,
      'PASSWORD_TOO_LONG',
      `A senha deve ter até ${PASSWORD_MAX_LENGTH} caracteres.`,
    );
  }
});

export const registerInputSchema = z.strictObject({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

/** Login não aplica a política: credenciais erradas sempre recebem a resposta genérica (401). */
export const loginInputSchema = z.strictObject({
  email: emailSchema,
  password: z.string({ error: 'Informe a senha.' }).superRefine((value, ctx) => {
    if (value.length === 0) addFieldIssue(ctx, 'REQUIRED', 'Informe a senha.');
    else if (passwordLength(value) > PASSWORD_MAX_LENGTH) {
      addFieldIssue(
        ctx,
        'PASSWORD_TOO_LONG',
        `A senha deve ter até ${PASSWORD_MAX_LENGTH} caracteres.`,
      );
    }
  }),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
});
export type User = z.infer<typeof userSchema>;
