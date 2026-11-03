
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
const prisma = new PrismaClient();

// All student routes require authentication.
router.use(requireAuth);

// Retrieve the currently logged-in student's information.
router.get("/me", async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: {
                role: true,
                studentRecord: {
                    select: {
                        name: true,
                        programCode: true,
                        programTitle: true,
                        degreeAudits: {
                            select: {
                                id: true,
                                programCode: true,
                                programTitle: true,
                                runDate: true
                            },
                            orderBy: {
                                runDate: "desc"
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(401).json({
                error: "Account not found."
            });
        }

        if (user.role !== "STUDENT") {
            return res.status(403).json({
                error: "Student access only."
            });
        }

        if (!user.studentRecord) {
            return res.status(404).json({
                error: "No student record linked to this account."
            });
        }

        res.set("Cache-Control", "no-store");

        return res.json({
            student: user.studentRecord
        });

    } catch (error) {
        console.error("Student API error:", error);

        return res.status(500).json({
            error: "Unable to retrieve student information."
        });
    }
});

router.get("/audit-summary", async (req, res) => {
    try {
        // Find the authenticated student's account.
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: {
                role: true,
                studentRecord: {
                    select: { id: true }
                }
            }
        });

        if (!user) {
            return res.status(401).json({
                error: "Account not found."
            });
        }

        if (user.role !== "STUDENT") {
            return res.status(403).json({
                error: "Student access only."
            });
        }

        if (!user.studentRecord) {
            return res.status(404).json({
                error: "No linked student record."
            });
        }

        // Retrieve only this student's latest audit.
        const audit = await prisma.degreeAudit.findFirst({
            where: {
                studentRecordId: user.studentRecord.id
            },
            orderBy: { runDate: "desc" },
            select: {
                id: true,
                programTitle: true,
                runDate: true,
                requirements: {
                    orderBy: { sourceRtabx: "asc" },
                    select: {
                        sourceRtabx: true,
                        sourceName: true,
                        title: true,
                        satisfiedCode: true,
                        sourceData: true,
                        _count: {
                            select: {
                                subrequirements: true
                            }
                        }
                    }
                }
            }
        });

        if (!audit) {
            return res.status(404).json({
                error: "No degree audit found."
            });
        }

        const sections = audit.requirements
            .filter(req => {
                const name = (req.sourceName || "")
                    .trim().toUpperCase();

                // Exclude technical report sections.
                return name &&
                    name !== "LEGEND" &&
                    name !== "REJECT";
            })
            .map(req => ({
                requirementCode: req.sourceRtabx,
                title: req.title || req.sourceName,
                category: req.sourceData?.CATEGORY || null,
                statusCode: req.satisfiedCode,
                subrequirementCount:
                    req._count.subrequirements
            }));

        res.set("Cache-Control", "no-store");

        return res.json({
            audit: {
                id: audit.id,
                programTitle: audit.programTitle,
                runDate: audit.runDate,
                requirements: sections
            }
        });

    } catch (error) {
        console.error("Audit summary error:", error);

        return res.status(500).json({
            error: "Unable to retrieve degree audit."
        });
    }
});

router.get("/audit-details", async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: {
                role: true,
                studentRecord: {
                    select: { id: true }
                }
            }
        });

        if (!user) {
            return res.status(401).json({
                error: "Account not found."
            });
        }

        if (user.role !== "STUDENT") {
            return res.status(403).json({
                error: "Student access only."
            });
        }

        if (!user.studentRecord) {
            return res.status(404).json({
                error: "No linked student record."
            });
        }

        const audit = await prisma.degreeAudit.findFirst({
            where: {
                studentRecordId: user.studentRecord.id
            },
            orderBy: { runDate: "desc" },
            select: {
                id: true,
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

        if (!audit) {
            return res.status(404).json({
                error: "No degree audit found."
            });
        }


const organizedAudit = {
    ...audit,
    requirements: audit.requirements.map(
        ({ sourceData, subrequirements, ...req }) => ({
            ...req,

            category: String(
                sourceData?.CATEGORY ?? ""
            ).trim(),

            displayTitle:
                String(sourceData?.LABEL ?? "").trim() ||
                req.title ||
                req.sourceName ||
                `Requirement ${req.sourceRtabx}`,

            hiddenInSource:
                String(sourceData?.HIDDEN ?? "").trim() === "H",

            subrequirements: subrequirements.map(
                ({ sourceData: subSource, ...sub }) => ({
                    ...sub,

                    displayTitle:
                        String(subSource?.LABEL ?? "").trim() ||
                        sub.title ||
                        `Subrequirement ${sub.sourceStabx}`,

                    hiddenInSource:
                        String(subSource?.HIDDEN ?? "").trim() === "H"
                })
            )
        })
    )
};

res.set("Cache-Control", "no-store");
return res.json({ audit: organizedAudit });


    } catch (error) {
        console.error("Audit details error:", error);

        return res.status(500).json({
            error: "Unable to retrieve audit details."
        });
    }
});

router.get("/academic-progress", async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: {
                role: true,
                studentRecord: {
                    select: { id: true }
                }
            }
        });

        if (!user) {
            return res.status(401).json({
                error: "Account not found."
            });
        }

        if (user.role !== "STUDENT") {
            return res.status(403).json({
                error: "Student access only."
            });
        }

        if (!user.studentRecord) {
            return res.status(404).json({
                error: "No linked student record."
            });
        }

        const audit = await prisma.degreeAudit.findFirst({
            where: {
                studentRecordId: user.studentRecord.id
            },
            orderBy: { runDate: "desc" },
            select: {
                programTitle: true,
                runDate: true,
                requirements: {
                    select: {
                        sourceRtabx: true,
                        sourceData: true
                    }
                }
            }
        });

        if (!audit) {
            return res.status(404).json({
                error: "No degree audit found."
            });
        }

        const cumulative = audit.requirements.find(req =>
            String(req.sourceData?.CATEGORY ?? "")
                .trim()
                .toUpperCase() === "CUM UNITS & GPA"
        );

        if (!cumulative) {
            return res.status(404).json({
                error: "Cumulative academic data unavailable."
            });
        }

        const source = cumulative.sourceData;

        function numberOrNull(value) {
            const text = String(value ?? "").trim();

            if (text === "") return null;

            const number = Number(text);

            return Number.isFinite(number) ? number : null;
        }

        const progress = {
            programTitle: audit.programTitle,
            auditDate: audit.runDate,
            requiredUnits: numberOrNull(source.REQHRS),
            recordedUnits: numberOrNull(source.GOTHRS),
            remainingUnits: numberOrNull(source.NEEDHRS),
            cumulativeGPA: numberOrNull(source.GOTGPA)
        };

        res.set("Cache-Control", "no-store");

        return res.json({
            progress,
            note: "Values from the imported degree audit."
        });

    } catch (error) {
        console.error("Academic progress error:", error);

        return res.status(500).json({
            error: "Unable to retrieve academic progress."
        });
    }
});

module.exports = router;
