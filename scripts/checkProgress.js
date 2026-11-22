// Accuracy check for one student's progress numbers.
// Usage: node scripts/checkProgress.js STUDENT_NUMBER
// Prints the numbers the charts will show plus anything in the imported data that
// could make them misleading. It prints counts only, never names or course lists.
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { buildProgressOverview, classifyCourse } = require("../utils/progressOverview");
const { applyAuditReview } = require("../utils/auditReview");
const { courseKey } = require("../utils/auditLogic");

const prisma = new PrismaClient();

const AUDIT_SELECT = {
  id: true, sourceAuditSequence: true, programCode: true, programTitle: true, runDate: true,
  requirements: { select: {
    title: true, sourceName: true, sourceRtabx: true, satisfiedCode: true, sourceData: true,
    subrequirements: { select: {
      title: true, sourceStabx: true, satisfiedCode: true, sourceData: true,
      courses: { select: { courseCode: true, grade: true, credits: true, termCode: true, inProgressCode: true } }
    } }
  } }
};

const tally = values => values.reduce((counts, value) => ({ ...counts, [value]: (counts[value] || 0) + 1 }), {});
const show = counts => Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k || "(blank)"}: ${v}`).join(", ") || "none";

async function main() {
  const studentNumber = process.argv[2];
  if (!studentNumber) { console.log("Usage: node scripts/checkProgress.js STUDENT_NUMBER"); return; }

  const record = await prisma.studentRecord.findUnique({
    where: { studentNumber },
    select: { id: true, userId: true, degreeAudits: { orderBy: { runDate: "desc" }, select: { id: true, runDate: true, programCode: true } } }
  });
  if (!record) { console.log(`No student record with number ${studentNumber}.`); return; }

  console.log(`Student ${studentNumber}: ${record.degreeAudits.length} audit(s), account linked: ${record.userId ? "yes" : "NO"}`);
  if (!record.degreeAudits.length) return;

  const audit = await prisma.degreeAudit.findUnique({ where: { id: record.degreeAudits[0].id }, select: AUDIT_SELECT });
  const reviewed = applyAuditReview(audit);
  const overview = buildProgressOverview(audit);

  console.log(`\nLatest audit: ${audit.programTitle} (run ${new Date(audit.runDate).toISOString().slice(0, 10)})`);
  console.log(`Reviewed corrections applied: ${reviewed.review ? "yes (" + reviewed.review.date + ")" : "no"}`);

  console.log("\n--- Numbers the charts will show ---");
  console.log("Sections:", JSON.stringify(overview.sections));
  console.log("Units:", JSON.stringify(overview.units));
  overview.gpas.forEach(gpa => console.log(`${gpa.label}: ${gpa.value === null ? "not available (" + gpa.explanation + ")" : gpa.value}`));
  console.log("Courses:", JSON.stringify(overview.courses));
  console.log(`Still needed: ${overview.needed.unfulfilledSections} section(s), about ${overview.needed.coursesApprox ?? "n/a"} course(s)`);

  console.log("\n--- Things to confirm against the official report ---");
  const attempts = [];
  reviewed.requirements.forEach(req => (req.subrequirements || []).forEach(sub => (sub.courses || []).forEach(c => attempts.push(c))));
  const unique = new Map();
  attempts.forEach(c => unique.set(JSON.stringify([courseKey(c.courseCode), c.termCode, c.grade, c.inProgressCode]), c));
  const courses = [...unique.values()];

  console.log("Grades found:", show(tally(courses.map(c => String(c.grade ?? "").trim().toUpperCase()))));
  console.log("How they are counted:", show(tally(courses.map(classifyCourse))));
  const odd = courses.filter(c => classifyCourse(c) === "other").map(c => String(c.grade ?? "").trim().toUpperCase());
  if (odd.length) console.log(`  -> ${odd.length} record(s) fall in "other" (${show(tally(odd))}). If any of these should count as completed, say so and the rule can be added.`);
  console.log("Requirement status codes:", show(tally(reviewed.requirements.map(r => r.satisfiedCode))));

  const noCredit = courses.filter(c => !(Number(c.credits?.toString?.() ?? c.credits) > 0)).length;
  if (noCredit) console.log(`  -> ${noCredit} course record(s) have no credit value.`);

  const { required, recorded, needed } = overview.units;
  if ([required, recorded, needed].every(v => v !== null) && recorded + needed !== required) {
    console.log(`  -> Units: recorded (${recorded}) + needed (${needed}) = ${recorded + needed}, but required is ${required}. Excess units or a source rule may explain it.`);
  }
  const majors = overview.gpas.filter(g => g.key.startsWith("major-"));
  if (majors.length > 1) console.log(`  -> ${majors.length} major GPA rows found; confirm each against the official report.`);
  if (record.degreeAudits.length > 1) console.log(`  -> ${record.degreeAudits.length} audits exist; the dashboard uses the newest (${new Date(record.degreeAudits[0].runDate).toISOString().slice(0, 10)}).`);

  console.log("\nCompare these against the student's official degree audit report: overall GPA, units recorded and needed, which sections are unfulfilled, and the number of completed courses.");
}

main().catch(err => console.error("Error:", err.message)).finally(() => prisma.$disconnect());
