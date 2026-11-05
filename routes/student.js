
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
			sourceName: true,
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
	
const findCategory = category =>
    audit.requirements.find(req =>
        String(req.sourceData?.CATEGORY ?? "")
            .trim().toUpperCase() === category
    );

const overallGPA = findCategory("CUM 2.0 GPA");
const csusbGPA = findCategory("CSUSB GPA");

const majorGPA = audit.requirements.find(req =>
    String(req.sourceName ?? "")
        .trim().toUpperCase().endsWith("-AVE") &&
    String(req.sourceData?.CATEGORY ?? "")
        .trim().toUpperCase() === "MAJOR"
);

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
            
cumulativeGPA: numberOrNull(overallGPA?.sourceData?.GOTGPA),
csusbGPA: numberOrNull(csusbGPA?.sourceData?.GOTHRS) === 0
    ? null
    : numberOrNull(csusbGPA?.sourceData?.GOTGPA),
majorGPA: numberOrNull(majorGPA?.sourceData?.GOTGPA)

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

router.get("/coursework", async (req, res) => {
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
                runDate: true
            }
        });

        if (!audit) {
            return res.status(404).json({
                error: "No degree audit found."
            });
        }

        const records = await prisma.auditCourse.findMany({
            where: {
                subrequirement: {
                    is: {
                        requirement: {
                            is: {
                                degreeAuditId: audit.id
                            }
                        }
                    }
                }
            },
            select: {
                courseCode: true,
                courseTitle: true,
                grade: true,
                credits: true,
                termCode: true,
                inProgressCode: true
            }
        });

        const normalize = value =>
            String(value ?? "").trim().toUpperCase();

        // Remove repeated appearances of the same
        // course, term, grade, and progress indicator.
        const unique = new Map();

        for (const record of records) {
            const key = JSON.stringify([
                normalize(record.courseCode),
                normalize(record.termCode),
                normalize(record.grade),
                normalize(record.inProgressCode)
            ]);

            if (!unique.has(key)) {
                unique.set(key, {
                    courseCode: record.courseCode,
                    courseTitle: record.courseTitle,
                    grade: normalize(record.grade),
                    credits: record.credits?.toString() ?? null,
                    termCode: record.termCode,
                    inProgressCode: normalize(record.inProgressCode)
                });
            }
        }

        const coursework = {
            letterGraded: [],
            inProgress: [],
            otherResults: []
        };

        for (const course of unique.values()) {
            if (
                course.inProgressCode === "I" &&
                course.grade === "RG"
            ) {
                coursework.inProgress.push(course);

            } else if (
                course.inProgressCode === "I" ||
                course.grade === "RG"
            ) {
                coursework.otherResults.push(course);

            } else if (
                /^(A|B|C|D|F)[+-]?$/.test(course.grade)
            ) {
                coursework.letterGraded.push(course);

            } else {
                coursework.otherResults.push(course);
            }
        }

        for (const group of Object.values(coursework)) {
            group.sort((a, b) =>
                String(b.termCode ?? "").localeCompare(
                    String(a.termCode ?? "")
                ) ||
                a.courseCode.localeCompare(b.courseCode)
            );
        }

        res.set("Cache-Control", "no-store");

        return res.json({
            auditDate: audit.runDate,
            programTitle: audit.programTitle,
            counts: {
                total: unique.size,
                letterGraded: coursework.letterGraded.length,
                inProgress: coursework.inProgress.length,
                otherResults: coursework.otherResults.length
            },
            coursework,
            note: "Course listings are deduplicated by source " +
                "course, term, grade, and progress indicator. " +
                "Letter-graded does not necessarily mean completed."
        });

    } catch (error) {
        console.error("Coursework API error:", error);

        return res.status(500).json({
            error: "Unable to retrieve coursework."
        });
    }
});

router.get("/remaining-course-options", async (req, res) => {
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
                runDate: true
            }
        });

        if (!audit) {
            return res.status(404).json({
                error: "No degree audit found."
            });
        }

        const records = await prisma.degreeRequirement.findMany({
            where: {
                degreeAuditId: audit.id,
                satisfiedCode: { in: ["N", "I"] }
            },
            select: {
                sourceRtabx: true,
                title: true,
                sourceName: true,
                satisfiedCode: true,
                sourceData: true,
                subrequirements: {
                    where: {
                        satisfiedCode: { in: ["N", "I"] }
                    },
                    select: {
                        sourceStabx: true,
                        title: true,
                        satisfiedCode: true,
                        sourceData: true,
                        allowableCourseRules: {
                            select: {
                                coursePattern: true,
                                ruleType: true
                            }
                        }
                    }
                }
            }
        });

        const normalize = value =>
            String(value ?? "").trim().toUpperCase();

        
function isCourseLike(value) {
    return /^[A-Z]{2,5}\s*\d{4}[A-Z]?$/
        .test(normalize(value));
}


        function uniquePatterns(rules, type) {
            return [...new Set(
                rules
                    .filter(rule =>
                        normalize(rule.ruleType) === type
                    )
                    .map(rule =>
                        normalize(rule.coursePattern)
                    )
                    .filter(isCourseLike)
            )].sort();
        }

        const requirements = records
            .filter(req => {
                const category = normalize(
                    req.sourceData?.CATEGORY
                );

                return category === "GENERAL EDUC" ||
                    category === "MAJOR" ||
                    category.includes("ELECTIVE");
            })
            .map(req => ({
                requirementCode: req.sourceRtabx,
                title:
                    String(req.sourceData?.LABEL ?? "").trim() ||
                    req.title ||
                    req.sourceName,
                category: normalize(req.sourceData?.CATEGORY),
                statusCode: req.satisfiedCode,

                subrequirements: req.subrequirements.map(sub => {
                    const rules = sub.allowableCourseRules;

                    return {
                        title:
                            String(sub.sourceData?.LABEL ?? "").trim() ||
                            sub.title ||
                            `Subrequirement ${sub.sourceStabx}`,

                        statusCode: sub.satisfiedCode,

                        aCodedCoursePatterns:
                            uniquePatterns(rules, "A"),

                        rCodedCoursePatterns:
                            uniquePatterns(rules, "R"),

                        otherPatternCount: rules.filter(rule =>
                            !isCourseLike(rule.coursePattern)
                        ).length
                    };
                })
            }));

        res.set("Cache-Control", "no-store");

        return res.json({
            programTitle: audit.programTitle,
            auditDate: audit.runDate,
            requirementCount: requirements.length,
            requirements,
            note: "These are source course patterns, not confirmed " +
                "recommendations. Eligibility, prerequisites, prior " +
                "coursework, and restrictions require verification."
        });

    } catch (error) {
        console.error("Remaining course options error:", error);

        return res.status(500).json({
            error: "Unable to retrieve course options."
        });
    }
});

module.exports = router;
