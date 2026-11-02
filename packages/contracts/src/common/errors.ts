import { z } from 'zod';

export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  correlationId: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ValidationErrorSchema = z.object({
  statusCode: z.literal(422),
  error: z.literal('Validation Error'),
  message: z.string(),
  details: z.record(z.array(z.string())),
  correlationId: z.string().optional(),
});

export type ValidationError = z.infer<typeof ValidationErrorSchema>;
