import { PASSWORD_MIN_LENGTH, registerInputSchema } from '@contatos/contracts';
import { useForm } from '@tanstack/react-form';

import { FormErrorSummary } from '@/components/form/error-summary';
import { FormField } from '@/components/form/form-field';
import { useFormFeedback } from '@/components/form/use-form-feedback';
import { Button } from '@/components/ui/button';
import { apiErrorMessage, applyServerErrors, formBehavior } from '@/lib/form';
import { ApiError } from '@/lib/http';

import { useRegister } from '../hooks/use-register';

/** E-mail já cadastrado recebe a mesma resposta genérica, sem confirmar a conta (UC01 FE1). */
const MESSAGES = {
  REGISTRATION_FAILED:
    'Não foi possível concluir o cadastro. Verifique os dados ou entre, se você já tiver uma conta.',
  RATE_LIMITED: 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.',
};
const FALLBACK = 'Não foi possível criar a conta agora. Tente novamente em instantes.';

export function RegisterForm() {
  const register = useRegister();
  const feedback = useFormFeedback();
  const form = useForm({
    ...formBehavior,
    defaultValues: { name: '', email: '', password: '' },
    validators: { onDynamic: registerInputSchema },
    onSubmitInvalid: () => {
      feedback.report();
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await register.mutateAsync(registerInputSchema.parse(value));
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
        title="Não foi possível criar a conta"
        focusKey={feedback.attempt}
        formError={feedback.formError}
      />
      <form.Field name="name">
        {(field) => <FormField field={field} label="Nome" autoComplete="name" />}
      </form.Field>
      <form.Field name="email">
        {(field) => <FormField field={field} label="E-mail" type="email" autoComplete="email" />}
      </form.Field>
      <form.Field name="password">
        {(field) => (
          <FormField
            field={field}
            label="Senha"
            type="password"
            autoComplete="new-password"
            hint={`Use ao menos ${PASSWORD_MIN_LENGTH} caracteres. Uma frase longa é mais fácil de lembrar.`}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Criando conta…' : 'Criar conta'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
