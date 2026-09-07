import { pickTransport } from './mail.service.js';

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
