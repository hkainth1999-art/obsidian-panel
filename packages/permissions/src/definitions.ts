/**
 * Permission definitions for server-scoped access control.
 *
 * These are used in:
 * - Subuser permission assignment
 * - Wings WebSocket JWT claims
 * - API authorization checks
 * - UI visibility gates (not a security boundary — backend always checks)
 */

export enum Permission {
  // ─── WebSocket ─────────────────────────────────────────────────────
  WEBSOCKET_CONNECT = 'websocket.connect',

  // ─── Control ───────────────────────────────────────────────────────
  CONTROL_CONSOLE = 'control.console',
  CONTROL_START = 'control.start',
  CONTROL_STOP = 'control.stop',
  CONTROL_RESTART = 'control.restart',

  // ─── User (subuser management) ─────────────────────────────────────
  USER_CREATE = 'user.create',
  USER_READ = 'user.read',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',

  // ─── File ──────────────────────────────────────────────────────────
  FILE_READ = 'file.read',
  FILE_READ_CONTENT = 'file.read-content',
  FILE_CREATE = 'file.create',
  FILE_UPDATE = 'file.update',
  FILE_DELETE = 'file.delete',
  FILE_ARCHIVE = 'file.archive',
  FILE_SFTP = 'file.sftp',

  // ─── Backup ────────────────────────────────────────────────────────
  BACKUP_CREATE = 'backup.create',
  BACKUP_READ = 'backup.read',
  BACKUP_DELETE = 'backup.delete',
  BACKUP_DOWNLOAD = 'backup.download',
  BACKUP_RESTORE = 'backup.restore',

  // ─── Allocation ────────────────────────────────────────────────────
  ALLOCATION_READ = 'allocation.read',
  ALLOCATION_CREATE = 'allocation.create',
  ALLOCATION_UPDATE = 'allocation.update',
  ALLOCATION_DELETE = 'allocation.delete',

  // ─── Startup ───────────────────────────────────────────────────────
  STARTUP_READ = 'startup.read',
  STARTUP_UPDATE = 'startup.update',
  STARTUP_DOCKER_IMAGE = 'startup.docker-image',

  // ─── Database ──────────────────────────────────────────────────────
  DATABASE_CREATE = 'database.create',
  DATABASE_READ = 'database.read',
  DATABASE_UPDATE = 'database.update',
  DATABASE_DELETE = 'database.delete',
  DATABASE_VIEW_PASSWORD = 'database.view_password',

  // ─── Schedule ──────────────────────────────────────────────────────
  SCHEDULE_CREATE = 'schedule.create',
  SCHEDULE_READ = 'schedule.read',
  SCHEDULE_UPDATE = 'schedule.update',
  SCHEDULE_DELETE = 'schedule.delete',

  // ─── Settings ──────────────────────────────────────────────────────
  SETTINGS_RENAME = 'settings.rename',
  SETTINGS_REINSTALL = 'settings.reinstall',

  // ─── Activity ──────────────────────────────────────────────────────
  ACTIVITY_READ = 'activity.read',

  // ─── Plugins/Mods ──────────────────────────────────────────────────
  PLUGIN_READ = 'plugin.read',
  PLUGIN_INSTALL = 'plugin.install',
  PLUGIN_UPDATE = 'plugin.update',
  PLUGIN_DELETE = 'plugin.delete',
}

/** All permission values */
export const PERMISSIONS = Object.values(Permission);

/** Grouped permissions for UI display */
export const PERMISSION_GROUPS = {
  'Console & Power': [
    Permission.WEBSOCKET_CONNECT,
    Permission.CONTROL_CONSOLE,
    Permission.CONTROL_START,
    Permission.CONTROL_STOP,
    Permission.CONTROL_RESTART,
  ],
  'Subusers': [
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
  ],
  'Files': [
    Permission.FILE_READ,
    Permission.FILE_READ_CONTENT,
    Permission.FILE_CREATE,
    Permission.FILE_UPDATE,
    Permission.FILE_DELETE,
    Permission.FILE_ARCHIVE,
    Permission.FILE_SFTP,
  ],
  'Backups': [
    Permission.BACKUP_CREATE,
    Permission.BACKUP_READ,
    Permission.BACKUP_DELETE,
    Permission.BACKUP_DOWNLOAD,
    Permission.BACKUP_RESTORE,
  ],
  'Allocations': [
    Permission.ALLOCATION_READ,
    Permission.ALLOCATION_CREATE,
    Permission.ALLOCATION_UPDATE,
    Permission.ALLOCATION_DELETE,
  ],
  'Startup': [
    Permission.STARTUP_READ,
    Permission.STARTUP_UPDATE,
    Permission.STARTUP_DOCKER_IMAGE,
  ],
  'Databases': [
    Permission.DATABASE_CREATE,
    Permission.DATABASE_READ,
    Permission.DATABASE_UPDATE,
    Permission.DATABASE_DELETE,
    Permission.DATABASE_VIEW_PASSWORD,
  ],
  'Schedules': [
    Permission.SCHEDULE_CREATE,
    Permission.SCHEDULE_READ,
    Permission.SCHEDULE_UPDATE,
    Permission.SCHEDULE_DELETE,
  ],
  'Settings': [
    Permission.SETTINGS_RENAME,
    Permission.SETTINGS_REINSTALL,
  ],
  'Activity': [
    Permission.ACTIVITY_READ,
  ],
  'Plugins & Mods': [
    Permission.PLUGIN_READ,
    Permission.PLUGIN_INSTALL,
    Permission.PLUGIN_UPDATE,
    Permission.PLUGIN_DELETE,
  ],
} as const;
