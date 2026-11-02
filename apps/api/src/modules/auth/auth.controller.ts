import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Res,
  HttpCode,
  UseGuards,
  UnauthorizedException,
  Logger,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SessionGuard } from './guards/session.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityService } from '../security/security.service';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * POST /api/auth/login
   * Authenticate with email and password. Returns session cookie.
   */
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with username/email and password' })
  async login(
    @Body() body: { email?: string; username?: string; password?: string },
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const rawIp = (req.headers && req.headers['cf-connecting-ip']) ||
      (req.headers && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0]!.trim() : '') ||
      req.ip ||
      '127.0.0.1';
    // Enforce 5 login attempts per minute rate limit to stop brute-force attacks
    this.securityService.checkLoginRateLimit(rawIp);

    const identifier = body.username || body.email;
    const user = await this.authService.validateCredentials(identifier, body.password);

    if (!user) {
      // Log failed attempt
      await this.prisma.auditLog.create({
        data: {
          action: 'auth:login.fail',
          metadata: { identifier: identifier || 'unknown' },
          device: { ip: rawIp, userAgent: req.headers['user-agent'] ?? '' },
        },
      });

      throw new UnauthorizedException('Invalid username/email or password.');
    }

    // Reset login attempt counter upon successful validation
    this.securityService.resetLoginAttempts(rawIp);

    // Allow login for all users; unverified users will see the email verification banner in the panel header
    // with an interactive button to resend verification.

    // Check if TOTP is enabled — if so, return a challenge token
    if (user.totpEnabled) {
      return {
        data: {
          complete: false,
          confirmationToken: 'totp_required',
          userId: user.id,
        },
      };
    }

    // Create session
    const { token } = await this.authService.createSession(
      user.id,
      req.ip,
      req.headers['user-agent'] ?? '',
    );

    const isHttps =
      req.headers['x-forwarded-proto'] === 'https' ||
      req.protocol === 'https' ||
      process.env.COOKIE_SECURE === 'true' ||
      (process.env.APP_URL?.startsWith('https://') ?? false);

    const cookieHeader = `session=${token}; Path=/; Max-Age=${7 * 24 * 60 * 60}; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}`;

    // Set cookie through all available Fastify / Node channels
    if (typeof res.setCookie === 'function') {
      try {
        res.setCookie('session', token, {
          httpOnly: true,
          secure: isHttps,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });
      } catch {}
    }
    if (typeof res.header === 'function') {
      try {
        res.header('set-cookie', cookieHeader);
      } catch {}
    }
    if (res.raw?.setHeader) {
      try {
        res.raw.setHeader('Set-Cookie', cookieHeader);
      } catch {}
    }

    // Log successful login
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth:login.success',
        metadata: {},
        device: { ip: req.ip, userAgent: req.headers['user-agent'] ?? '' },
      },
    });

    return {
      data: {
        complete: true,
        token,
        user: {
          id: user.id,
          uuid: user.uuid,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin,
          language: user.language,
          avatarUrl: user.avatarUrl ?? null,
          totpEnabled: user.totpEnabled,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      },
    };
  }

  /**
   * POST /api/auth/logout
   * Destroy the current session.
   */
  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Logout and destroy session' })
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    if (req.session) {
      await this.prisma.session.delete({
        where: { id: req.session.id },
      }).catch(() => {});
    }

    if (typeof res.clearCookie === 'function') {
      res.clearCookie('session', { path: '/' });
    } else {
      const cookieHeader = `session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
      if (res.raw?.setHeader) {
        res.raw.setHeader('Set-Cookie', cookieHeader);
      } else if (res.header) {
        res.header('Set-Cookie', cookieHeader);
      }
    }
  }

  /**
   * GET /api/auth/me
   * Get the current authenticated user.
   */
  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get current user' })
  async me(@Req() req: any) {
    const user = req.user;
    return {
      data: {
        id: user.id,
        uuid: user.uuid,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        language: user.language,
        avatarUrl: user.avatarUrl ?? null,
        totpEnabled: user.totpEnabled,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }

  /**
   * GET /api/auth/sessions
   * List all active sessions for the current user.
   */
  @Get('sessions')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List active sessions' })
  async listSessions(@Req() req: any) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId: req.user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActive: 'desc' },
    });

    return {
      data: sessions.map(s => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastActive: s.lastActive.toISOString(),
        isCurrent: s.id === req.session?.id,
      })),
    };
  }

  /**
   * DELETE /api/auth/sessions/:id
   * Revoke a specific session.
   */
  @Delete('sessions/:id')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke a session' })
  async revokeSession(@Req() req: any, @Param('id') sessionId: string) {
    await this.authService.revokeSession(sessionId, req.user.id);
  }

  /**
   * POST /api/auth/register
   * Create a new user account with email verification.
   */
  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  async register(
    @Body() body: { email: string; username: string; password: string },
  ) {
    return this.authService.register(body.email, body.username, body.password);
  }

  /**
   * POST /api/auth/verify-email
   * Verify account using verification token.
   */
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email address' })
  async verifyEmail(@Body() body: { email: string; token: string }) {
    return this.authService.verifyEmail(body.email, body.token);
  }

  /**
   * POST /api/auth/resend-verification
   * Resend verification email.
   */
  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend email verification token' })
  async resendVerification(@Body() body: { email: string }) {
    return this.authService.resendVerification(body.email);
  }

  /**
   * POST /api/auth/forgot-password
   * Request password reset link via SMTP.
   */
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  /**
   * POST /api/auth/reset-password
   * Reset account password with token.
   */
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset account password' })
  async resetPassword(
    @Body() body: { email?: string; token: string; password?: string; newPassword?: string },
  ) {
    const password = body.password || body.newPassword || '';
    return this.authService.resetPassword(body.email || body.token, body.token, password);
  }
}
