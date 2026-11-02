import { z } from 'zod';

export const UserSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  isAdmin: z.boolean(),
  language: z.string().default('en'),
  totpEnabled: z.boolean(),
  emailVerifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

/** Public-facing user info (no sensitive fields) */
export const UserPublicSchema = UserSchema.omit({
  totpEnabled: true,
  emailVerifiedAt: true,
});

export type UserPublic = z.infer<typeof UserPublicSchema>;

export const AdminCreateUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email().max(255),
  password: z.string().min(12).max(256),
  isAdmin: z.boolean().default(false),
  language: z.string().max(5).default('en'),
});

export type AdminCreateUserInput = z.infer<typeof AdminCreateUserSchema>;

export const AdminUpdateUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(12).max(256).optional(),
  isAdmin: z.boolean().optional(),
  language: z.string().max(5).optional(),
});

export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;

export const UpdateProfileSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  email: z.string().email().max(255).optional(),
  language: z.string().max(5).optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
