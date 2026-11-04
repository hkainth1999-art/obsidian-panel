import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

/**
 * Guard that authenticates requests specifically for the Pterodactyl-compatible
 * Application API (/api/application/*).
 *
 * Accepts:
 * - Header: Authorization: Bearer ptla_...
 * - Query parameter: ?api_key=ptla_...
 * - Active administrator web session cookie
 */
@Injectable()
export class ApplicationApiGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers?.['authorization'] || request.headers?.authorization;
    let token = '';

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (request.query?.api_key) {
      token = String(request.query.api_key).trim();
    } else if (request.cookies?.session) {
      token = request.cookies.session;
    }

    if (!token) {
      throw new UnauthorizedException(
        'Authorization header required. Format: Bearer ptla_<secret_key>',
      );
    }

    // 1. Validate API Key
    const apiKeyResult = await this.authService.validateApiKey(token, request.ip);
    if (apiKeyResult) {
      const isAppKey =
        apiKeyResult.apiKey.keyType === 'application' ||
        apiKeyResult.apiKey.identifier.startsWith('ptla_') ||
        Boolean(apiKeyResult.user.isAdmin);

      if (!isAppKey) {
        throw new ForbiddenException(
          'This endpoint requires an Application API key (ptla_...) with administrative privileges.',
        );
      }

      request.user = {
        ...apiKeyResult.user,
        isAdmin: true,
      };
      request.apiKey = apiKeyResult.apiKey;
      return true;
    }

    // 2. Validate web admin session
    const sessionUser = await this.authService.validateSession(token);
    if (sessionUser) {
      if (!sessionUser.isAdmin) {
        throw new ForbiddenException(
          'You must be an administrator to access the Application API.',
        );
      }
      request.user = sessionUser;
      return true;
    }

    throw new UnauthorizedException('Invalid or expired Application API credentials.');
  }
}

