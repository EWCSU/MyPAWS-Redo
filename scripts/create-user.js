require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DOMAIN = process.env.STUDENT_EMAIL_DOMAIN || 'coyote.csusb.edu';

async function main() {
  const [idArg, passwordArg] = process.argv.slice(2);

  if (!idArg) {
    console.log('Usage: node scripts/create-user.js <studentId or full email> [password]');
    return;
  }

  const email = (idArg.includes('@') ? idArg : `${idArg}@${DOMAIN}`).toLowerCase();
  const password = passwordArg || crypto.randomBytes(9).toString('base64url');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${email} already exists. Nothing changed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { email, passwordHash } });

  console.log(`Created ${email}`);
  console.log(`Temporary password: ${password}`);
}

main()
  .catch((err) => console.error('Error:', err.message))
  .finally(() => prisma.$disconnect());