import { z } from 'zod';

export const LocationSchema = z.object({
  id: z.number().int().positive(),
  short: z.string(),
  long: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Location = z.infer<typeof LocationSchema>;

export const CreateLocationSchema = z.object({
  short: z.string().min(1).max(60).regex(/^[a-zA-Z0-9._-]+$/),
  long: z.string().min(1).max(255),
});

export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;

export const UpdateLocationSchema = CreateLocationSchema.partial();
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;
