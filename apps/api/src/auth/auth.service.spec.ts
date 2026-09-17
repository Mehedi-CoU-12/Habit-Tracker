import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CacheService } from '../redis/cache.service.js';

type UserRow = {
  id: string;
  name: string;
  email: string;
  password: string | null;
};

type TokenRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  user: { email: string };
};

type Fields = Record<string, unknown>;
type WriteArgs = { where: Fields; data: Fields };
type CreateArgs = {
  data: { userId: string; tokenHash: string; expiresAt: Date };
};
type UserUpdateArgs = {
  where: Fields;
  data: { password: string; tokenVersion: { increment: number } };
};

/** Jest's own jest.fn() is unavailable under ESM — hand-rolled recorders. */
function makeService(opts: {
  user?: UserRow | null;
  recentRequests?: number;
  tokenRow?: TokenRow | null;
  /** 0 simulates another request claiming the same link first. */
  claimCount?: number;
}) {
  const created: CreateArgs[] = [];
  const superseded: WriteArgs[] = [];
  const claims: WriteArgs[] = [];
  const userUpdates: UserUpdateArgs[] = [];
  const mails: { to: string; template: string; vars: Fields }[] = [];
  const cacheDeleted: string[] = [];

  const tx = {
    passwordResetToken: {
      updateMany: (args: WriteArgs) => {
        claims.push(args);
        return Promise.resolve({ count: opts.claimCount ?? 1 });
      },
    },
    user: {
      update: (args: UserUpdateArgs) => {
        userUpdates.push(args);
        return Promise.resolve({});
      },
    },
  };

  const prisma = {
    user: { findUnique: () => Promise.resolve(opts.user ?? null) },
    passwordResetToken: {
      count: () => Promise.resolve(opts.recentRequests ?? 0),
      updateMany: (args: WriteArgs) => {
        superseded.push(args);
        return Promise.resolve({ count: 1 });
      },
      create: (args: CreateArgs) => {
        created.push(args);
        return Promise.resolve({});
      },
      findUnique: () => Promise.resolve(opts.tokenRow ?? null),
    },
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;

  const cache = {
    del: (...keys: string[]) => {
      cacheDeleted.push(...keys);
      return Promise.resolve();
    },
  } as unknown as CacheService;

  const mail = {
    send: (to: string, template: string, vars: Fields) => {
      mails.push({ to, template, vars });
      return Promise.resolve();
    },
  } as unknown as MailService;

  const config = {
    get: (key: string) =>
      key === 'FRONTEND_URL' ? 'https://app.test/' : undefined,
  } as unknown as ConfigService;

  return {
    service: new AuthService(prisma, {} as JwtService, cache, mail, config),
    created,
    superseded,
    claims,
    userUpdates,
    mails,
    cacheDeleted,
  };
}

const passwordUser: UserRow = {
  id: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  password: bcrypt.hashSync('old-password', 10),
};

describe('requestPasswordReset', () => {
  it('mails a link and supersedes the outstanding ones', async () => {
    const { service, created, superseded, mails } = makeService({
      user: passwordUser,
    });

    await expect(
      service.requestPasswordReset({ email: passwordUser.email }),
    ).resolves.toEqual({ sent: true });

    expect(created).toHaveLength(1);
    expect(created[0].data.userId).toBe('u1');
    // Only the hash is stored — 64 hex chars of SHA-256, never the token.
    expect(created[0].data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(created[0].data.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Earlier links are expired rather than stamped used, so usedAt stays a
    // clean record of resets a user actually completed.
    expect(superseded[0].where).toMatchObject({ userId: 'u1', usedAt: null });
    expect(superseded[0].data.expiresAt).toBeInstanceOf(Date);

    expect(mails).toHaveLength(1);
    expect(mails[0].template).toBe('password-reset');
    expect(mails[0].to).toBe(passwordUser.email);
    // The trailing slash on FRONTEND_URL must not double up in the link.
    expect(mails[0].vars.url).toMatch(
      /^https:\/\/app\.test\/reset-password\?token=[\w-]+$/,
    );
  });

  it('answers the same for an unknown address, and mails nothing', async () => {
    const { service, created, mails } = makeService({ user: null });

    await expect(
      service.requestPasswordReset({ email: 'nobody@example.com' }),
    ).resolves.toEqual({ sent: true });

    expect(created).toHaveLength(0);
    expect(mails).toHaveLength(0);
  });

  it('sends the Google notice and no token for a passwordless account', async () => {
    const { service, created, mails } = makeService({
      user: { id: 'u2', name: 'Grace', email: 'g@example.com', password: null },
    });

    await expect(
      service.requestPasswordReset({ email: 'g@example.com' }),
    ).resolves.toEqual({ sent: true });

    expect(created).toHaveLength(0);
    expect(mails[0].template).toBe('password-reset-google');
    expect(mails[0].vars.loginUrl).toBe('https://app.test/login');
  });

  it('stops at the per-mailbox cap without changing the answer', async () => {
    const { service, created, mails } = makeService({
      user: passwordUser,
      recentRequests: 3,
    });

    await expect(
      service.requestPasswordReset({ email: passwordUser.email }),
    ).resolves.toEqual({ sent: true });

    expect(created).toHaveLength(0);
    expect(mails).toHaveLength(0);
  });
});

const validRow = (over: Partial<TokenRow> = {}): TokenRow => ({
  id: 't1',
  userId: 'u1',
  expiresAt: new Date(Date.now() + 60_000),
  usedAt: null,
  user: { email: passwordUser.email },
  ...over,
});

describe('resetPassword', () => {
  it('sets the password, revokes every session and returns the address', async () => {
    const { service, claims, userUpdates, cacheDeleted } = makeService({
      tokenRow: validRow(),
    });

    await expect(
      service.resetPassword({ token: 'raw-token', password: 'new-password' }),
    ).resolves.toEqual({ success: true, email: passwordUser.email });

    // Claimed conditionally, so two requests racing one link have one winner.
    expect(claims[0].where).toMatchObject({ id: 't1', usedAt: null });
    expect(claims[0].data.usedAt).toBeInstanceOf(Date);

    const data = userUpdates[0].data;
    expect(bcrypt.compareSync('new-password', data.password)).toBe(true);
    // The whole point of D1.3: a reset signs out the other devices too.
    expect(data.tokenVersion).toEqual({ increment: 1 });
    // Which only bites once the cached auth row is gone.
    expect(cacheDeleted).toContain('auth:user:u1');
    expect(cacheDeleted).toContain('user:me:u1');
  });

  it('refuses an unknown, used or expired link with one message', async () => {
    const rows = [
      null,
      validRow({ usedAt: new Date() }),
      validRow({ expiresAt: new Date(Date.now() - 1_000) }),
    ];
    for (const tokenRow of rows) {
      const { service, userUpdates } = makeService({ tokenRow });
      await expect(
        service.resetPassword({ token: 'raw-token', password: 'new-password' }),
      ).rejects.toThrow('This reset link is invalid or expired');
      expect(userUpdates).toHaveLength(0);
    }
  });

  it('refuses when another request claimed the link first', async () => {
    const { service, userUpdates } = makeService({
      tokenRow: validRow(),
      claimCount: 0,
    });

    await expect(
      service.resetPassword({ token: 'raw-token', password: 'new-password' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userUpdates).toHaveLength(0);
  });
});

// ── Google sign-in ────────────────────────────────────────────────────────
type GoogleRow = {
  id: string;
  name: string;
  email: string;
  googleId: string | null;
  avatarUrl: string | null;
  role?: 'USER' | 'ADMIN';
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  tokenVersion?: number;
};

const googleProfile = {
  googleId: 'g-123',
  name: 'Grace',
  email: 'grace@example.com',
  avatarUrl: null,
};

/**
 * Harness for the Google paths: records what was created and what each JWT
 * was signed with, so a test can assert on the `isNew` claim carried by the
 * one-time code.
 */
function makeGoogleService(opts: {
  existing?: GoogleRow | null;
  /** What jwt.verify() hands back — the code being exchanged. */
  verified?: Record<string, unknown>;
  cached?: unknown;
}) {
  const createdUsers: { data: Record<string, unknown> }[] = [];
  const signed: Record<string, unknown>[] = [];
  const bumped: string[] = [];

  const stored: GoogleRow = opts.existing ?? {
    id: 'u-new',
    name: googleProfile.name,
    email: googleProfile.email,
    googleId: googleProfile.googleId,
    avatarUrl: null,
  };

  const prisma = {
    user: {
      findUnique: ({ where }: { where: { email?: string; id?: string } }) => {
        // By email = the upsert lookup; by id = the exchange re-read, which
        // always finds the row.
        if (where.id) return Promise.resolve(withDefaults(stored));
        return Promise.resolve(
          opts.existing ? withDefaults(opts.existing) : null,
        );
      },
      create: (args: { data: Record<string, unknown> }) => {
        createdUsers.push(args);
        return Promise.resolve(withDefaults(stored));
      },
      update: () => Promise.resolve(withDefaults(stored)),
    },
  } as unknown as PrismaService;

  const jwt = {
    sign: (payload: Record<string, unknown>) => {
      signed.push(payload);
      return `signed-${signed.length}`;
    },
    verify: () => opts.verified ?? {},
  } as unknown as JwtService;

  const cache = {
    get: () => Promise.resolve(opts.cached ?? null),
    set: () => Promise.resolve(),
    del: () => Promise.resolve(),
    bumpVersion: (key: string) => {
      bumped.push(key);
      return Promise.resolve();
    },
  } as unknown as CacheService;

  return {
    service: new AuthService(
      prisma,
      jwt,
      cache,
      {} as MailService,
      {} as ConfigService,
    ),
    createdUsers,
    signed,
    bumped,
  };
}

function withDefaults(row: GoogleRow) {
  return {
    role: 'USER' as const,
    status: 'ACTIVE' as const,
    tokenVersion: 0,
    ...row,
  };
}

describe('googleLoginCode', () => {
  it('creates the account and marks the code new on a first sign-in', async () => {
    const { service, createdUsers, signed } = makeGoogleService({
      existing: null,
    });

    await service.googleLoginCode(googleProfile);

    expect(createdUsers).toHaveLength(1);
    expect(createdUsers[0].data).toMatchObject({
      email: googleProfile.email,
      googleId: googleProfile.googleId,
      status: 'ACTIVE',
    });
    expect(signed).toHaveLength(1);
    expect(signed[0]).toMatchObject({ type: 'google_code', isNew: true });
  });

  it('marks the code not-new for a returning account', async () => {
    const { service, createdUsers, signed } = makeGoogleService({
      existing: {
        id: 'u1',
        name: 'Grace',
        email: googleProfile.email,
        googleId: googleProfile.googleId,
        avatarUrl: null,
      },
    });

    await service.googleLoginCode(googleProfile);

    expect(createdUsers).toHaveLength(0);
    expect(signed[0]).toMatchObject({ type: 'google_code', isNew: false });
  });

  it('marks the code not-new when an email account links Google', async () => {
    // Signing in with Google against an address that already signed up with a
    // password links the two — it is not a new account, so no starter habits.
    const { service, createdUsers, signed } = makeGoogleService({
      existing: {
        id: 'u1',
        name: 'Grace',
        email: googleProfile.email,
        googleId: null,
        avatarUrl: null,
      },
    });

    await service.googleLoginCode(googleProfile);

    expect(createdUsers).toHaveLength(0);
    expect(signed[0]).toMatchObject({ isNew: false });
  });
});

describe('exchangeGoogleCode', () => {
  it('passes the new-account flag through to the client', async () => {
    const { service } = makeGoogleService({
      verified: { sub: 'u-new', type: 'google_code', isNew: true },
    });

    await expect(service.exchangeGoogleCode('code')).resolves.toMatchObject({
      isNew: true,
    });
  });

  it('reports not-new when the code carries no flag', async () => {
    // A code signed by an older build has no isNew claim; absent means no.
    const { service } = makeGoogleService({
      verified: { sub: 'u-new', type: 'google_code' },
    });

    await expect(service.exchangeGoogleCode('code')).resolves.toMatchObject({
      isNew: false,
    });
  });
});
