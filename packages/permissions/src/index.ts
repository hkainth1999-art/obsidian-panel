/**
 * @obsidian/permissions
 *
 * Server-scoped permission system compatible with Pterodactyl Wings WebSocket JWT claims.
 * Browser-safe — used by both frontend (route guards, UI state) and backend (authorization).
 *
 * Permissions are deny-by-default. The wildcard "*" grants all permissions.
 * Admin role is a separate check, not a permission.
 */

export { Permission, PERMISSIONS, PERMISSION_GROUPS } from './definitions';
export { hasPermission, hasAnyPermission, hasAllPermissions } from './checks';
export type { PermissionCheck } from './checks';
