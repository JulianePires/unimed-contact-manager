import { z } from 'zod';

export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const pageMetaSchema = z.object({
  page: z.int().min(1),
  pageSize: z.int().min(1).max(PAGE_SIZE_MAX),
  total: z.int().min(0),
  totalPages: z.int().min(0),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

/** Envelope de lista: `{ data, meta }` (docs/05 §5.1). */
export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), meta: pageMetaSchema });
}

export function pageMeta({ page, pageSize }: PaginationQuery, total: number): PageMeta {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
