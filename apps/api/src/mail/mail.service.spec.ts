import { pickTransport, undeliverableReason } from './mail.service.js';

describe('pickTransport', () => {
  it('prefers Resend when its key is set', () => {
    expect(
      pickTransport({
        resendApiKey: 're_123',
        smtpUser: 'a@b.c',
        smtpPassword: 'pw',
      }),
    ).toBe('resend');
  });

  it('falls to SMTP when both credentials are present', () => {
    expect(pickTransport({ smtpUser: 'a@b.c', smtpPassword: 'pw' })).toBe(
      'smtp',
    );
  });

  it('does not half-configure SMTP from one credential', () => {
    expect(pickTransport({ smtpUser: 'a@b.c' })).toBe('console');
    expect(pickTransport({ smtpPassword: 'pw' })).toBe('console');
  });

  it('logs to the console when nothing is configured', () => {
    expect(pickTransport({})).toBe('console');
  });

  it('treats blank env vars as unset', () => {
    // Render and .env files both hand back "" rather than undefined for a
    // declared-but-empty variable.
    expect(
      pickTransport({
        resendApiKey: '  ',
        smtpUser: 'a@b.c',
        smtpPassword: 'pw',
      }),
    ).toBe('smtp');
    expect(
      pickTransport({ resendApiKey: '', smtpUser: '', smtpPassword: '' }),
    ).toBe('console');
  });
});

describe('undeliverableReason', () => {
  const resend = { transport: 'resend' as const, onRender: false };

  it('flags the shared Resend sender, which only reaches our own address', () => {
    expect(
      undeliverableReason({
        ...resend,
        from: 'HabitFlow <onboarding@resend.dev>',
      }),
    ).toMatch(/resend\.com\/domains/);
  });

  it('clears Resend once MAIL_FROM is on a verified domain', () => {
    expect(
      undeliverableReason({
        ...resend,
        from: 'HabitFlow <no-reply@habitflow.app>',
      }),
    ).toBeNull();
  });

  it('flags SMTP on Render, whose free instances block 25/465/587', () => {
    expect(
      undeliverableReason({ transport: 'smtp', from: '', onRender: true }),
    ).toMatch(/Render blocks outbound ports/);
  });

  it('allows SMTP anywhere else', () => {
    expect(
      undeliverableReason({ transport: 'smtp', from: '', onRender: false }),
    ).toBeNull();
  });

  it('always flags the console transport', () => {
    expect(
      undeliverableReason({ transport: 'console', from: '', onRender: false }),
    ).toMatch(/no transport configured/);
  });
});
