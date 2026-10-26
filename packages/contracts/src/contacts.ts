import { z } from 'zod';

import { emailSchema, isoDateTimeSchema, mobileSchema, nameSchema, phoneSchema } from './fields';
import { paginationQuerySchema } from './pagination';

export const CONTACT_STATUSES = ['active', 'inactive'] as const;
export const contactStatusSchema = z.enum(CONTACT_STATUSES);
export type ContactStatus = z.infer<typeof contactStatusSchema>;

export const CONTACT_SORTS = ['name', '-name', 'createdAt', '-createdAt'] as const;
export type ContactSort = (typeof CONTACT_SORTS)[number];

export const SEARCH_TERM_MIN_LENGTH = 2;
export const SEARCH_TERM_MAX_LENGTH = 100;

export const createContactInputSchema = z.strictObject({
  name: nameSchema,
  email: emailSchema,
  mobile: mobileSchema,
  phone: phoneSchema.nullish().transform((phone) => phone ?? null),
});
export type CreateContactInput = z.input<typeof createContactInputSchema>;
export type CreateContactData = z.output<typeof createContactInputSchema>;

/** Edição parcial dos dados; status e favorito têm rotas próprias e são rejeitados aqui. */
export const updateContactInputSchema = z
  .strictObject({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    mobile: mobileSchema.optional(),
    phone: phoneSchema.nullable().optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para alterar.',
    params: { code: 'REQUIRED' },
  });
export type UpdateContactInput = z.input<typeof updateContactInputSchema>;
export type UpdateContactData = z.output<typeof updateContactInputSchema>;

export const contactSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  mobile: z.string(),
  mobileFormatted: z.string(),
  phone: z.string().nullable(),
  phoneFormatted: z.string().nullable(),
  isFavorite: z.boolean(),
  status: contactStatusSchema,
  deactivatedAt: isoDateTimeSchema.nullable(),
  version: z.int().min(1),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Contact = z.infer<typeof contactSchema>;

/** Termos com menos de 2 caracteres não disparam busca (ADR-005). */
const searchTermSchema = z
  .string()
  .trim()
  .max(SEARCH_TERM_MAX_LENGTH)
  .transform((term) => (term.length < SEARCH_TERM_MIN_LENGTH ? undefined : term));

export const listContactsQuerySchema = paginationQuerySchema.extend({
  q: searchTermSchema.optional(),
  status: z.enum([...CONTACT_STATUSES, 'all']).default('active'),
  favorite: z.stringbool().optional(),
  sort: z.enum(CONTACT_SORTS).default('name'),
});
export type ListContactsQuery = z.output<typeof listContactsQuerySchema>;
