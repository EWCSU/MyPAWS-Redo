
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function requireAuth(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({
            error: "Not authenticated."
        });
    }

    let payload;

    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({
            error: "Invalid or expired session."
        });
    }

    if (
        typeof payload.userId !== "string" ||
        !Number.isInteger(payload.sessionVersion)
    ) {
        return res.status(401).json({
            error: "Invalid session."
        });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { sessionVersion: true }
        });

        if (
            !user ||
            user.sessionVersion !== payload.sessionVersion
        ) {
            return res.status(401).json({
                error: "Session expired. Please log in again."
            });
        }

        req.userId = payload.userId;
        return next();

    } catch (error) {
        console.error("Session verification error:", error);

        return res.status(500).json({
            error: "Unable to verify session."
        });
    }
}

module.exports = requireAuth;
