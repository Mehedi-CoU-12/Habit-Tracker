import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client: PrismaClient;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    this.client = new PrismaClient({ adapter });
  }

  get user() {
    return this.client.user;
  }

  get habit() {
    return this.client.habit;
  }

  get habitLog() {
    return this.client.habitLog;
  }

  get habitSkip() {
    return this.client.habitSkip;
  }

  get dayNote() {
    return this.client.dayNote;
  }

  get payment() {
    return this.client.payment;
  }

  get focusSession() {
    return this.client.focusSession;
  }

  get appRelease() {
    return this.client.appRelease;
  }

  /**
   * Interactive transaction. Exposed as a method rather than a re-export of
   * `$transaction` so the facade keeps a single, unambiguous shape: everything
   * that must land together (delete-with-ledger-stamp, record-session-with-log)
   * goes through here.
   */
  transaction<R>(fn: (tx: Prisma.TransactionClient) => Promise<R>): Promise<R> {
    return this.client.$transaction(fn);
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
