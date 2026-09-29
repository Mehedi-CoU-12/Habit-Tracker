/**
 * Every mail this API can send, as one pure function per template. Pure so a
 * template is testable without a transport, and typed per template so a
 * missing variable is a compile error rather than an "undefined" in someone's
 * inbox.
 */

import type { WeeklyReview } from '../habits/progress.js';

export type Rendered = { subject: string; text: string; html: string };

export type MailTemplates = {
  'password-reset': {
    name: string;
    url: string;
    expiresInMinutes: number;
  };
  /** Sent instead of a token when the address signs in with Google. */
  'password-reset-google': {
    name: string;
    loginUrl: string;
  };
  /** The Sunday summary of the week just lived. */
  'weekly-review': {
    name: string;
    review: WeeklyReview;
    reviewUrl: string;
    settingsUrl: string;
  };
};

export type MailTemplate = keyof MailTemplates;

const BRAND = 'HabitFlow';

const RESET_FOOTER = `You received this email because someone asked to reset the ${BRAND} password for this address.`;

/** Minimal inline-styled wrapper — mail clients strip <style> blocks. */
function layout(
  heading: string,
  bodyHtml: string,
  footer: string = RESET_FOOTER,
): string {
  return `<div style="margin:0;padding:24px;background:#fff6e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#e87842">${BRAND}</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#2b211c">${heading}</h1>
    ${bodyHtml}
    <p style="margin:32px 0 0;font-size:12px;color:#9a8b80">${footer}</p>
  </div>
</div>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#e87842;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:999px">${label}</a></p>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5a4a41">${text}</p>`;
}

/** Habit names are user input; never let one become markup. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function habitTable(review: WeeklyReview): string {
  const rows = review.habits
    .map(
      (h) =>
        `<tr><td style="padding:6px 0;font-size:14px;color:#2b211c">${escapeHtml(h.name)}${h.bestWeek ? ' 🌸' : ''}</td><td style="padding:6px 0;font-size:14px;color:#5a4a41;text-align:right;white-space:nowrap">${h.done}/${h.due}</td></tr>`,
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 24px">${rows}</table>`;
}

function reviewExtras(review: WeeklyReview): string[] {
  const lines: string[] = [];
  if (review.perfectDays > 0)
    lines.push(
      `${review.perfectDays} perfect day${review.perfectDays === 1 ? '' : 's'} — every habit watered.`,
    );
  for (const m of review.milestones)
    lines.push(`${m.name} reached a ${m.days}-day streak.`);
  if (review.freezesUsed > 0)
    lines.push(
      `${review.freezesUsed} streak freeze${review.freezesUsed === 1 ? '' : 's'} kept a missed day from wilting.`,
    );
  return lines;
}

export const templates: {
  [K in MailTemplate]: (vars: MailTemplates[K]) => Rendered;
} = {
  'password-reset': ({ name, url, expiresInMinutes }) => ({
    subject: `Reset your ${BRAND} password`,
    text: [
      `Hi ${name},`,
      '',
      `Open this link to choose a new ${BRAND} password:`,
      url,
      '',
      `The link expires in ${expiresInMinutes} minutes and can be used once.`,
      'If you did not ask for this, you can ignore this email — your password stays as it is.',
    ].join('\n'),
    html: layout(
      'Choose a new password',
      paragraph(`Hi ${name}, tap the button to set a new password.`) +
        button(url, 'Reset password') +
        paragraph(
          `The link expires in <strong>${expiresInMinutes} minutes</strong> and can be used once. If you did not ask for this, ignore this email — your password stays as it is.`,
        ) +
        paragraph(
          `Button not working? Paste this into your browser:<br><span style="word-break:break-all;color:#e87842">${url}</span>`,
        ),
    ),
  }),

  'password-reset-google': ({ name, loginUrl }) => ({
    subject: `Signing in to ${BRAND}`,
    text: [
      `Hi ${name},`,
      '',
      `Someone asked to reset the password for this ${BRAND} account, but it has no password — it signs in with Google.`,
      '',
      `Use "Continue with Google" on the sign-in screen: ${loginUrl}`,
      '',
      'If this was not you, no action is needed.',
    ].join('\n'),
    html: layout(
      'This account signs in with Google',
      paragraph(
        `Hi ${name}, someone asked to reset the password for this account — but it does not have one. It was created with Google sign-in.`,
      ) +
        button(loginUrl, 'Continue with Google') +
        paragraph('If this was not you, no action is needed.'),
    ),
  }),

  'weekly-review': ({ name, review, reviewUrl, settingsUrl }) => {
    const headline = review.bestWeek
      ? `Your best week yet: ${review.rate}%`
      : `You watered ${review.done} of ${review.due} this week`;
    const extras = reviewExtras(review);
    return {
      subject: review.highlight
        ? `Your week: ${review.highlight}`
        : `Your week in the garden`,
      text: [
        `Hi ${name},`,
        '',
        headline,
        ...(review.highlight ? [review.highlight] : []),
        '',
        ...review.habits.map(
          (h) =>
            `- ${h.name}: ${h.done}/${h.due}${h.bestWeek ? ' (best week yet)' : ''}`,
        ),
        ...(extras.length ? ['', ...extras] : []),
        '',
        `See the full review: ${reviewUrl}`,
        '',
        `Turn these emails off: ${settingsUrl}`,
      ].join('\n'),
      html: layout(
        escapeHtml(headline),
        paragraph(
          `Hi ${escapeHtml(name)}, here is how your garden grew this week${review.highlight ? ` — <strong>${escapeHtml(review.highlight)}</strong>` : ''}.`,
        ) +
          habitTable(review) +
          extras.map((l) => paragraph(escapeHtml(l))).join('') +
          button(reviewUrl, 'See your week'),
        `You get this every Sunday while you have habits growing. <a href="${settingsUrl}" style="color:#9a8b80">Turn weekly reviews off</a>.`,
      ),
    };
  },
};
