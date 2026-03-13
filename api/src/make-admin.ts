/**
 * One-time script: ensure clint@madebyclint.com has isAdmin = true.
 *
 * Usage:
 *   cd api
 *   npx tsx src/make-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const ADMIN_EMAIL = 'clint@madebyclint.com';

async function main() {
  const result = await prisma.user.updateMany({
    where: { email: ADMIN_EMAIL },
    data: { isAdmin: true },
  });

  if (result.count === 0) {
    console.error(`User not found: ${ADMIN_EMAIL}`);
    process.exit(1);
  }

  console.log(`✅  ${ADMIN_EMAIL} is now an admin.`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
