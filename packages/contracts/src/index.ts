/**
 * @obsidian/contracts
 *
 * Shared, browser-safe Zod schemas and TypeScript types for the Obsidian Panel.
 * This package contains NO server secrets, database models, or Node.js-only code.
 *
 * All validation schemas defined here are the authoritative contract between
 * frontend, backend, and external API consumers.
 */

// ─── Common ──────────────────────────────────────────────────────────
export * from './common/pagination';
export * from './common/errors';
export * from './common/api';

// ─── Auth ────────────────────────────────────────────────────────────
export * from './auth/auth.schemas';

// ─── Users ───────────────────────────────────────────────────────────
export * from './users/user.schemas';

// ─── Servers ─────────────────────────────────────────────────────────
export * from './servers/server.schemas';

// ─── Nodes ───────────────────────────────────────────────────────────
export * from './nodes/node.schemas';

// ─── Locations ───────────────────────────────────────────────────────
export * from './locations/location.schemas';

// ─── Allocations ─────────────────────────────────────────────────────
export * from './allocations/allocation.schemas';

// ─── Eggs ────────────────────────────────────────────────────────────
export * from './eggs/egg.schemas';

// ─── Wings Protocol ──────────────────────────────────────────────────
export * from './wings/wings.schemas';
