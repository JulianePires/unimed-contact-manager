import { loginInputSchema } from '@contatos/contracts';
import { useForm } from '@tanstack/react-form';

import { FormErrorSummary } from '@/components/form/error-summary';
import { FormField } from '@/components/form/form-field';
import { useFormFeedback } from '@/components/form/use-form-feedback';
import { Button } from '@/components/ui/button';
import { apiErrorMessage, applyServerErrors, formBehavior } from '@/lib/form';
import { ApiError } from '@/lib/http';

import { useLogin } from '../hooks/use-login';

/** Mensagem genérica em falha de login: não revela se o e-mail existe (UC02 FE1). */
const MESSAGES = {
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  RATE_LIMITED: 'Muitas tentativas de entrar. Aguarde alguns minutos e tente novamente.',
};
const FALLBACK = 'Não foi possível entrar agora. Tente novamente em instantes.';

export function LoginForm({ redirectTo }: { redirectTo?: string | undefined }) {
  const login = useLogin(redirectTo);
  const feedback = useFormFeedback();
  const form = useForm({
    ...formBehavior,
    defaultValues: { email: '', password: '' },
    validators: { onDynamic: loginInputSchema },
    onSubmitInvalid: () => {
      feedback.report();
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await login.mutateAsync(loginInputSchema.parse(value));
      } catch (error) {
        if (error instanceof ApiError && applyServerErrors(formApi, error)) feedback.report();
        else feedback.report(apiErrorMessage(error, MESSAGES, FALLBACK));
      }
    },
  });

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FormErrorSummary
        form={form}
        title="Não foi possível entrar"
        focusKey={feedback.attempt}
        formError={feedback.formError}
      />
      <form.Field name="email">
        {(field) => <FormField field={field} label="E-mail" type="email" autoComplete="email" />}
      </form.Field>
      <form.Field name="password">
        {(field) => (
          <FormField field={field} label="Senha" type="password" autoComplete="current-password" />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
