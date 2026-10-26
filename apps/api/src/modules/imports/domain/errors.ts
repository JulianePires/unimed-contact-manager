import { AppError } from '@/shared/errors';

/** Mesmo conteúdo já importado (RN13): a UI oferece ver a anterior ou reenviar com `force=true`. */
export function importAlreadyExists(previous: { id: string; createdAt: Date }): AppError {
  return new AppError(409, 'IMPORT_ALREADY_EXISTS', 'Este arquivo já foi importado', {
    importId: previous.id,
    importedAt: previous.createdAt.toISOString(),
  });
}

/** Inexistente ou de outro usuário: sempre 404 (RN06). */
export function importNotFound(): AppError {
  return new AppError(404, 'NOT_FOUND', 'Importação não encontrada');
}

export function unsupportedFile(): AppError {
  return new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Envie um arquivo CSV');
}

/** Multipart sem o arquivo no campo `file`. */
export function missingFile(): AppError {
  return new AppError(422, 'VALIDATION_ERROR', 'Dados inválidos', {
    errors: [{ field: 'file', code: 'REQUIRED', message: 'Selecione um arquivo CSV.' }],
  });
}

/** Corpo multipart truncado ou malformado (envio interrompido, cliente com defeito). */
export function malformedUpload(): AppError {
  return new AppError(400, 'BAD_REQUEST', 'Envio do arquivo incompleto ou inválido');
}
