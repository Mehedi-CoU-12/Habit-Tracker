/**
 * Every mail this API can send, as one pure function per template. Pure so a
 * template is testable without a transport, and typed per template so a
 * missing variable is a compile error rather than an "undefined" in someone's
 * inbox.
 */

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
};

export type MailTemplate = keyof MailTemplates;

const BRAND = 'HabitFlow';

/** Minimal inline-styled wrapper — mail clients strip <style> blocks. */
function layout(heading: string, bodyHtml: string): string {
  return `<div style="margin:0;padding:24px;background:#fff6e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#e87842">${BRAND}</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#2b211c">${heading}</h1>
    ${bodyHtml}
    <p style="margin:32px 0 0;font-size:12px;color:#9a8b80">You received this email because someone asked to reset the ${BRAND} password for this address.</p>
  </div>
</div>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#e87842;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:999px">${label}</a></p>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5a4a41">${text}</p>`;
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
};
