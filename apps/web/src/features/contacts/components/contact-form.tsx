import {
  type Contact,
  createContactInputSchema,
  phoneInputValue,
  phoneSchema,
} from '@contatos/contracts';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';

import { FormErrorSummary } from '@/components/form/error-summary';
import { FormField } from '@/components/form/form-field';
import { PhoneInput } from '@/components/form/phone-input';
import { useFormFeedback } from '@/components/form/use-form-feedback';
import { Button } from '@/components/ui/button';
import { applyServerErrors, fieldDomId, formBehavior, submitForm } from '@/lib/form';
import { ApiError } from '@/lib/http';

import { InactiveConflictAlert } from './inactive-conflict-alert';

export interface ContactFormValues {
  name: string;
  email: string;
  mobile: string;
  phone: string;
}

export const EMPTY_CONTACT: ContactFormValues = { name: '', email: '', mobile: '', phone: '' };

/** Valores iniciais da edição: telefones como a pessoa os digitaria, sem `+55`. */
export function toFormValues(contact: Contact): ContactFormValues {
  return {
    name: contact.name,
    email: contact.email,
    mobile: phoneInputValue(contact.mobile),
    phone: phoneInputValue(contact.phone),
  };
}

/** Mesmas regras do cadastro na API; no formulário, telefone vazio é string vazia. */
const contactFormSchema = createContactInputSchema.extend({ phone: phoneSchema });

interface MobileConflict {
  code: 'MOBILE_ALREADY_EXISTS' | 'MOBILE_BELONGS_TO_INACTIVE_CONTACT';
  contactId: string;
}

const CONFLICT_MESSAGES = {
  MOBILE_ALREADY_EXISTS: 'Este celular já pertence a outro contato.',
  MOBILE_BELONGS_TO_INACTIVE_CONTACT: 'Este celular pertence a um contato inativo.',
} as const;

const FALLBACK = 'Não foi possível salvar o contato agora. Tente novamente em instantes.';

interface ContactFormProps {
  defaultValues: ContactFormValues;
  submitLabel: string;
  /** Envia os valores (a API normaliza os telefones); erros voltam para o formulário. */
  onSubmit: (values: ContactFormValues) => Promise<unknown>;
  /** Erros que a página trata (ex.: 412 na edição); devolve `true` se tratou. */
  onApiError?: (error: ApiError) => boolean;
  /** Avisos acima dos campos (ex.: alteração concorrente). */
  notice?: ReactNode;
}

/**
 * Formulário de contato, comum a criar e editar (UC04/UC07, docs/06 §6.6): validação dos
 * contracts ao sair do campo, `ErrorSummary` com foco e os dois conflitos de celular (ADR-001).
 */
export function ContactForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onApiError,
  notice,
}: ContactFormProps) {
  const feedback = useFormFeedback();
  const [conflict, setConflict] = useState<MobileConflict>();
  const form = useForm({
    ...formBehavior,
    defaultValues,
    validators: { onDynamic: contactFormSchema },
    onSubmitInvalid: () => {
      feedback.report();
    },
    onSubmit: async ({ value, formApi }) => {
      setConflict(undefined);
      try {
        await onSubmit(value);
      } catch (error) {
        if (!(error instanceof ApiError)) {
          feedback.report(FALLBACK);
          return;
        }
        if (onApiError?.(error)) return;
        const contactId = error.extras['contactId'];
        if (
          (error.code === 'MOBILE_ALREADY_EXISTS' ||
            error.code === 'MOBILE_BELONGS_TO_INACTIVE_CONTACT') &&
          typeof contactId === 'string'
        ) {
          const message = CONFLICT_MESSAGES[error.code];
          formApi.setFieldMeta('mobile', (meta) => ({
            ...meta,
            errorMap: { ...meta.errorMap, onServer: message },
          }));
          setConflict({ code: error.code, contactId });
          // O conflito com inativo tem ações próprias e recebe o foco no lugar do resumo
          if (error.code === 'MOBILE_ALREADY_EXISTS') feedback.report();
          return;
        }
        feedback.report(applyServerErrors(formApi, error) ? undefined : FALLBACK);
      }
    },
  });

  const focusMobile = () => {
    document.getElementById(fieldDomId(form.formId, 'mobile'))?.focus();
  };

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submitForm(form);
      }}
    >
      {notice}
      <FormErrorSummary
        form={form}
        title="Não foi possível salvar o contato"
        focusKey={feedback.attempt}
        formError={feedback.formError}
      />
      <form.Field name="name">
        {(field) => <FormField field={field} label="Nome" autoComplete="name" />}
      </form.Field>
      <form.Field name="email">
        {(field) => <FormField field={field} label="E-mail" type="email" autoComplete="email" />}
      </form.Field>
      <form.Field
        name="mobile"
        listeners={{
          onChange: () => {
            setConflict(undefined);
          },
        }}
      >
        {(field) => (
          <FormField
            field={field}
            label="Celular"
            autoComplete="tel"
            hint="Com DDD. Ex.: (81) 99999-0000"
            input={(props) => <PhoneInput {...props} />}
          >
            {conflict?.code === 'MOBILE_ALREADY_EXISTS' && (
              <p className="text-sm">
                <Link
                  to="/contatos/$id"
                  params={{ id: conflict.contactId }}
                  className="text-primary underline underline-offset-2"
                >
                  Ver o contato que usa este celular
                </Link>
              </p>
            )}
            {conflict?.code === 'MOBILE_BELONGS_TO_INACTIVE_CONTACT' && (
              <InactiveConflictAlert
                contactId={conflict.contactId}
                onUseAnotherNumber={focusMobile}
              />
            )}
          </FormField>
        )}
      </form.Field>
      <form.Field name="phone">
        {(field) => (
          <FormField
            field={field}
            label="Telefone (opcional)"
            autoComplete="tel"
            input={(props) => <PhoneInput {...props} />}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting} className="justify-self-start">
            {isSubmitting ? 'Salvando…' : submitLabel}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
