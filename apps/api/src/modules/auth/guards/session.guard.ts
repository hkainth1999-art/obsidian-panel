import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

/**
 * Guard that authenticates requests using the session cookie.
 * Attaches the authenticated user to req.user.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Try session cookie from Fastify parsed cookies
    let sessionToken = request.cookies?.session;

    // Fastify unsignCookie support
    if (sessionToken && typeof request.unsignCookie === 'function') {
      try {
        const unsigned = request.unsignCookie(sessionToken);
        if (unsigned && unsigned.valid && unsigned.value) {
          sessionToken = unsigned.value;
        }
      } catch {}
    }

    // 2. Try raw Cookie header
    if (!sessionToken && request.headers?.cookie) {
      const match = request.headers.cookie.match(/(?:^|;\s*)session=([^;]+)/);
      if (match) sessionToken = decodeURIComponent(match[1]);
    }

    // Strip signed cookie prefix "s:" and trailing signature if present
    if (sessionToken && typeof sessionToken === 'string' && sessionToken.startsWith('s:')) {
      const withoutPrefix = sessionToken.slice(2);
      const dotIdx = withoutPrefix.indexOf('.');
      sessionToken = dotIdx !== -1 ? withoutPrefix.substring(0, dotIdx) : withoutPrefix;
    }

    // 3. Try Bearer token from Authorization header
    const authHeader = request.headers?.['authorization'] || request.headers?.authorization;
    if (!sessionToken && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7).trim();
    }

    // 4. Try X-Session-Token header
    const xSession = request.headers?.['x-session-token'] || request.headers?.['X-Session-Token'];
    if (!sessionToken && xSession) {
      sessionToken = String(xSession).trim();
    }

    // 5. Try token from query parameter (for direct browser file/backup downloads)
    const queryToken = request.query?.token;
    if (!sessionToken && typeof queryToken === 'string') {
      sessionToken = queryToken.trim();
    }

    if (sessionToken) {
      const user = await this.authService.validateSession(sessionToken);
      if (user) {
        request.user = user;
        return true;
      }

      // Check if token is an API key (ptla_... application key or ptlc_... client key)
      const apiKeyResult = await this.authService.validateApiKey(sessionToken, request.ip);
      if (apiKeyResult) {
        const isAppKey = apiKeyResult.apiKey.identifier.startsWith('ptla_');

        request.user = {
          ...apiKeyResult.user,
          isAdmin: isAppKey ? true : Boolean(apiKeyResult.user.isAdmin),
        };
        request.apiKey = apiKeyResult.apiKey;
        return true;
      }
    }

    throw new UnauthorizedException('Authentication required.');
  }
}
