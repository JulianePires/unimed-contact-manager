import { importErrorSchema } from '@contatos/contracts';
import { describe, expect, it } from 'vitest';

import { describeErrors, ERRORS_CSV_HEADER, toErrorsCsvLine, toImportError } from './errors-csv';

const emailError = { field: 'email', code: 'INVALID_EMAIL' as const, message: 'E-mail inválido.' };

describe('toImportError (docs/05 §5.5)', () => {
  it('dada linha com o conteúdo original, então expõe raw', () => {
    const error = toImportError({
      lineNumber: 17,
      raw: { nome: 'João', email: 'joao@', telefone: undefined },
      errors: [emailError],
    });

    expect(importErrorSchema.parse(error)).toEqual({
      lineNumber: 17,
      raw: { nome: 'João', email: 'joao@' },
      errors: [emailError],
    });
  });

  it('dada linha expurgada (RN15), então raw nulo e rawPurged', () => {
    expect(toImportError({ lineNumber: 17, raw: null, errors: [emailError] })).toEqual({
      lineNumber: 17,
      raw: null,
      rawPurged: true,
      errors: [emailError],
    });
  });
});

describe('describeErrors', () => {
  it('prefixa cada mensagem com a coluna; erros da linha inteira ficam sem prefixo', () => {
    expect(
      describeErrors([
        emailError,
        { field: '', code: 'COLUMN_COUNT_MISMATCH', message: 'A linha tem 2 colunas.' },
      ]),
    ).toBe('email: E-mail inválido. | A linha tem 2 colunas.');
  });
});

describe('CSV de erros (RF19, T-UB05)', () => {
  it('cabeçalho com BOM, colunas do modelo e motivo', () => {
    expect(ERRORS_CSV_HEADER).toBe('﻿linha;nome;email;celular;telefone;motivo\r\n');
  });

  it('neutraliza fórmulas e escapa delimitadores e aspas em todas as células', () => {
    const line = toErrorsCsvLine({
      lineNumber: 4,
      raw: { nome: '=HYPERLINK("http://x")', email: 'a;b@x', celular: '+5581', telefone: '' },
      errors: [emailError],
    });

    expect(line).toBe(`4;"'=HYPERLINK(""http://x"")";"a;b@x";'+5581;;email: E-mail inválido.\r\n`);
  });

  it('linha expurgada sai sem os dados originais, só com o motivo', () => {
    expect(toErrorsCsvLine({ lineNumber: 9, raw: null, errors: [emailError] })).toBe(
      '9;;;;;email: E-mail inválido.\r\n',
    );
  });
});
