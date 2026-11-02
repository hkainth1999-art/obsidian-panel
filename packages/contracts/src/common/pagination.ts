import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().max(255).optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PaginationMetaSchema = z.object({
  currentPage: z.number(),
  from: z.number().nullable(),
  lastPage: z.number(),
  perPage: z.number(),
  to: z.number().nullable(),
  total: z.number(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export function paginatedResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: z.object({
      pagination: PaginationMetaSchema,
    }),
  });
}

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    pagination: PaginationMeta;
  };
};
