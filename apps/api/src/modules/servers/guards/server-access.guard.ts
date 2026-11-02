import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { hasPermission, Permission } from '@obsidian/permissions';

export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);

@Injectable()
export class ServerAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const serverUuid = request.params.uuid || request.params.serverUuid;
    if (!serverUuid) {
      return true;
    }

    const server = await this.prisma.server.findUnique({
      where: { uuid: serverUuid },
      include: {
        node: true,
        allocation: true,
        allocations: true,
        egg: true,
        owner: { select: { id: true, uuid: true, username: true, email: true } },
        subusers: {
          where: { userId: user.id },
          include: {
            user: { select: { id: true, uuid: true, username: true, email: true } },
          },
        },
      },
    });

    if (!server) {
      throw new NotFoundException(`Server with UUID ${serverUuid} not found`);
    }

    // Attach server to request for controller handlers (avoid overwriting Fastify request.server)
    request.gameServer = server;

    // Admin has superuser access
    if (user.isAdmin) {
      request.serverPermissions = ['*'];
      return true;
    }

    // Owner has full access
    if (server.userId === user.id) {
      request.serverPermissions = ['*'];
      return true;
    }

    // Subuser check
    const subuser = server.subusers[0];
    if (!subuser) {
      throw new ForbiddenException('You do not have access to this server');
    }

    request.serverPermissions = subuser.permissions;

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const hasAll = requiredPermissions.every((perm) =>
      hasPermission(
        {
          permissions: subuser.permissions,
          isAdmin: false,
          isOwner: false,
        },
        perm,
      ),
    );

    if (!hasAll) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
