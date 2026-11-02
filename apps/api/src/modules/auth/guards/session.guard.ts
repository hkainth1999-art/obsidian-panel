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

    // 2. Try raw Cookie header
    if (!sessionToken && request.headers?.cookie) {
      const match = request.headers.cookie.match(/(?:^|;\s*)session=([^;]+)/);
      if (match) sessionToken = decodeURIComponent(match[1]);
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

    if (sessionToken) {
      const user = await this.authService.validateSession(sessionToken);
      if (user) {
        request.user = user;
        return true;
      }
    }

    throw new UnauthorizedException('Authentication required.');
  }
}
