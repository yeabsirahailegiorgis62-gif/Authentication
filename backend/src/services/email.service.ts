import { config } from '../config/env.js';

export class EmailService {
  /**
   * Sends or logs Email Verification link containing raw token.
   */
  static async sendVerificationEmail(email: string, rawToken: string): Promise<void> {
    const verifyUrl = `${config.clientUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      console.log(`[EmailService] ✉️ Email Verification Link sent to ${email}: ${verifyUrl}`);
      return;
    }

    // In production with SMTP configured, send via mailer here
  }

  /**
   * Sends or logs Password Reset link containing raw token.
   */
  static async sendPasswordResetEmail(email: string, rawToken: string): Promise<void> {
    const resetUrl = `${config.clientUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      console.log(`[EmailService] ✉️ Password Reset Link sent to ${email}: ${resetUrl}`);
      return;
    }

    // In production with SMTP configured, send via mailer here
  }
}
