import iconv from 'iconv-lite';
import { describe, expect, it } from 'vitest';

import { decodeCsv, detectDelimiter, normalizeHeaderCell, validateHeader } from './csv-sniffer';

const utf8 = (text: string) => new TextEncoder().encode(text);

describe('decodeCsv (T-UB04, ADR-002)', () => {
  it('dado UTF-8 com acentos, então decodifica como UTF-8', () => {
    expect(decodeCsv(utf8('nome\nJoão Conceição\n'))).toEqual({
      text: 'nome\nJoão Conceição\n',
      encoding: 'utf-8',
    });
  });

  it('dado UTF-8 com BOM, então descarta o BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('nome;email')]);

    expect(decodeCsv(bytes)).toEqual({ text: 'nome;email', encoding: 'utf-8' });
  });

  it('dado Windows-1252 (Excel pt-BR), então cai no Windows-1252 com os acentos certos', () => {
    const bytes = iconv.encode('NOME;CELULAR\nJosé Conceição;€\n', 'win1252');

    expect(decodeCsv(bytes)).toEqual({
      text: 'NOME;CELULAR\nJosé Conceição;€\n',
      encoding: 'windows-1252',
    });
  });

  it('dado ASCII puro, então é UTF-8 válido', () => {
    expect(decodeCsv(utf8('a,b')).encoding).toBe('utf-8');
  });
});

describe('detectDelimiter (T-UB04)', () => {
  it.each([
    ['nome;email;celular\nA;b,c;d', ';'],
    ['nome,email,celular\nA;B,C', ','],
    ['"Nome; completo",email,celular', ','],
    ['\n\nnome;email;celular', ';'],
    ['nome\r\n;;;;', ','],
    ['nome', ','],
  ])('%j → %s', (text, delimiter) => {
    expect(detectDelimiter(text)).toBe(delimiter);
  });
});

describe('normalizeHeaderCell', () => {
  it.each([
    [' E-MAIL ', 'e-mail'],
    ['Célular', 'celular'],
    ['TELEFONE', 'telefone'],
  ])('%j → %j', (cell, normalized) => {
    expect(normalizeHeaderCell(cell)).toBe(normalized);
  });
});

describe('validateHeader (RN10)', () => {
  it('dado cabeçalho em ordem livre, com variações de caixa e acento, então mapeia as colunas', () => {
    expect(validateHeader(['CELULAR', 'Nome', 'E-mail', 'Telefone'])).toEqual({
      ok: true,
      columns: { mobile: 0, name: 1, email: 2, phone: 3 },
      columnCount: 4,
    });
  });

  it('dado cabeçalho sem telefone e com coluna extra, então aceita e ignora a extra', () => {
    expect(validateHeader(['nome', 'observação', 'email', 'celular'])).toEqual({
      ok: true,
      columns: { name: 0, email: 2, mobile: 3 },
      columnCount: 4,
    });
  });

  it('dadas colunas obrigatórias ausentes, então falha listando-as', () => {
    expect(validateHeader(['nome', 'telefone'])).toEqual({
      ok: false,
      reason: 'Cabeçalho sem as colunas obrigatórias: email, celular.',
    });
  });

  it('dada coluna repetida, então falha', () => {
    expect(validateHeader(['nome', 'email', 'e-mail', 'celular'])).toEqual({
      ok: false,
      reason: 'Coluna "email" repetida no cabeçalho.',
    });
  });
});
