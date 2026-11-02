import { Injectable, Logger, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { hash, verify } from 'argon2';
import { randomBytes, createHash } from 'crypto';
import * as jsonwebtoken from 'jsonwebtoken';
import type { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Hash a password using Argon2id with recommended parameters.
   */
  async hashPassword(password: string): Promise<string> {
    return hash(password, {
      type: 2, // argon2id
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verify a password against an Argon2id hash.
   */
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Authenticate a user by username or email and password.
   * Returns the user if credentials are valid, null otherwise.
   */
  async validateCredentials(identifier?: string, password?: string): Promise<User | null> {
    if (!identifier || !password) return null;

    const trimmed = identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: trimmed.toLowerCase() },
          { username: trimmed },
        ],
      },
    });

    if (!user) return null;

    const valid = await this.verifyPassword(user.password, password);
    if (!valid) return null;

    return user;
  }

  /**
   * Create a new session for a user.
   * Returns the raw session token (stored as SHA-256 hash in DB).
   */
  async createSession(
    userId: number,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ sessionId: string; token: string }> {
    const token = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        ipAddress,
        userAgent: userAgent.substring(0, 500),
        expiresAt,
      },
    });

    return { sessionId: session.id, token };
  }

  /**
   * Validate a session token and return the associated user.
   */
  async validateSession(token: string): Promise<User | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) return null;

    // Check expiration
    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      return null;
    }

    // Update last active
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActive: new Date() },
    });

    return session.user;
  }

  /**
   * Revoke a session.
   */
  async revokeSession(sessionId: string, userId: number): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { id: sessionId, userId },
    });
  }

  /**
   * Generate a Wings-compatible WebSocket JWT for console/stats streaming.
   *
   * This JWT is signed with the node's daemon token and contains
   * the claims Wings expects for WebSocket authentication.
   */
  async generateWebSocketToken(
    serverUuid: string,
    nodeId: number,
    userId: number,
    userUuid: string,
    permissions: string[],
  ): Promise<{ token: string; socket: string }> {
    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
    });

    if (!node) {
      throw new Error('Node not found');
    }

    const panelUrl = this.config.getOrThrow('APP_URL');
    const uniqueId = randomBytes(16).toString('hex');
    const now = Math.floor(Date.now() / 1000);

    // Sign JWT with the node's daemon token directly via jsonwebtoken to avoid options.expiresIn collision
    // Wings Scoped struct expects `scope: "websocket"` as a string, while CVE-2026-54593 and newer builds check both
    const token = jsonwebtoken.sign(
      {
        iss: panelUrl,
        aud: [`${node.fqdn}:${node.daemonPort}`],
        jti: uniqueId,
        iat: now,
        nbf: now - 300, // 5 minutes clock drift allowance
        exp: now + 600, // 10 minutes
        server_uuid: serverUuid,
        scope: 'websocket',
        scopes: ['websocket'],
        permissions: permissions.includes('*')
          ? [
              'websocket.connect',
              'control.console',
              'control.start',
              'control.stop',
              'control.restart',
              'admin.websocket.errors',
              'admin.websocket.install',
              'admin.websocket.transfer',
              'backup.read',
              '*',
            ]
          : Array.from(new Set(['websocket.connect', ...permissions])),
        user_uuid: userUuid,
        user_id: userId,
        unique_id: uniqueId,
      },
      node.daemonToken,
      {
        algorithm: 'HS256',
      },
    );

    const socket = `${node.scheme === 'https' ? 'wss' : 'ws'}://${node.fqdn}:${node.daemonPort}/api/servers/${serverUuid}/ws`;

    return { token, socket };
  }

  /**
   * Bootstrap the first administrator account.
   * This can only be called once — when no users exist.
   */
  async bootstrapAdmin(
    email: string,
    username: string,
    password: string,
  ): Promise<User> {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      throw new ConflictException(
        'An administrator account already exists. Bootstrap is only available for the first user.',
      );
    }

    const passwordHash = await this.hashPassword(password);

    return this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        password: passwordHash,
        isAdmin: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  /**
   * Register a new user account with email verification.
   */
  async register(
    email: string,
    username: string,
    password: string,
  ): Promise<{ message: string; requiresVerification: boolean }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (!cleanEmail || !cleanUsername || !password) {
      throw new BadRequestException('All fields (email, username, password) are required.');
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: cleanEmail }, { username: cleanUsername }],
      },
    });

    if (existingUser) {
      if (existingUser.email === cleanEmail) {
        throw new ConflictException('An account with this email address already exists.');
      }
      throw new ConflictException('This username is already taken.');
    }

    const passwordHash = await this.hashPassword(password);
    const userCount = await this.prisma.user.count();
    const isFirstUser = userCount === 0;

    const user = await this.prisma.user.create({
      data: {
        email: cleanEmail,
        username: cleanUsername,
        password: passwordHash,
        isAdmin: isFirstUser,
        emailVerifiedAt: isFirstUser ? new Date() : null,
      },
    });

    if (isFirstUser) {
      return {
        message: 'Master administrator account created and automatically verified.',
        requiresVerification: false,
      };
    }

    // Generate secure email verification token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Clean up any older pending verification requests for this email
    await this.prisma.passwordReset.deleteMany({
      where: { email: `verify:${cleanEmail}` },
    });

    await this.prisma.passwordReset.create({
      data: {
        email: `verify:${cleanEmail}`,
        tokenHash,
        expiresAt,
      },
    });

    await this.mailService.sendVerificationEmail(cleanEmail, cleanUsername, rawToken);

    return {
      message: 'Account created! Please check your email to verify your account before logging in.',
      requiresVerification: true,
    };
  }

  /**
   * Verify an email address using the emailed verification token.
   */
  async verifyEmail(email: string, token: string): Promise<{ message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const tokenHash = createHash('sha256').update(token.trim()).digest('hex');

    const record = await this.prisma.passwordReset.findFirst({
      where: {
        email: `verify:${cleanEmail}`,
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired email verification link.');
    }

    await this.prisma.user.updateMany({
      where: { email: cleanEmail },
      data: { emailVerifiedAt: new Date() },
    });

    await this.prisma.passwordReset.delete({
      where: { id: record.id },
    });

    return { message: 'Your email address has been successfully verified! You can now log in.' };
  }

  /**
   * Resend account verification email.
   */
  async resendVerification(emailOrUsername: string): Promise<{ message: string }> {
    const clean = emailOrUsername.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: clean },
          { username: clean },
        ],
      },
    });

    if (!user) {
      return { message: 'If an account exists, a verification link has been sent.' };
    }

    if (user.emailVerifiedAt) {
      return { message: 'Account email is already verified.' };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.passwordReset.deleteMany({
      where: { email: `verify:${user.email}` },
    });

    await this.prisma.passwordReset.create({
      data: {
        email: `verify:${user.email}`,
        tokenHash,
        expiresAt,
      },
    });

    await this.mailService.sendVerificationEmail(user.email, user.username, rawToken);

    return { message: `Verification email sent to ${user.email}! Please check your inbox.` };
  }

  /**
   * Request a password reset link sent via SMTP.
   */
  async forgotPassword(emailOrUsername: string): Promise<{ message: string }> {
    const identifier = (emailOrUsername || '').trim();
    const genericResponse = {
      message: 'If an account exists with that email or username, a password reset link has been sent.',
    };

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { username: { equals: identifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      // Do not disclose whether account exists
      return genericResponse;
    }

    const cleanEmail = user.email;
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordReset.deleteMany({
      where: { email: cleanEmail },
    });

    await this.prisma.passwordReset.create({
      data: {
        email: cleanEmail,
        tokenHash,
        expiresAt,
      },
    });

    await this.mailService.sendPasswordResetEmail(cleanEmail, user.username, rawToken);

    return genericResponse;
  }

  /**
   * Reset a user password using a valid reset token.
   */
  async resetPassword(emailOrToken: string, tokenOrPassword: string, newPassword?: string): Promise<{ message: string }> {
    let email = emailOrToken;
    let token = tokenOrPassword;
    let password = newPassword;

    // Handle 2-argument invocation: resetPassword(token, password)
    if (!newPassword) {
      token = emailOrToken;
      password = tokenOrPassword;
      const tHash = createHash('sha256').update((token || '').trim()).digest('hex');
      const rec = await this.prisma.passwordReset.findFirst({
        where: { tokenHash: tHash, expiresAt: { gt: new Date() } },
      });
      if (!rec) {
        throw new BadRequestException('Invalid or expired password reset link.');
      }
      email = rec.email;
    }

    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const tokenHash = createHash('sha256').update((token || '').trim()).digest('hex');

    const record = await this.prisma.passwordReset.findFirst({
      where: {
        email: cleanEmail,
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired password reset link.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    const passwordHash = await this.hashPassword(password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        // Also verify email if they proved ownership of the inbox
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
      },
    });

    // Invalidate all existing sessions for this user for security
    await this.prisma.session.deleteMany({
      where: { userId: user.id },
    });

    // Delete used reset token
    await this.prisma.passwordReset.delete({
      where: { id: record.id },
    });

    return { message: 'Your password has been successfully reset. You can now log in.' };
  }
}
