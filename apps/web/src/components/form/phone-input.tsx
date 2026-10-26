import { formatPhoneInput, phoneInputDigits } from '@contatos/contracts';
import type { Ref } from 'react';

import { Input } from '@/components/ui/input';

import type { FieldInputProps } from './form-field';

/**
 * Telefone com máscara só de exibição (`(81) 99999-0000`): o valor do formulário continua sendo
 * o que a pessoa digitou, em dígitos, e a API normaliza para E.164 (ADR-001).
 */
export function PhoneInput({
  value,
  onValueChange,
  ref,
  ...props
}: FieldInputProps & { ref?: Ref<HTMLInputElement> }) {
  const display = formatPhoneInput(value);

  return (
    <Input
      ref={ref}
      type="tel"
      inputMode="tel"
      {...props}
      value={display}
      onChange={(event) => {
        const typed = event.target.value;
        const raw = phoneInputDigits(typed);
        // Apagar um caractere da máscara ("-", ")", espaço) também apaga o dígito anterior
        const removedMaskOnly = raw === value && typed.length < display.length;
        onValueChange(removedMaskOnly ? raw.slice(0, -1) : raw);
      }}
    />
  );
}
