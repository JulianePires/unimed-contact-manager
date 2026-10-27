/** Linhas válidas, com acentos que só sobrevivem se o Windows-1252 for detectado (ADR-002). */
export const VALID_ROWS = [
  ['José Conceição', 'jose.conceicao@empresa.com', '(81) 98801-0001', '(81) 3301-0001'],
  ['Sônia Ferreira', 'sonia@empresa.com', '81 98801-0002', ''],
  ['Inês Müller', 'ines@empresa.com', '+55 81 98801-0003', ''],
  ['Ângela Araújo', 'angela@empresa.com', '81988010004', ''],
] as const;

/** Linhas com erro: e-mail inválido, telefone fixo no lugar do celular e celular repetido. */
export const INVALID_ROWS = [
  ['Caio Brandão', 'caio@', '(81) 98801-0005', ''],
  ['Lúcia Prado', 'lucia@empresa.com', '(81) 3301-0006', ''],
  ['José C. (cópia)', 'jose.copia@empresa.com', '(81) 98801-0001', ''],
] as const;

/**
 * CSV como o Excel em pt-BR exporta: Windows-1252, `;` e CRLF (T-E2E03). Os caracteres usados
 * existem em Latin-1, que coincide com o Windows-1252 nessa faixa.
 */
export function excelCsv(): { name: string; mimeType: string; buffer: Buffer } {
  const lines = [['nome', 'email', 'celular', 'telefone'], ...VALID_ROWS, ...INVALID_ROWS];
  const text = `${lines.map((line) => line.join(';')).join('\r\n')}\r\n`;
  return {
    name: 'contatos-excel.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(text, 'latin1'),
  };
}
