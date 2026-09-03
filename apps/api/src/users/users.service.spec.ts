import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CacheService } from '../redis/cache.service.js';

type UserRow = { id: string; email: string; password: string | null };

/** A call-recording stub. Jest's own `jest.fn()` is unavailable under ESM. */
type Stub<A, R> = {
  (arg: A): Promise<R>;
  calls: A[];
};

function stub<A, R = unknown>(value?: R): Stub<A, R> {
  const f = (arg: A) => {
    f.calls.push(arg);
    return Promise.resolve(value as R);
  };
  f.calls = [] as A[];
  return f as Stub<A, R>;
}

function makeService(user: UserRow | null) {
  const paymentUpdateMany = stub<unknown>();
  const userDelete = stub<unknown>();
  const tx = {
    payment: { updateMany: paymentUpdateMany },
    user: { delete: userDelete },
  };
  const prisma = {
    user: { findUnique: stub<unknown, UserRow | null>(user) },
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
  const del = stub<unknown>();
  const bumpVersion = stub<unknown>();
  const cache = { del, bumpVersion } as unknown as CacheService;
  return {
    service: new UsersService(prisma, cache),
    paymentUpdateMany,
    userDelete,
    del,
  };
}

const hashed = bcrypt.hashSync('correct-horse', 10);

describe('deleteAccount', () => {
  it('deletes a password account when the password matches', async () => {
    const { service, userDelete, paymentUpdateMany, del } = makeService({
      id: 'u1',
      email: 'a@b.c',
      password: hashed,
    });

    await expect(
      service.deleteAccount('u1', { password: 'correct-horse' }),
    ).resolves.toEqual({ deleted: true });

    expect(userDelete.calls).toHaveLength(1);
    // The email is stamped onto the ledger before the FK goes null.
    expect(paymentUpdateMany.calls[0]).toEqual({
      where: { userId: 'u1' },
      data: { userEmail: 'a@b.c' },
    });
    // The cached auth row must die with the account, or a live access token
    // keeps working for up to TTL.authUser after the row is gone.
    expect(del.calls[0]).toContain('auth:user:u1');
  });

  it('rejects a wrong password and leaves the account intact', async () => {
    const { service, userDelete } = makeService({
      id: 'u1',
      email: 'a@b.c',
      password: hashed,
    });
    await expect(
      service.deleteAccount('u1', { password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userDelete.calls).toHaveLength(0);
  });

  it('requires a password when the account has one', async () => {
    const { service, userDelete } = makeService({
      id: 'u1',
      email: 'a@b.c',
      password: hashed,
    });
    await expect(service.deleteAccount('u1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userDelete.calls).toHaveLength(0);
  });

  it('takes the typed word for a Google-only account', async () => {
    const { service, userDelete } = makeService({
      id: 'u2',
      email: 'g@b.c',
      password: null,
    });
    await expect(
      service.deleteAccount('u2', { confirmation: 'delete' }),
    ).resolves.toEqual({ deleted: true });
    expect(userDelete.calls).toHaveLength(1);
  });

  it('refuses a Google-only account without the word', async () => {
    const { service, userDelete } = makeService({
      id: 'u2',
      email: 'g@b.c',
      password: null,
    });
    for (const dto of [{}, { confirmation: 'yes' }, { password: 'x' }]) {
      await expect(service.deleteAccount('u2', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect(userDelete.calls).toHaveLength(0);
  });

  it('404s on an account that is already gone', async () => {
    const { service } = makeService(null);
    await expect(
      service.deleteAccount('ghost', { confirmation: 'DELETE' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
