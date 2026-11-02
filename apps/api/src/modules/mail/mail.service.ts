import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly isConfigured: boolean = false;
  private readonly appUrl: string;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    this.appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
    const host = this.config.get<string>('SMTP_HOST');
    const port = parseInt(this.config.get<string>('SMTP_PORT') || '587', 10);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true' || port === 465;
    this.fromAddress =
      this.config.get<string>('SMTP_FROM') ||
      (user ? `"Obsidian Panel" <${user}>` : '"Obsidian Panel" <noreply@obsidianpanel.com>');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      this.isConfigured = true;
      this.logger.log(`SMTP configured for host ${host}:${port} (${user})`);
    } else {
      this.logger.warn(
        'SMTP is not configured in .env (SMTP_HOST, SMTP_USER, SMTP_PASS). Email links will be printed to server logs.',
      );
    }
  }

  /**
   * Send Email Verification Link
   */
  async sendVerificationEmail(to: string, username: string, token: string): Promise<boolean> {
    const verifyUrl = `${this.appUrl}/verify-email?token=${token}&email=${encodeURIComponent(to)}`;

    if (!this.isConfigured || !this.transporter) {
      this.logger.warn('\n============================================================');
      this.logger.warn(`📧 [DEV EMAIL VERIFICATION] To: ${to} (${username})`);
      this.logger.warn(`👉 Verification Link: ${verifyUrl}`);
      this.logger.warn('============================================================\n');
      return true;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your Obsidian Panel account</title>
  <style>
    body { background-color: #090909; color: #ededed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 20px; }
    .card { max-width: 540px; margin: 0 auto; background-color: #121212; border: 1px solid #262626; border-radius: 12px; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { font-size: 24px; font-weight: 700; color: #06b6d4; margin-bottom: 12px; letter-spacing: -0.5px; }
    p { font-size: 15px; line-height: 1.6; color: #a1a1aa; margin: 16px 0; }
    .btn { display: inline-block; background-color: #06b6d4; color: #000000 !important; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; margin: 24px 0; text-align: center; }
    .footer { font-size: 12px; color: #71717a; border-top: 1px solid #262626; padding-top: 20px; margin-top: 28px; }
    .raw-link { word-break: break-all; color: #06b6d4; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">Obsidian Panel</div>
    <p>Hi <strong>${username}</strong>,</p>
    <p>Thank you for creating an account on Obsidian Panel. Please verify your email address to activate your account and start managing game servers.</p>
    <p style="text-align: center;">
      <a href="${verifyUrl}" class="btn" target="_blank">Verify Email Address</a>
    </p>
    <p>This verification link will expire in <strong>24 hours</strong>. If you did not create this account, you can safely ignore this email.</p>
    <div class="footer">
      If the button above does not work, copy and paste this URL into your browser:<br/>
      <span class="raw-link">${verifyUrl}</span>
    </div>
  </div>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Verify your email — Obsidian Panel',
        html,
      });
      this.logger.log(`Verification email sent to ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send verification email to ${to}: ${error.message}`);
      this.logger.warn(`👉 [FALLBACK VERIFICATION LINK]: ${verifyUrl}`);
      return false;
    }
  }

  /**
   * Send Password Reset Link
   */
  async sendPasswordResetEmail(to: string, username: string, token: string): Promise<boolean> {
    const resetUrl = `${this.appUrl}/reset-password?token=${token}&email=${encodeURIComponent(to)}`;

    if (!this.isConfigured || !this.transporter) {
      this.logger.warn('\n============================================================');
      this.logger.warn(`🔑 [DEV PASSWORD RESET] To: ${to} (${username})`);
      this.logger.warn(`👉 Reset Link: ${resetUrl}`);
      this.logger.warn('============================================================\n');
      return true;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset your Obsidian Panel password</title>
  <style>
    body { background-color: #090909; color: #ededed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 20px; }
    .card { max-width: 540px; margin: 0 auto; background-color: #121212; border: 1px solid #262626; border-radius: 12px; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { font-size: 24px; font-weight: 700; color: #06b6d4; margin-bottom: 12px; letter-spacing: -0.5px; }
    p { font-size: 15px; line-height: 1.6; color: #a1a1aa; margin: 16px 0; }
    .btn { display: inline-block; background-color: #06b6d4; color: #000000 !important; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; margin: 24px 0; text-align: center; }
    .footer { font-size: 12px; color: #71717a; border-top: 1px solid #262626; padding-top: 20px; margin-top: 28px; }
    .raw-link { word-break: break-all; color: #06b6d4; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">Obsidian Panel</div>
    <p>Hi <strong>${username}</strong>,</p>
    <p>We received a request to reset the password for your Obsidian Panel account. Click the button below to choose a new password.</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
    </p>
    <p>This password reset link is valid for <strong>1 hour</strong>. If you did not request a password reset, no further action is required and your account remains secure.</p>
    <div class="footer">
      If the button above does not work, copy and paste this URL into your browser:<br/>
      <span class="raw-link">${resetUrl}</span>
    </div>
  </div>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Reset your password — Obsidian Panel',
        html,
      });
      this.logger.log(`Password reset email sent to ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send password reset email to ${to}: ${error.message}`);
      this.logger.warn(`👉 [FALLBACK PASSWORD RESET LINK]: ${resetUrl}`);
      return false;
    }
  }
}
