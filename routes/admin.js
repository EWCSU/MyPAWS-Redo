
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
const prisma = new PrismaClient();

// Require a valid login session.
router.use(requireAuth);

// Only administrators can access these routes.
router.use(async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { role: true }
        });

        if (!user) {
            return res.status(401).json({
                error: "Account not found."
            });
        }

        if (user.role !== "ADMIN") {
            return res.status(403).json({
                error: "Admin access only."
            });
        }

        next();

    } catch (error) {
        console.error("Admin authorization error:", error);

        return res.status(500).json({
            error: "Unable to verify admin access."
        });
    }
});

// Retrieve a basic overview of test accounts.
router.get("/overview", async (req, res) => {
    try {
        const [students, admins, studentRecords] =
            await Promise.all([
                prisma.user.count({
                    where: { role: "STUDENT" }
                }),
                prisma.user.count({
                    where: { role: "ADMIN" }
                }),
                prisma.studentRecord.count()
            ]);

        res.set("Cache-Control", "no-store");

        return res.json({
            overview: {
                studentAccounts: students,
                adminAccounts: admins,
                studentRecords: studentRecords
            },
            note: "Local demonstration database only."
        });

    } catch (error) {
        console.error("Admin overview error:", error);

        return res.status(500).json({
            error: "Unable to retrieve admin overview."
        });
    }
});

router.get("/accounts", async (req, res) => {
    try {
        // Retrieve demonstration student accounts only.
        const users = await prisma.user.findMany({
            where: {
                role: "STUDENT"
            },
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
                failedLoginAttempts: true,
                lockedUntil: true,
                studentRecord: {
                    select: {
                        id: true
                    }
                }
            },
            orderBy: {
                email: "asc"
            }
        });

        const now = new Date();

        const accounts = users.map(user => ({
            id: user.id,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            failedLoginAttempts: user.failedLoginAttempts,
            studentRecordLinked: !!user.studentRecord,
            status:
                user.lockedUntil && user.lockedUntil > now
                    ? "Temporarily Locked"
                    : "Not Currently Locked"
        }));

        res.set("Cache-Control", "no-store");

        return res.json({
            totalAccounts: accounts.length,
            accounts,
            note: "Demonstration student accounts only."
        });

    } catch (error) {
        console.error("Admin accounts error:", error);

        return res.status(500).json({
            error: "Unable to retrieve test accounts."
        });
    }
});

router.post("/accounts/:id/unlock", async (req, res) => {
    try {
        // Only reset an actively locked student account.
        const result = await prisma.user.updateMany({
            where: {
                id: req.params.id,
                role: "STUDENT",
                lockedUntil: {
                    gt: new Date()
                }
            },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null
            }
        });

        if (result.count === 0) {
            return res.status(404).json({
                error: "No active student account lockout found."
            });
        }

        res.set("Cache-Control", "no-store");

        return res.json({
            message: "Student account unlocked successfully."
        });

    } catch (error) {
        console.error("Admin unlock error:", error);

        return res.status(500).json({
            error: "Unable to unlock student account."
        });
    }
});

module.exports = router;
