import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MailTemplate,
  MailTemplates,
  Rendered,
  templates,
} from './templates.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'HabitFlow <onboarding@resend.dev>';

/**
 * One seam for every outbound mail: `send(to, template, vars)`.
 *
 * With `RESEND_API_KEY` set it posts to Resend's HTTP API (one key, no SMTP
 * ports to negotiate with Render); without it the mail is logged to stdout, so
 * a fresh clone can walk the whole password-reset flow by copying the link out
 * of the API log. Sending never throws: the one caller answers 200 whether or
 * not the address exists, and a provider outage must not turn that into an
 * account-enumeration oracle.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async send<K extends MailTemplate>(
    to: string,
    template: K,
    vars: MailTemplates[K],
  ): Promise<void> {
    const rendered = templates[template](vars);
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();

    if (!apiKey) {
      this.logToConsole(to, template, rendered);
      return;
    }

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
        this.logger.error(
          `${template} to ${to} failed: ${res.status} ${body.slice(0, 200)}`,
        );
        return;
      }
      this.logger.log(`sent ${template} to ${to}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`${template} to ${to} failed: ${message}`);
    }
  }

  private logToConsole(to: string, template: string, rendered: Rendered) {
    this.logger.warn(
      `RESEND_API_KEY is not set — mail is logged, not sent.\n` +
        `  to:      ${to}\n` +
        `  subject: ${rendered.subject}\n` +
        rendered.text
          .split('\n')
          .map((line) => `  | ${line}`)
          .join('\n'),
    );
  }
}
