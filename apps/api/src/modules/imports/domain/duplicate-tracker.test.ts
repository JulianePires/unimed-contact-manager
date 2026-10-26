import { describe, expect, it } from 'vitest';

import { createDuplicateTracker } from './duplicate-tracker';

describe('createDuplicateTracker (RN12)', () => {
  it('dada a primeira ocorrência, então não acusa duplicata', () => {
    const tracker = createDuplicateTracker();

    expect(tracker.check('+5581999990000', 2)).toBeUndefined();
    expect(tracker.check('+5581999990001', 3)).toBeUndefined();
  });

  it('dada a segunda e a terceira ocorrência, então DUPLICATE_IN_FILE apontando a primeira linha', () => {
    const tracker = createDuplicateTracker();
    tracker.check('+5581999990000', 2);

    const expected = {
      field: 'celular',
      code: 'DUPLICATE_IN_FILE',
      message: 'Celular repetido no arquivo; primeira ocorrência na linha 2.',
      firstLine: 2,
    };
    expect(tracker.check('+5581999990000', 5)).toEqual(expected);
    expect(tracker.check('+5581999990000', 9)).toEqual(expected);
  });

  it('cada importação tem o próprio rastreador', () => {
    createDuplicateTracker().check('+5581999990000', 2);

    expect(createDuplicateTracker().check('+5581999990000', 2)).toBeUndefined();
  });
});
