/**
 * CSV grande e determinístico para testes de volume (T-NF02): delimitador `;`, nomes acentuados,
 * celulares únicos e válidos. A cada 100 linhas, uma inválida (e-mail sem domínio).
 */
export function generateLargeCsv(rowCount: number): string {
  const lines = ['nome;email;celular;telefone'];
  for (let n = 1; n <= rowCount; n += 1) {
    const suffix = String(n).padStart(8, '0');
    const email = n % 100 === 0 ? `contato${n}@` : `contato${n}@empresa.com`;
    lines.push(`Conceição ${n};${email};(81) 9${suffix.slice(0, 4)}-${suffix.slice(4)};`);
  }
  return `${lines.join('\n')}\n`;
}
