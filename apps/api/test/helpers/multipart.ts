import { randomUUID } from 'node:crypto';

export interface FilePart {
  field?: string;
  fileName: string;
  contentType?: string;
  content: string | Uint8Array;
}

/** Corpo `multipart/form-data` com um arquivo, como o navegador envia no upload. */
export function multipartFile({
  field = 'file',
  fileName,
  contentType = 'text/csv',
  content,
}: FilePart): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `----contatos${randomUUID()}`;
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${fileName}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    ),
    typeof content === 'string' ? Buffer.from(content) : Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
