import { z } from 'zod';

export const EggVariableSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  envVariable: z.string(),
  defaultValue: z.string(),
  userViewable: z.boolean(),
  userEditable: z.boolean(),
  rules: z.string(), // Laravel-style validation rules
  sortOrder: z.number().int().optional(),
});

export type EggVariable = z.infer<typeof EggVariableSchema>;

export const EggSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string().uuid(),
  nestId: z.number().int().positive(),
  name: z.string(),
  description: z.string(),
  author: z.string(),
  dockerImages: z.record(z.string()), // name → image
  startup: z.string(),
  stopCommand: z.string().nullable(),
  configStartup: z.object({
    done: z.array(z.string()),
    userInteraction: z.array(z.string()),
    stripAnsi: z.boolean(),
  }).nullable(),
  configStop: z.object({
    type: z.enum(['command', 'signal', 'stop']),
    value: z.string(),
  }).nullable(),
  configFiles: z.string().nullable(), // JSON string of file configs
  configLogs: z.string().nullable(),
  scriptContainer: z.string(),
  scriptEntry: z.string(),
  scriptInstall: z.string().nullable(),
  fileDenylist: z.array(z.string()),
  forceOutgoingIp: z.boolean(),
  variables: z.array(EggVariableSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Egg = z.infer<typeof EggSchema>;

export const NestSchema = z.object({
  id: z.number().int().positive(),
  uuid: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  author: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Nest = z.infer<typeof NestSchema>;

export const CreateNestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).default(''),
});

export type CreateNestInput = z.infer<typeof CreateNestSchema>;

/** Egg import JSON schema (from Pterodactyl egg export format) */
export const EggImportSchema = z.object({
  _comment: z.string().optional(),
  meta: z.object({
    version: z.string(),
    update_url: z.string().nullable().optional(),
  }).optional(),
  exported_at: z.string().optional(),
  name: z.string().min(1),
  author: z.string().min(1),
  description: z.string().default(''),
  features: z.array(z.string()).nullable().optional(),
  docker_images: z.record(z.string()),
  file_denylist: z.array(z.string()).default([]),
  startup: z.string(),
  config: z.object({
    files: z.string(),
    startup: z.string(),
    stop: z.string(),
    logs: z.string(),
  }),
  scripts: z.object({
    installation: z.object({
      script: z.string(),
      container: z.string(),
      entrypoint: z.string(),
    }),
  }),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string().default(''),
    env_variable: z.string(),
    default_value: z.string(),
    user_viewable: z.boolean(),
    user_editable: z.boolean(),
    rules: z.string(),
    field_type: z.string().optional(),
    sort: z.number().optional(),
  })),
});

export type EggImport = z.infer<typeof EggImportSchema>;
