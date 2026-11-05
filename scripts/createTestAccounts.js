
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const prisma = new PrismaClient();

async function main() {
    const email = process.env.EMAIL_USER;

    if (!email || !/^[^@]+@gmail\.com$/i.test(email)) {
        throw new Error("A Gmail sender is required for demo aliases.");
    }

    const [localPart, domain] = email.split("@");

    // Find our two imported student records.
    const students = await prisma.studentRecord.findMany({
        orderBy: { studentNumber: "asc" }
    });

    if (students.length !== 2) {
        throw new Error("Expected exactly two student records.");
    }

    // Prevent overwriting existing accounts.
    const existingUsers = await prisma.user.count();

    if (existingUsers !== 0) {
        throw new Error("Accounts already exist. No changes made.");
    }

    const credentials = [];

    await prisma.$transaction(async (tx) => {
        for (let i = 0; i < students.length; i++) {
            const testEmail =
                `${localPart}+mypawsstudent${i + 1}@${domain}`;

            const password =
                "Demo2026!" + crypto.randomBytes(12).toString("hex");

            const passwordHash = await bcrypt.hash(password, 12);

            await tx.user.create({
                data: {
                    email: testEmail,
                    passwordHash,
                    role: "STUDENT",
                    studentRecord: {
                        connect: { id: students[i].id }
                    }
                }
            });

            credentials.push({
                email: testEmail,
                password
            });
        }
    });

    console.log("\nTwo demonstration accounts created!");

    credentials.forEach((account, index) => {
        console.log(`\nStudent ${index + 1}`);
        console.log(`Email: ${account.email}`);
        console.log(`Password: ${account.password}`);
    });

    console.log("\nKeep these credentials private.");
}

main()
    .catch((error) => {
        console.error("Account setup failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
