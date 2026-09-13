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
const SHARED_RESEND_SENDER = 'onboarding@resend.dev';
const DEFAULT_FROM = `HabitFlow <${SHARED_RESEND_SENDER}>`;
const DEFAULT_SMTP_SERVICE = 'gmail';

export type Transport = 'resend' | 'smtp' | 'console';

export type MailStatus = {
  transport: Transport;
  /** False when this config cannot reach an address that isn't our own. */
  deliverable: boolean;
  reason?: string;
};

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
 * Why a transport cannot reach a stranger's inbox, or null if it can. Pure so
 * the three ways this has silently swallowed a password reset stay testable.
 */
export function undeliverableReason(env: {
  transport: Transport;
  from: string;
  onRender: boolean;
}): string | null {
  switch (env.transport) {
    case 'resend':
      // Resend answers 403 for every recipient but the account's own address
      // while the shared sender is in use.
      return env.from.includes(SHARED_RESEND_SENDER)
        ? `sending as ${SHARED_RESEND_SENDER}; Resend rejects every recipient except your own account address. Verify a domain at resend.com/domains and set MAIL_FROM to an address on it.`
        : null;
    case 'smtp':
      // Render free instances have blocked outbound 25/465/587 since Sep 2025,
      // so every send times out and is swallowed.
      return env.onRender
        ? 'SMTP is configured, but Render blocks outbound ports 25/465/587 on free instances — every send times out. Set RESEND_API_KEY (HTTPS, not blocked) or move to a paid instance.'
        : null;
    default:
      return 'no transport configured (RESEND_API_KEY, or SMTP_MAIL + SMTP_PASSWORD) — mail is only logged.';
  }
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private smtp: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    // Logged at boot: "nothing arrived" is otherwise indistinguishable from
    // "the key was never set on this deploy".
    const { transport, deliverable, reason } = this.status;
    this.logger.log(`transport: ${transport}`);
    if (deliverable) return;
    const message = `mail cannot reach real recipients: ${reason}`;
    if (this.deployed()) this.logger.error(message);
    else this.logger.warn(message);
  }

  /** Surfaced on /health — the only way to check a deploy without log access. */
  get status(): MailStatus {
    const transport = this.transport();
    const reason = undeliverableReason({
      transport,
      from: this.from(),
      onRender: this.onRender(),
    });
    return reason
      ? { transport, deliverable: false, reason }
      : { transport, deliverable: true };
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

  private from(): string {
    return this.config.get<string>('MAIL_FROM')?.trim() || DEFAULT_FROM;
  }

  /** Render sets both of these on every instance. */
  private onRender(): boolean {
    return Boolean(
      this.config.get<string>('RENDER')?.trim() ||
      this.config.get<string>('RENDER_EXTERNAL_URL')?.trim(),
    );
  }

  private deployed(): boolean {
    return (
      this.onRender() || this.config.get<string>('NODE_ENV') === 'production'
    );
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
          from: this.from(),
          to,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        // 403 here is nearly always the unverified-domain case.
        const hint =
          res.status === 403
            ? ' — verify a domain at resend.com/domains and set MAIL_FROM to an address on it'
            : '';
        this.failed(template, to, `${res.status} ${body.slice(0, 200)}${hint}`);
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
        // A blocked port would otherwise hold the socket for ~2 minutes.
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
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
