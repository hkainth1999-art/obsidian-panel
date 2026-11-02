/**
 * Official Pterodactyl Wings v1.11.13 HTTP Client
 *
 * Implements the outbound control-plane API calls made by the Panel
 * to the unmodified Wings daemon running on a node.
 *
 * All requests are authenticated using Bearer authentication with the node's daemon token.
 */

import { request } from 'undici';
import type { WingsServerConfiguration } from '@obsidian/contracts';

export interface WingsClientConfig {
  /** Scheme (http or https) */
  scheme: 'http' | 'https';
  /** Node FQDN or IP */
  fqdn: string;
  /** Daemon listen port (default 8080) */
  daemonListen: number;
  /** Daemon bearer token */
  daemonToken: string;
  /** Request timeout in ms */
  timeout?: number;
}

export interface WingsSystemInfo {
  architecture: string;
  cpu_count: number;
  kernel_version: string;
  os: string;
  version: string;
}

export interface WingsFileObject {
  name: string;
  created: string;
  modified: string;
  mode: string;
  mode_bits: string;
  size: number;
  directory: boolean;
  file: boolean;
  symlink: boolean;
  mime: string;
}

export class WingsError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'WingsError';
  }
}

export class WingsClient {
  private readonly baseUrl: string;
  private readonly daemonToken: string;
  private readonly timeout: number;

  constructor(config: WingsClientConfig) {
    this.baseUrl = `${config.scheme}://${config.fqdn}:${config.daemonListen}`;
    this.daemonToken = config.daemonToken;
    this.timeout = config.timeout ?? 15000;
  }

  private async executeRequest<T = any>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.daemonToken}`,
      Accept: 'application/json',
      'User-Agent': 'Obsidian-Panel/0.1.0',
      ...headers,
    };

    let serializedBody: string | Buffer | Uint8Array | undefined;
    if (body !== undefined) {
      if (typeof body === 'string' || Buffer.isBuffer(body) || body instanceof Uint8Array) {
        serializedBody = body;
      } else {
        serializedBody = JSON.stringify(body);
        reqHeaders['Content-Type'] = 'application/json';
      }
    }

    try {
      const response = await request(url, {
        method,
        headers: reqHeaders,
        body: serializedBody,
        headersTimeout: this.timeout,
        bodyTimeout: this.timeout,
      });

      const responseText = await response.body.text();

      if (response.statusCode < 200 || response.statusCode >= 300) {
        let parsedError: unknown;
        try {
          parsedError = JSON.parse(responseText);
        } catch {
          parsedError = responseText;
        }
        throw new WingsError(
          `Wings daemon request failed: ${method} ${path} -> [${response.statusCode}] ${responseText.slice(0, 300)}`,
          response.statusCode,
          parsedError,
        );
      }

      if (!responseText || responseText.length === 0) {
        return undefined as T;
      }

      try {
        return JSON.parse(responseText) as T;
      } catch {
        return responseText as unknown as T;
      }
    } catch (err: any) {
      if (err instanceof WingsError) {
        throw err;
      }
      throw new WingsError(
        `Failed to reach Wings daemon at ${this.baseUrl}: ${err.message}`,
        undefined,
        err,
      );
    }
  }

  // ─── System / Health ───────────────────────────────────────────────

  /**
   * Check Wings health and retrieve system details.
   */
  async getSystemInfo(): Promise<WingsSystemInfo> {
    return this.executeRequest<WingsSystemInfo>('/api/system');
  }

  /**
   * List all server UUIDs currently registered on Wings.
   */
  async listServers(): Promise<string[]> {
    return this.executeRequest<string[]>('/api/servers');
  }

  /**
   * Get server state/details directly from Wings daemon.
   */
  async getServerStatus(serverUuid: string): Promise<{ status: string }> {
    return this.executeRequest<{ status: string }>(`/api/servers/${serverUuid}`);
  }

  // ─── Server Lifecycle ──────────────────────────────────────────────

  async createServer(payload: { uuid: string; start_on_completion?: boolean } | WingsServerConfiguration | any): Promise<void> {
    const rawUuid = payload?.uuid || payload?.settings?.uuid || '';
    const uuid = String(rawUuid).trim().toLowerCase();
    const start_on_completion = Boolean(payload?.start_on_completion);

    if (!uuid) {
      throw new WingsError('Cannot create server on Wings: server UUID is missing or empty');
    }

    const body = {
      uuid,
      start_on_completion,
    };
    await this.executeRequest('/api/servers', 'POST', body);
  }

  /**
   * Delete a server container and associated game files from Wings.
   */
  async deleteServer(serverUuid: string): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}`, 'DELETE');
  }

  /**
   * Sync server configuration changes (build limits, allocations, variables).
   */
  async syncServer(serverUuid: string): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/sync`, 'POST');
  }

  /**
   * Trigger server reinstallation.
   */
  async reinstallServer(serverUuid: string): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/reinstall`, 'POST');
  }

  /**
   * Send power action: start, stop, restart, or kill.
   */
  async sendPowerAction(
    serverUuid: string,
    action: 'start' | 'stop' | 'restart' | 'kill',
  ): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/power`, 'POST', {
      action,
    });
  }

  /**
   * Send console commands to a running server.
   */
  async sendCommands(serverUuid: string, commands: string[]): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/commands`, 'POST', {
      commands,
    });
  }

  // ─── File Operations ───────────────────────────────────────────────

  /**
   * List directory contents inside server container.
   */
  async listFiles(
    serverUuid: string,
    directory: string = '/',
  ): Promise<WingsFileObject[]> {
    const encodedDir = encodeURIComponent(directory);
    return this.executeRequest<WingsFileObject[]>(
      `/api/servers/${serverUuid}/files/list-directory?directory=${encodedDir}`,
    );
  }

  /**
   * Get raw contents of a text file inside server container.
   */
  async getFileContents(
    serverUuid: string,
    filePath: string,
  ): Promise<string> {
    const encodedFile = encodeURIComponent(filePath);
    return this.executeRequest<string>(
      `/api/servers/${serverUuid}/files/contents?file=${encodedFile}`,
      'GET',
      undefined,
      { Accept: 'text/plain' },
    );
  }

  /**
   * Write content to a file inside server container.
   */
  async writeFile(
    serverUuid: string,
    filePath: string,
    content: string | Buffer | Uint8Array,
  ): Promise<void> {
    const encodedFile = encodeURIComponent(filePath);
    await this.executeRequest(
      `/api/servers/${serverUuid}/files/write?file=${encodedFile}`,
      'POST',
      content,
      { 'Content-Type': 'application/octet-stream' },
    );
  }

  /**
   * Pull/download a remote file into the server filesystem via Wings daemon.
   */
  async pullFile(
    serverUuid: string,
    url: string,
    directory: string = '/',
    fileName?: string,
    foreground: boolean = true,
  ): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/files/pull`, 'POST', {
      root: directory,
      url,
      file_name: fileName,
      foreground,
    });
  }

  /**
   * Create a directory inside the server filesystem.
   */
  async createFolder(
    serverUuid: string,
    root: string = '/',
    name: string,
  ): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/files/create-directory`, 'POST', {
      root,
      name,
    });
  }

  /**
   * Rename or move files.
   */
  async renameFiles(
    serverUuid: string,
    root: string,
    files: Array<{ from: string; to: string }>,
  ): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/files/rename`, 'PUT', {
      root,
      files,
    });
  }

  /**
   * Copy file.
   */
  async copyFile(serverUuid: string, location: string): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/files/copy`, 'POST', {
      location,
    });
  }

  /**
   * Delete files or directories.
   */
  async deleteFiles(
    serverUuid: string,
    root: string,
    files: string[],
  ): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/files/delete`, 'POST', {
      root,
      files,
    });
  }

  /**
   * Compress files into archive.
   */
  async compressFiles(
    serverUuid: string,
    root: string,
    files: string[],
  ): Promise<WingsFileObject> {
    return this.executeRequest<WingsFileObject>(
      `/api/servers/${serverUuid}/files/compress`,
      'POST',
      { root, files },
    );
  }

  /**
   * Decompress archive.
   */
  async decompressFile(
    serverUuid: string,
    root: string,
    file: string,
  ): Promise<void> {
    await this.executeRequest(
      `/api/servers/${serverUuid}/files/decompress`,
      'POST',
      { root, file },
    );
  }

  /**
   * Change file permissions (chmod).
   */
  async chmodFiles(
    serverUuid: string,
    root: string,
    files: Array<{ file: string; mode: string }>,
  ): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/files/chmod`, 'POST', {
      root,
      files,
    });
  }

  // ─── Backup Operations ─────────────────────────────────────────────

  /**
   * Instruct Wings to create a server backup.
   */
  async createBackup(
    serverUuid: string,
    backupUuid: string,
    adapter: 'wings' | 's3' = 'wings',
    ignored?: string,
  ): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/backup`, 'POST', {
      adapter,
      uuid: backupUuid,
      ignore: ignored ?? '',
    });
  }

  /**
   * Instruct Wings to restore a server backup.
   */
  async restoreBackup(
    serverUuid: string,
    backupUuid: string,
    payload: {
      adapter: 'wings' | 's3';
      truncate_directory: boolean;
      download_url?: string;
    },
  ): Promise<void> {
    await this.executeRequest(
      `/api/servers/${serverUuid}/backup/${backupUuid}/restore`,
      'POST',
      payload,
    );
  }

  /**
   * Delete a backup on Wings.
   */
  async deleteBackup(
    serverUuid: string,
    backupUuid: string,
  ): Promise<void> {
    await this.executeRequest(
      `/api/servers/${serverUuid}/backup/${backupUuid}`,
      'DELETE',
    );
  }

  // ─── Transfer Operations ───────────────────────────────────────────

  /**
   * Initiate server transfer to another node.
   */
  async initiateTransfer(
    serverUuid: string,
    payload: {
      url: string;
      token: string;
      server: WingsServerConfiguration;
    },
  ): Promise<void> {
    await this.executeRequest(`/api/servers/${serverUuid}/transfer`, 'POST', payload);
  }
}
