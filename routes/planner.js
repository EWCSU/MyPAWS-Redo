const express = require("express");
const { PrismaClient } = require("@prisma/client");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

const VALID_TERMS = ["Winter", "Spring", "Summer", "Fall"];

function normalizeTerm(term) {
  return VALID_TERMS.find(value => value.toLowerCase() === String(term ?? "").trim().toLowerCase());
}

// Finds the logged-in student's record, or sends the right error and returns null.
async function requireStudentRecord(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true, studentRecord: { select: { id: true } } }
  });
  if (!user) { res.status(401).json({ error: "Account not found." }); return null; }
  if (user.role !== "STUDENT") { res.status(403).json({ error: "Student access only." }); return null; }
  if (!user.studentRecord) { res.status(404).json({ error: "No linked student record." }); return null; }
  return user.studentRecord;
}

// Everything the planner page needs in one call. Terms come from two places:
// terms the student added explicitly, and terms that already hold courses
// (for example ones created on the older MyCAPS form).
router.get("/", async (req, res) => {
  try {
    const record = await requireStudentRecord(req, res);
    if (!record) return;

    const plan = await prisma.academicPlan.findUnique({
      where: { studentRecordId: record.id },
      include: {
        courses: { orderBy: [{ year: "asc" }, { term: "asc" }, { courseCode: "asc" }] },
        terms: true
      }
    });

    const courses = plan?.courses || [];
    const terms = new Map();
    for (const item of [...(plan?.terms || []), ...courses]) {
      terms.set(`${item.year}-${item.term}`, { term: item.term, year: item.year });
    }

    res.set("Cache-Control", "no-store");
    return res.json({
      terms: [...terms.values()],
      courses,
      note: "Student-created plan. Not an official CSUSB enrollment record."
    });
  } catch (error) {
    console.error("Planner load error:", error);
    return res.status(500).json({ error: "Unable to load your plan." });
  }
});

router.post("/terms", async (req, res) => {
  try {
    const record = await requireStudentRecord(req, res);
    if (!record) return;

    const term = normalizeTerm(req.body?.term);
    const year = req.body?.year;
    if (!term || !Number.isInteger(year) || year < 2020 || year > 2100) {
      return res.status(400).json({ error: "Choose a valid semester and year." });
    }

    const plan = await prisma.academicPlan.upsert({
      where: { studentRecordId: record.id },
      update: {},
      create: { studentRecordId: record.id }
    });

    await prisma.plannedTerm.upsert({
      where: { academicPlanId_term_year: { academicPlanId: plan.id, term, year } },
      update: {},
      create: { academicPlanId: plan.id, term, year }
    });

    res.set("Cache-Control", "no-store");
    return res.status(201).json({ term: { term, year } });
  } catch (error) {
    console.error("Planner add-term error:", error);
    return res.status(500).json({ error: "Unable to add that term." });
  }
});

router.delete("/terms/:year/:term", async (req, res) => {
  try {
    const record = await requireStudentRecord(req, res);
    if (!record) return;

    const term = normalizeTerm(req.params.term);
    const year = Number(req.params.year);
    if (!term || !Number.isInteger(year)) {
      return res.status(400).json({ error: "Invalid semester or year." });
    }

    const plan = await prisma.academicPlan.findUnique({
      where: { studentRecordId: record.id },
      select: { id: true }
    });
    if (!plan) return res.json({ message: "Term removed." });

    const inTerm = await prisma.plannedCourse.count({
      where: { academicPlanId: plan.id, term, year }
    });
    if (inTerm > 0) {
      return res.status(409).json({ error: "Move or remove the courses in this term first." });
    }

    await prisma.plannedTerm.deleteMany({ where: { academicPlanId: plan.id, term, year } });
    res.set("Cache-Control", "no-store");
    return res.json({ message: "Term removed." });
  } catch (error) {
    console.error("Planner delete-term error:", error);
    return res.status(500).json({ error: "Unable to remove that term." });
  }
});

module.exports = router;
