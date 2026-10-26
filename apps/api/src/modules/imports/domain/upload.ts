/** Tipos que navegadores e sistemas enviam para `.csv` (o Excel no Windows usa `vnd.ms-excel`). */
const CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

/** Amostra suficiente para reconhecer binário: arquivos de texto não têm byte nulo. */
const SNIFF_BYTES = 8 * 1024;

export interface UploadedFile {
  fileName: string;
  mimeType: string;
  content: Uint8Array;
}

/**
 * CSV aceito (RN10, UC12 FE1): extensão `.csv`, tipo compatível e conteúdo de texto. Um binário
 * renomeado para `.csv` é recusado já no envio, em vez de virar uma importação com falha.
 */
export function isCsvUpload({ fileName, mimeType, content }: UploadedFile): boolean {
  return (
    fileName.toLowerCase().endsWith('.csv') &&
    CSV_MIME_TYPES.has(mimeType.toLowerCase()) &&
    !content.subarray(0, SNIFF_BYTES).includes(0)
  );
}
