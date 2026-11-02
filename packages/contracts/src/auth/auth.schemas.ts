import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(256),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email().max(255),
  password: z.string().min(12).max(256),
  passwordConfirmation: z.string(),
}).refine(data => data.password === data.passwordConfirmation, {
  message: 'Passwords do not match',
  path: ['passwordConfirmation'],
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const TotpSetupResponseSchema = z.object({
  secret: z.string(),
  qrCodeUrl: z.string(),
});

export type TotpSetupResponse = z.infer<typeof TotpSetupResponseSchema>;

export const TotpVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
  password: z.string().min(1),
});

export type TotpVerifyInput = z.infer<typeof TotpVerifySchema>;

export const TotpLoginSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

export type TotpLoginInput = z.infer<typeof TotpLoginSchema>;

export const RecoveryCodeLoginSchema = z.object({
  code: z.string().min(1).max(64),
});

export type RecoveryCodeLoginInput = z.infer<typeof RecoveryCodeLoginSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email().max(255),
});

export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetSchema = z.object({
  token: z.string().min(1),
  email: z.string().email().max(255),
  password: z.string().min(12).max(256),
  passwordConfirmation: z.string(),
}).refine(data => data.password === data.passwordConfirmation, {
  message: 'Passwords do not match',
  path: ['passwordConfirmation'],
});

export type PasswordResetInput = z.infer<typeof PasswordResetSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  password: z.string().min(12).max(256),
  passwordConfirmation: z.string(),
}).refine(data => data.password === data.passwordConfirmation, {
  message: 'Passwords do not match',
  path: ['passwordConfirmation'],
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  lastActive: z.string().datetime(),
  isCurrent: z.boolean(),
});

export type Session = z.infer<typeof SessionSchema>;

export const ApiKeyCreateSchema = z.object({
  description: z.string().min(1).max(255),
  allowedIps: z.array(z.string()).default([]),
});

export type ApiKeyCreateInput = z.infer<typeof ApiKeyCreateSchema>;

export const ApiKeySchema = z.object({
  id: z.string(),
  identifier: z.string(),
  description: z.string(),
  allowedIps: z.array(z.string()),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;
