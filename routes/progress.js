const express = require("express");
const { PrismaClient } = require("@prisma/client");
const requireAuth = require("../middleware/requireAuth");
const { buildProgressOverview } = require("../utils/progressOverview");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// Chart-ready progress numbers for the logged-in student's own audit.
router.get("/overview", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true, studentRecord: { select: { id: true } } }
    });

    if (!user) return res.status(401).json({ error: "Account not found." });
    if (user.role !== "STUDENT") return res.status(403).json({ error: "Student access only." });
    if (!user.studentRecord) return res.status(404).json({ error: "No linked student record." });

    // Optional ?auditId= so the charts can match the audit the student is viewing.
    // The studentRecordId filter means a student can only ever load their own audits.
    const auditId = typeof req.query.auditId === "string" ? req.query.auditId : undefined;

    const audit = await prisma.degreeAudit.findFirst({
      where: { studentRecordId: user.studentRecord.id, ...(auditId ? { id: auditId } : {}) },
      orderBy: { runDate: "desc" },
      select: {
        id: true,
        sourceAuditSequence: true,
        programCode: true,
        programTitle: true,
        runDate: true,
        requirements: {
          select: {
            title: true,
            sourceName: true,
            sourceRtabx: true,
            satisfiedCode: true,
            sourceData: true,
            subrequirements: {
              select: {
                title: true,
                sourceStabx: true,
                satisfiedCode: true,
                sourceData: true,
                courses: {
                  select: {
                    courseCode: true,
                    courseTitle: true,
                    grade: true,
                    credits: true,
                    termCode: true,
                    inProgressCode: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!audit) return res.status(404).json({ error: "No degree audit found." });

    res.set("Cache-Control", "no-store");
    return res.json({ auditId: audit.id, overview: buildProgressOverview(audit) });
  } catch (error) {
    console.error("Progress overview error:", error);
    return res.status(500).json({ error: "Unable to build progress overview." });
  }
});

module.exports = router;
