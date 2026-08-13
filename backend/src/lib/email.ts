import { Resend } from 'resend';
import { config } from '../config/env.js';

const resend = config.email.resendApiKey ? new Resend(config.email.resendApiKey) : null;

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: any }> {
  const { to, subject, html } = options;

  if (resend) {
    try {
      const data = await resend.emails.send({
        from: config.email.from,
        to: [to],
        subject,
        html,
      });
      console.log(`[Email Service] Sent email to ${to}:`, data);
      return { success: true, id: data.data?.id };
    } catch (error) {
      console.error(`[Email Service] Failed to send email to ${to}:`, error);
      return { success: false, error };
    }
  } else {
    console.log(`\n==================================================`);
    console.log(`[Email Service - Dev Mode (Resend Key Not Set)]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML Payload:\n${html}`);
    console.log(`==================================================\n`);
    return { success: true, id: 'dev-mode-mock-id' };
  }
}

export function getVerificationEmailHtml(name: string, url: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
          .card { max-width: 520px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .h1 { font-size: 24px; font-weight: 700; color: #38bdf8; margin-top: 0; margin-bottom: 16px; }
          .p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-bottom: 24px; }
          .footer { font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1 class="h1">Verify your email address</h1>
          <p class="p">Hello ${name || 'there'},</p>
          <p class="p">Thank you for registering. Please confirm your email address by clicking the button below:</p>
          <a href="${url}" class="btn" target="_blank">Verify Email Address</a>
          <p class="p">If you did not request this, you can safely ignore this email.</p>
          <div class="footer">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${url}" style="color: #38bdf8;">${url}</a>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function getPasswordResetEmailHtml(name: string, url: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; }
          .card { max-width: 520px; margin: 0 auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .h1 { font-size: 24px; font-weight: 700; color: #38bdf8; margin-top: 0; margin-bottom: 16px; }
          .p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-bottom: 24px; }
          .footer { font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1 class="h1">Reset your password</h1>
          <p class="p">Hello ${name || 'there'},</p>
          <p class="p">We received a request to reset your password. Click the button below to choose a new password:</p>
          <a href="${url}" class="btn" target="_blank">Reset Password</a>
          <p class="p">If you did not request a password reset, please ignore this email.</p>
          <div class="footer">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${url}" style="color: #38bdf8;">${url}</a>
          </div>
        </div>
      </body>
    </html>
  `;
}
