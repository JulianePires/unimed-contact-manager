import { describe, expect, it } from 'vitest';

import { single } from './rows';

describe('single', () => {
  it('devolve a primeira linha', () => {
    expect(single([{ id: 1 }])).toEqual({ id: 1 });
  });

  it('falha quando a consulta não retorna linha', () => {
    expect(() => single([])).toThrow('Consulta não retornou linha');
  });
});
