import { Permission } from './definitions';

export interface PermissionCheck {
  /** The permissions the user has (array of permission strings) */
  permissions: string[];
  /** Whether the user is an administrator */
  isAdmin?: boolean;
  /** Whether the user is the server owner */
  isOwner?: boolean;
}

/**
 * Check if the user has a specific permission.
 *
 * - Administrators always have all permissions.
 * - Server owners always have all permissions.
 * - The wildcard "*" grants all permissions.
 * - Otherwise, the specific permission must be in the list.
 */
export function hasPermission(
  check: PermissionCheck,
  permission: Permission,
): boolean {
  if (check.isAdmin || check.isOwner) return true;
  if (check.permissions.includes('*')) return true;
  return check.permissions.includes(permission);
}

/**
 * Check if the user has ANY of the specified permissions.
 */
export function hasAnyPermission(
  check: PermissionCheck,
  permissions: Permission[],
): boolean {
  return permissions.some(p => hasPermission(check, p));
}

/**
 * Check if the user has ALL of the specified permissions.
 */
export function hasAllPermissions(
  check: PermissionCheck,
  permissions: Permission[],
): boolean {
  return permissions.every(p => hasPermission(check, p));
}
