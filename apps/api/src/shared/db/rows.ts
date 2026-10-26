/** Única linha de uma consulta que sempre retorna uma (`INSERT … RETURNING`, `count(*)`). */
export function single<T>(rows: readonly T[]): T {
  const [row] = rows;
  if (row === undefined) throw new Error('Consulta não retornou linha');
  return row;
}
