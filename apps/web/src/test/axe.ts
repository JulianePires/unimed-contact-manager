import axe from 'axe-core';
import { expect } from 'vitest';

/** Falha com a lista de violações do axe (docs/09, T-UF11). */
export async function expectNoAxeViolations(container: Element) {
  const { violations } = await axe.run(container);
  expect(violations.map(({ id, help }) => `${id}: ${help}`)).toEqual([]);
}
