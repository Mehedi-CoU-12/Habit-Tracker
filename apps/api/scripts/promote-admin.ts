/**
 * Promote a user to ADMIN (and ACTIVE) by email.
 *
 * Render's free tier has no shell, so this runs from a dev machine against
 * whatever DATABASE_URL is in the environment (apps/api/.env or inline):
 *
 *   pnpm --filter api exec tsx scripts/promote-admin.ts you@example.com
 */
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const email = process.argv[2];
if (!email) {
  console.error('Usage: tsx scripts/promote-admin.ts <email>');
  process.exit(1);
}

// The datasource block has no url (driver-adapter setup) — the client must
// be constructed with the adapter, same as PrismaService.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email "${email}"`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { email },
    data: {
      role: 'ADMIN',
      status: 'ACTIVE',
      statusChangedAt: new Date(),
      statusNote: 'promoted via scripts/promote-admin.ts',
    },
  });
  console.log(`${updated.email} is now ${updated.role} (${updated.status})`);
} finally {
  await prisma.$disconnect();
}
