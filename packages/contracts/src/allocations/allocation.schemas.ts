import { z } from 'zod';

export const AllocationSchema = z.object({
  id: z.number().int().positive(),
  ip: z.string(),
  alias: z.string().nullable(),
  port: z.number().int().min(1).max(65535),
  notes: z.string().nullable(),
  isAssigned: z.boolean(),
  serverId: z.number().int().positive().nullable(),
  nodeId: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Allocation = z.infer<typeof AllocationSchema>;

export const CreateAllocationSchema = z.object({
  ip: z.string().min(1).max(45), // IPv4 or IPv6
  alias: z.string().max(255).nullable().default(null),
  ports: z.array(z.string()).min(1), // Can be "25565" or "25565-25570"
});

export type CreateAllocationInput = z.infer<typeof CreateAllocationSchema>;

export const BulkCreateAllocationSchema = z.object({
  nodeId: z.number().int().positive(),
  allocations: z.array(CreateAllocationSchema).min(1),
});

export type BulkCreateAllocationInput = z.infer<typeof BulkCreateAllocationSchema>;

export const UpdateAllocationSchema = z.object({
  alias: z.string().max(255).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export type UpdateAllocationInput = z.infer<typeof UpdateAllocationSchema>;

/** Parse port ranges like "25565-25570" into individual ports */
export function parsePortRange(input: string): number[] {
  const rangeMatch = input.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]!, 10);
    const end = parseInt(rangeMatch[2]!, 10);
    if (start > end || end > 65535 || start < 1) return [];
    if (end - start > 1000) return []; // Safety limit
    const ports: number[] = [];
    for (let p = start; p <= end; p++) {
      ports.push(p);
    }
    return ports;
  }
  const port = parseInt(input, 10);
  if (isNaN(port) || port < 1 || port > 65535) return [];
  return [port];
}
