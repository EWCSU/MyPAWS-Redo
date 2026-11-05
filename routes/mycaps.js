
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
const prisma = new PrismaClient();

// All MyCAPS routes require authentication.
router.use(requireAuth);

// Retrieve the logged-in student's academic plan.
router.get("/", async (req, res) => {
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

        const plan = await prisma.academicPlan.findUnique({
            where: {
                studentRecordId: user.studentRecord.id
            },
            include: {
                courses: {
                    orderBy: [
                        { year: "asc" },
                        { term: "asc" },
                        { courseCode: "asc" }
                    ]
                }
            }
        });

        res.set("Cache-Control", "no-store");

        return res.json({
            plan: plan || { courses: [] },
            note: "Student-created academic plan. " +
                  "Not an official CSUSB enrollment record."
        });

    } catch (error) {
        console.error("MyCAPS error:", error);

        return res.status(500).json({
            error: "Unable to retrieve academic plan."
        });
    }
});

router.post("/courses", async (req, res) => {
    try {
        const {
            courseCode,
            courseTitle,
            term,
            year,
            notes
        } = req.body || {};

        // Validate student input.
        if (
            typeof courseCode !== "string" ||
            !courseCode.trim() ||
            courseCode.length > 30 ||
            typeof term !== "string" ||
            !Number.isInteger(year)
        ) {
            return res.status(400).json({
                error: "Valid course code, term, and year are required."
            });
        }

        const normalizedCode = courseCode
            .trim()
            .toUpperCase()
            .replace(/\s+/g, " ");

        if (!/^[A-Z0-9][A-Z0-9 -]*$/.test(normalizedCode)) {
            return res.status(400).json({
                error: "Invalid course code format."
            });
        }

        const validTerms = ["Spring", "Summer", "Fall", "Winter"];

        const normalizedTerm = validTerms.find(
            value => value.toLowerCase() === term.trim().toLowerCase()
        );

        if (!normalizedTerm || year < 2020 || year > 2100) {
            return res.status(400).json({
                error: "Invalid semester or year."
            });
        }

        if (
            (courseTitle != null &&
                (typeof courseTitle !== "string" ||
                 courseTitle.length > 200)) ||
            (notes != null &&
                (typeof notes !== "string" ||
                 notes.length > 500))
        ) {
            return res.status(400).json({
                error: "Invalid title or notes."
            });
        }

        // Identify the authenticated student.
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

        // Create a plan if the student doesn't have one.
        const plan = await prisma.academicPlan.upsert({
            where: {
                studentRecordId: user.studentRecord.id
            },
            update: {},
            create: {
                studentRecordId: user.studentRecord.id
            }
        });

        // Save the planned course.
        const course = await prisma.plannedCourse.create({
            data: {
                academicPlanId: plan.id,
                courseCode: normalizedCode,
                courseTitle: courseTitle?.trim() || null,
                term: normalizedTerm,
                year,
                notes: notes?.trim() || null
            }
        });

        res.set("Cache-Control", "no-store");

        return res.status(201).json({
            message: "Course added to academic plan.",
            course
        });

    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                error: "This course is already planned for that semester."
            });
        }

        console.error("MyCAPS save error:", error);

        return res.status(500).json({
            error: "Unable to save planned course."
        });
    }
});

router.delete("/courses/:id", async (req, res) => {
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

        const result = await prisma.plannedCourse.deleteMany({
            where: {
                id: req.params.id,
                academicPlan: {
                    is: {
                        studentRecordId: user.studentRecord.id
                    }
                }
            }
        });

        if (result.count === 0) {
            return res.status(404).json({
                error: "Planned course not found."
            });
        }

        res.set("Cache-Control", "no-store");

        return res.json({
            message: "Course removed from academic plan."
        });

    } catch (error) {
        console.error("MyCAPS delete error:", error);

        return res.status(500).json({
            error: "Unable to remove planned course."
        });
    }
});

router.put("/courses/:id", async (req, res) => {
    try {
        const {
            courseCode,
            courseTitle,
            term,
            year,
            notes
        } = req.body || {};

        // Validate the updated course information.
        if (
            typeof courseCode !== "string" ||
            !courseCode.trim() ||
            courseCode.length > 30 ||
            typeof term !== "string" ||
            !Number.isInteger(year)
        ) {
            return res.status(400).json({
                error: "Valid course code, semester, and year are required."
            });
        }

        const normalizedCode = courseCode
            .trim()
            .toUpperCase()
            .replace(/\s+/g, " ");

        if (!/^[A-Z0-9][A-Z0-9 -]*$/.test(normalizedCode)) {
            return res.status(400).json({
                error: "Invalid course code format."
            });
        }

        const validTerms = [
            "Spring",
            "Summer",
            "Fall",
            "Winter"
        ];

        const normalizedTerm = validTerms.find(
            value => value.toLowerCase() ===
                term.trim().toLowerCase()
        );

        if (!normalizedTerm || year < 2020 || year > 2100) {
            return res.status(400).json({
                error: "Invalid semester or year."
            });
        }

        if (
            (courseTitle != null &&
                (typeof courseTitle !== "string" ||
                 courseTitle.length > 200)) ||
            (notes != null &&
                (typeof notes !== "string" ||
                 notes.length > 500))
        ) {
            return res.status(400).json({
                error: "Invalid course title or notes."
            });
        }

        // Identify the logged-in student.
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

        // Update only a course belonging to this student.
        const result = await prisma.plannedCourse.updateMany({
            where: {
                id: req.params.id,
                academicPlan: {
                    is: {
                        studentRecordId: user.studentRecord.id
                    }
                }
            },
            data: {
                courseCode: normalizedCode,
                courseTitle: courseTitle?.trim() || null,
                term: normalizedTerm,
                year,
                notes: notes?.trim() || null
            }
        });

        if (result.count === 0) {
            return res.status(404).json({
                error: "Planned course not found."
            });
        }

        res.set("Cache-Control", "no-store");

        return res.json({
            message: "Planned course updated successfully."
        });

    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                error: "This course is already planned for that semester."
            });
        }

        console.error("MyCAPS update error:", error);

        return res.status(500).json({
            error: "Unable to update planned course."
        });
    }
});

module.exports = router;
