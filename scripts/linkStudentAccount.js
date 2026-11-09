require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const [studentNumber, loginEmail] = process.argv.slice(2);

  if (!studentNumber || !loginEmail) {
    console.log('Usage: node scripts/linkStudentAccount.js <studentNumber> <email>');
    return;
  }

  const email = loginEmail.trim().toLowerCase();

  const record = await prisma.studentRecord.findUnique({ where: { studentNumber } });
  if (!record) {
    console.log(`No student record with number ${studentNumber}. Import the data first.`);
    return;
  }
  if (record.userId) {
    console.log(`${record.name} is already linked to an account. Nothing changed.`);
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${email} already exists. Choose a different email.`);
    return;
  }

  const password = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'STUDENT',
      studentRecord: { connect: { id: record.id } },
    },
  });

  console.log(`Created ${email}, linked to ${record.name} (${studentNumber})`);
  console.log(`Temporary password: ${password}`);
}

main()
  .catch((err) => console.error('Error:', err.message))
  .finally(() => prisma.$disconnect());