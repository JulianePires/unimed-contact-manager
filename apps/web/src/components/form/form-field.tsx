import type { AnyFieldApi } from '@tanstack/react-form';
import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fieldDomId, visibleFieldErrors } from '@/lib/form';

/** Props que o `FormField` repassa a um input próprio (ex.: `PhoneInput`). */
export interface FieldInputProps {
  id: string;
  name: string;
  autoComplete: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur: () => void;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
}

interface FormFieldProps {
  field: AnyFieldApi;
  label: string;
  type?: 'text' | 'email' | 'password' | 'tel';
  autoComplete: string;
  hint?: string;
  /** Substitui o input padrão, mantendo rótulo, dica e erro. */
  input?: (props: FieldInputProps) => ReactNode;
  /** Conteúdo logo após o erro (ex.: link para o contato que já usa o celular). */
  children?: ReactNode;
}

/** Campo com rótulo visível, dica e erro ligados por `aria-describedby` (docs/06 §6.7). */
export function FormField({
  field,
  label,
  type = 'text',
  autoComplete,
  hint,
  input,
  children,
}: FormFieldProps) {
  const name = String(field.name);
  const id = fieldDomId(field.form.formId, name);
  const hintId = `${id}-dica`;
  const errorId = `${id}-erro`;
  const errors = visibleFieldErrors(field);
  const invalid = errors.length > 0;
  const describedBy = [hint ? hintId : '', invalid ? errorId : ''].filter(Boolean).join(' ');
  const inputProps: FieldInputProps = {
    id,
    name,
    autoComplete,
    value: String(field.state.value ?? ''),
    onValueChange: (value) => {
      field.handleChange(value);
    },
    onBlur: field.handleBlur,
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy || undefined,
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {input ? input(inputProps) : <TextInput type={type} {...inputProps} />}
      {invalid && (
        <p id={errorId} className="text-sm text-danger">
          {errors.join(' ')}
        </p>
      )}
      {children}
    </div>
  );
}

function TextInput({ onValueChange, type, ...props }: FieldInputProps & { type: string }) {
  return (
    <Input
      type={type}
      {...props}
      onChange={(event) => {
        onValueChange(event.target.value);
      }}
    />
  );
}
