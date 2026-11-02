import { z } from 'zod';

/** Standard envelope for single-item API responses */
export const apiResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
  });

/** UUID v4 string validation */
export const UuidSchema = z.string().uuid();

/** Positive integer ID */
export const IdSchema = z.number().int().positive();

/** ISO 8601 datetime string */
export const DateTimeSchema = z.string().datetime();

/** Common timestamps for database records */
export const TimestampsSchema = z.object({
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});

export type Timestamps = z.infer<typeof TimestampsSchema>;
