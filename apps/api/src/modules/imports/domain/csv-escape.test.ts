import { describe, expect, it } from 'vitest';

import { escapeCsvCell, formatCsvLine } from './csv-escape';

describe('escapeCsvCell (T-UB05, ADR-009 §5)', () => {
  it.each([
    ['=HYPERLINK("http://x")', `"'=HYPERLINK(""http://x"")"`],
    ['+5581999990000', "'+5581999990000"],
    ['-1+1', "'-1+1"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tcmd', "'\tcmd"],
    ['\rcmd', `"'\rcmd"`],
  ])('neutraliza %j como %j', (value, escaped) => {
    expect(escapeCsvCell(value)).toBe(escaped);
  });

  it.each([
    ['Maria Silva', 'Maria Silva'],
    ['Souza, João', '"Souza, João"'],
    ['A;B', '"A;B"'],
    ['diz "oi"', '"diz ""oi"""'],
    ['linha 1\nlinha 2', '"linha 1\nlinha 2"'],
    ['', ''],
    ['a=b', 'a=b'],
  ])('%j → %j', (value, escaped) => {
    expect(escapeCsvCell(value)).toBe(escaped);
  });
});

describe('formatCsvLine', () => {
  it('escapa cada célula e junta pelo delimitador', () => {
    expect(formatCsvLine(['17', '=1+1', 'joao@', 'E-mail; inválido'], ';')).toBe(
      `17;'=1+1;joao@;"E-mail; inválido"`,
    );
  });
});
