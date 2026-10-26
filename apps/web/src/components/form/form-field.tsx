import type { AnyFieldApi } from '@tanstack/react-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fieldDomId, visibleFieldErrors } from '@/lib/form';

interface FormFieldProps {
  field: AnyFieldApi;
  label: string;
  type?: 'text' | 'email' | 'password' | 'tel';
  autoComplete: string;
  hint?: string;
}

/** Campo com rótulo visível, dica e erro ligados por `aria-describedby` (docs/06 §6.7). */
export function FormField({ field, label, type = 'text', autoComplete, hint }: FormFieldProps) {
  const name = String(field.name);
  const id = fieldDomId(field.form.formId, name);
  const hintId = `${id}-dica`;
  const errorId = `${id}-erro`;
  const errors = visibleFieldErrors(field);
  const invalid = errors.length > 0;
  const describedBy = [hint ? hintId : '', invalid ? errorId : ''].filter(Boolean).join(' ');

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={String(field.state.value ?? '')}
        onChange={(event) => {
          field.handleChange(event.target.value);
        }}
        onBlur={field.handleBlur}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy || undefined}
      />
      {invalid && (
        <p id={errorId} className="text-sm text-danger">
          {errors.join(' ')}
        </p>
      )}
    </div>
  );
}
