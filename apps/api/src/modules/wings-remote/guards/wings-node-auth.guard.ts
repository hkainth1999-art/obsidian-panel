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

  constructor(private readonly prisma: PrismaService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException(
        'The required authorization headers were not present in the request.',
      );
    }

      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (!match) {
        throw new UnauthorizedException(
          'The required authorization headers were not present in the request.',
        );
      }

      const credential = (match[1] || '').trim();
      const dotIndex = credential.indexOf('.');

      let node;
      if (dotIndex !== -1) {
        const tokenId = credential.substring(0, dotIndex);
        const token = credential.substring(dotIndex + 1);

        if (tokenId && token) {
          node = await this.prisma.node.findUnique({
            where: { daemonTokenId: tokenId },
          });

          if (node) {
            const storedToken = Buffer.from(node.daemonToken, 'utf-8');
            const providedToken = Buffer.from(token, 'utf-8');

            if (storedToken.length === providedToken.length && timingSafeEqual(storedToken, providedToken)) {
              request.authenticatedNode = node;
              return true;
            }
          }
        }
      }

      // Fallback: match direct daemonToken or daemonTokenId
      node = await this.prisma.node.findFirst({
        where: {
          OR: [
            { daemonToken: credential },
            { daemonTokenId: credential },
          ],
        },
      });

      if (node) {
        request.authenticatedNode = node;
        return true;
      }

      throw new ForbiddenException('The token provided is invalid.');
    }
  }
