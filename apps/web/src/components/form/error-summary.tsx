import { type AnyFormApi, useSelector } from '@tanstack/react-form';
import { CircleAlertIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { errorMessages, fieldDomId } from '@/lib/form';

export interface ErrorSummaryItem {
  /** Campo de origem; sem ele, o item é um erro geral do formulário. */
  fieldId?: string;
  message: string;
}

interface ErrorSummaryProps {
  title: string;
  items: ErrorSummaryItem[];
  /** Muda a cada envio com erro, devolvendo o foco ao resumo. */
  focusKey: number;
}

/** Resumo de erros (docs/06 §6.7): recebe o foco a cada envio com erro e leva a cada campo. */
export function ErrorSummary({ title, items, focusKey }: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (focusKey > 0) ref.current?.focus();
  }, [focusKey]);

  if (items.length === 0) return null;

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby={titleId}
      className="rounded-md border border-danger-border p-4"
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-danger">
        <CircleAlertIcon aria-hidden="true" className="size-4" />
        {title}
      </h2>
      <ul className="mt-2 grid gap-1 pl-6 text-sm">
        {items.map(({ fieldId, message }) => (
          <li key={`${fieldId ?? 'form'}-${message}`} className="list-disc">
            {fieldId ? (
              <a
                href={`#${fieldId}`}
                className="text-danger underline underline-offset-2"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(fieldId)?.focus();
                }}
              >
                {message}
              </a>
            ) : (
              message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface FormErrorSummaryProps {
  form: AnyFormApi;
  title: string;
  focusKey: number;
  formError?: string | undefined;
}

/** Resumo ligado a um formulário do TanStack Form: erros dos campos e erro geral, após o envio. */
export function FormErrorSummary({ form, title, focusKey, formError }: FormErrorSummaryProps) {
  const fieldMeta = useSelector(form.store, (state) => state.fieldMeta);
  const fieldItems = Object.entries(fieldMeta).flatMap(([name, meta]) =>
    errorMessages(meta?.errors ?? []).map((message) => ({
      fieldId: fieldDomId(form.formId, name),
      message,
    })),
  );
  const items =
    focusKey === 0 ? [] : [...fieldItems, ...(formError ? [{ message: formError }] : [])];

  return <ErrorSummary title={title} items={items} focusKey={focusKey} />;
}
