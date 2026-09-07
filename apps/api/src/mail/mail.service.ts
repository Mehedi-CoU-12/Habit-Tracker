import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  MailTemplate,
  MailTemplates,
  Rendered,
  templates,
} from './templates.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'HabitFlow <onboarding@resend.dev>';
const DEFAULT_SMTP_SERVICE = 'gmail';

export type Transport = 'resend' | 'smtp' | 'console';

/**
 * Which transport a given configuration selects. Pure and exported so the
 * choice — the one thing that decides whether mail leaves the building — is
 * testable without a network or a mailbox.
 */
export function pickTransport(env: {
  resendApiKey?: string;
  smtpUser?: string;
  smtpPassword?: string;
}): Transport {
  if (env.resendApiKey?.trim()) return 'resend';
  if (env.smtpUser?.trim() && env.smtpPassword?.trim()) return 'smtp';
  return 'console';
}

/**
 * One seam for every outbound mail: `send(to, template, vars)`.
 *
 * Three transports, in the order they are preferred:
 *
 *   - `resend`  — RESEND_API_KEY set. One HTTP call, no SMTP ports to
 *     negotiate with Render, but its shared onboarding@resend.dev sender only
 *     delivers to the Resend account's own address until a domain is verified.
 *   - `smtp`    — SMTP_MAIL + SMTP_PASSWORD set. Reaches any recipient without
 *     owning a domain, which is why it is the default path here; the costs are
 *     the provider's daily cap and mail that reads as personal.
 *   - `console` — neither configured. The mail is logged, so a fresh clone can
 *     walk the whole password-reset flow by copying the link out of the log.
 *
 * Sending never throws. Its one caller answers 200 whether or not the address
 * exists, and a provider outage must not turn that into an
 * account-enumeration oracle.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private smtp: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    // Logged at boot: "nothing arrived" is otherwise indistinguishable from
    // "the key was never set on this deploy".
    this.logger.log(`transport: ${this.transport()}`);
  }

  async send<K extends MailTemplate>(
    to: string,
    template: K,
    vars: MailTemplates[K],
  ): Promise<void> {
    const rendered = templates[template](vars);
    switch (this.transport()) {
      case 'resend':
        await this.sendViaResend(to, template, rendered);
        return;
      case 'smtp':
        await this.sendViaSmtp(to, template, rendered);
        return;
      default:
        this.logToConsole(to, rendered);
    }
  }

  private transport(): Transport {
    return pickTransport({
      resendApiKey: this.config.get<string>('RESEND_API_KEY'),
      smtpUser: this.config.get<string>('SMTP_MAIL'),
      smtpPassword: this.config.get<string>('SMTP_PASSWORD'),
    });
  }

  private async sendViaResend(
    to: string,
    template: string,
    rendered: Rendered,
  ): Promise<void> {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.get<string>('RESEND_API_KEY')?.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.get<string>('MAIL_FROM')?.trim() || DEFAULT_FROM,
          to,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.failed(template, to, `${res.status} ${body.slice(0, 200)}`);
        return;
      }
      this.logger.log(`sent ${template} to ${to} via resend`);
    } catch (err) {
      this.failed(template, to, message(err));
    }
  }

  private async sendViaSmtp(
    to: string,
    template: string,
    rendered: Rendered,
  ): Promise<void> {
    const user = this.config.get<string>('SMTP_MAIL')?.trim() ?? '';
    try {
      await this.smtpTransporter(user).sendMail({
        // Not MAIL_FROM: consumer providers only let you send as the account
        // you authenticated with, and a mismatched From is rewritten at best
        // and rejected at worst. The display name is still ours.
        from: `HabitFlow <${user}>`,
        to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      this.logger.log(`sent ${template} to ${to} via smtp`);
    } catch (err) {
      this.failed(template, to, message(err));
    }
  }

  /** Built once and reused — the pool survives between sends. */
  private smtpTransporter(user: string): Transporter {
    if (!this.smtp) {
      this.smtp = nodemailer.createTransport({
        service:
          this.config.get<string>('SMTP_SERVICE')?.trim() ||
          DEFAULT_SMTP_SERVICE,
        auth: {
          user,
          pass: this.config.get<string>('SMTP_PASSWORD')?.trim(),
        },
      });
    }
    return this.smtp;
  }

  private failed(template: string, to: string, detail: string) {
    this.logger.error(`${template} to ${to} failed: ${detail}`);
  }

  private logToConsole(to: string, rendered: Rendered) {
    this.logger.warn(
      `no mail transport configured — logging instead of sending.\n` +
        `  to:      ${to}\n` +
        `  subject: ${rendered.subject}\n` +
        rendered.text
          .split('\n')
          .map((line) => `  | ${line}`)
          .join('\n'),
    );
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
