import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST', 'localhost');
    const port = Number(this.config.get<number>('SMTP_PORT', 1025));
    const user = this.config.get<string>('SMTP_USER', '');
    const pass = this.config.get<string>('SMTP_PASS', '');
    const secure = this.config.get<string>('SMTP_SECURE', 'false') === 'true';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
  }

  private getFromAddress(): string {
    const raw = this.config.get<string>(
      'EMAIL_FROM',
      '"Pawnder" <noreply@pawnder.hu>',
    );
    return raw ? raw.replace(/\\"/g, '"').trim() : '"Pawnder" <noreply@pawnder.hu>';
  }

  async sendOtpEmail(to: string, code: string): Promise<boolean> {
    const from = this.getFromAddress();

    const html = `
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>Pawnder Belépési Kód</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #faf7f5; color: #231942; margin: 0; padding: 24px;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border: 1px solid #f0e6ff; border-radius: 24px; padding: 32px; box-shadow: 0 12px 30px -5px rgba(91, 33, 182, 0.12);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background-color: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 16px; padding: 10px 18px;">
        <span style="font-size: 20px; font-weight: 800; color: #5b21b6;">🐾 Pawnder</span>
      </div>
      <h2 style="color: #231942; margin-top: 16px; margin-bottom: 4px; font-size: 22px;">Bejelentkezés – Belépési Kód</h2>
      <p style="color: #6b7280; font-size: 14px; margin: 0;">Használd az alábbi 6-jegyű kódot a biztonságos belépéshez:</p>
    </div>

    <div style="background-color: #faf5ff; border: 2px dashed #8b5cf6; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0;">
      <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #6d28d9;">${code}</span>
    </div>

    <div style="color: #6b7280; font-size: 13px; line-height: 1.5; text-align: center;">
      <p style="margin: 0 0 8px 0;">⏳ A kód <strong>10 percig</strong> érvényes, és csak egyszer használható fel.</p>
      <p style="margin: 0;">Ha nem te kezdeményezted a belépést, kérjük, hagyd figyelmen kívül ezt az üzenetet.</p>
    </div>

    <div style="border-top: 1px solid #f3f4f6; margin-top: 28px; padding-top: 16px; text-align: center; color: #9ca3af; font-size: 11px;">
      © ${new Date().getFullYear()} Pawnder • Non-profit menhelyi örökbefogadás-segítő kezdeményezés
    </div>
  </div>
</body>
</html>
`;

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: `[Pawnder] Belépési kódod: ${code}`,
        text: `A belépési kódod a Pawnder fiókodba: ${code}\nA kód 10 percig érvényes.`,
        html,
      });
      this.logger.log(`OTP email sent successfully to ${to}`);
      return true;
    } catch (err: any) {
      this.logger.warn(`Mail server not reachable for ${to} (${err.message}) — OTP code available in console/dev response.`);
      return false;
    }
  }
}

