import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { timingSafeEqual } from 'crypto';

/**
 * Guard that authenticates Wings daemon requests using the node's Bearer token.
 *
 * Wings sends: Authorization: Bearer <token_id>.<token>
 *
 * We split on '.', look up the node by token_id, and perform a
 * constant-time comparison of the token to prevent timing attacks.
 *
 * The authenticated node is attached to the request as `req.node`.
 */
@Injectable()
export class WingsNodeAuthGuard implements CanActivate {
  private readonly logger = new Logger(WingsNodeAuthGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException(
        'The required authorization headers were not present in the request.',
      );
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException(
        'The required authorization headers were not present in the request.',
      );
    }

    const credential = parts[1]!;
    const dotIndex = credential.indexOf('.');
    if (dotIndex === -1) {
      throw new ForbiddenException('The token provided is invalid.');
    }

    const tokenId = credential.substring(0, dotIndex);
    const token = credential.substring(dotIndex + 1);

    if (!tokenId || !token) {
      throw new ForbiddenException('The token provided is invalid.');
    }

    // Look up the node by token_id
    const node = await this.prisma.node.findUnique({
      where: { daemonTokenId: tokenId },
    });

    if (!node) {
      throw new ForbiddenException('The token provided is invalid.');
    }

    // Constant-time comparison to prevent timing attacks
    // The stored token is the raw token (not hashed) because Wings needs it
    // in the config.yml file and the Panel must be able to generate it.
    const storedToken = Buffer.from(node.daemonToken, 'utf-8');
    const providedToken = Buffer.from(token, 'utf-8');

    if (storedToken.length !== providedToken.length) {
      throw new ForbiddenException('The token provided is invalid.');
    }

    if (!timingSafeEqual(storedToken, providedToken)) {
      throw new ForbiddenException('The token provided is invalid.');
    }

    // Attach the authenticated node to the request
    request.authenticatedNode = node;

    return true;
  }
}
