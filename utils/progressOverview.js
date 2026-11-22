const { organizeAudit, courseKey } = require("./auditLogic");
const { applyAuditReview } = require("./auditReview");
const { auditGpa } = require("./auditGpa");

const text = value => String(value ?? "").trim();
const norm = value => text(value).toUpperCase();
const number = value => text(value) !== "" && Number.isFinite(Number(value)) ? Number(value) : null;

// The audit uses 900+ as a "not applicable" placeholder in its NEED* fields,
// the same convention utils/auditLogic.js already relies on.
const needed = value => {
  const n = number(value);
  return n !== null && n > 0 && n < 900 ? n : null;
};

// Letter grades that earn credit. F is kept separate on purpose: the existing
// Coursework page calls any A-F grade "letter-graded", which includes failures.
const PASSING = /^[ABCD][+-]?$/;

function classifyCourse(course) {
  const grade = norm(course.grade);
  const progress = norm(course.inProgressCode);
  if (progress === "I" && grade === "RG") return "inProgress";
  if (progress === "I" || grade === "RG") return "other";
  if (PASSING.test(grade)) return "passed";
  if (grade === "F") return "failed";
  return "other";
}

function requirementGroup(req) {
  const category = norm(req.category);
  if (category === "GENERAL EDUC") return "General Education";
  if (category === "MAJOR") return "Major";
  if (category.includes("ELECTIVE")) return "Electives";
  if (category.includes("GPA") || category.startsWith("MIN ") ||
      category === "INSTITUTIONS" || category.includes("DESIGNATION")) return "University";
  return "Other";
}

const STATUS_KEY = {
  completed: "completed",
  "in-progress": "inProgress",
  unfulfilled: "needsAttention",
  unverified: "needsReview"
};

function emptyCounts() {
  return { completed: 0, inProgress: 0, needsAttention: 0, needsReview: 0 };
}

// rawAudit: one degree audit with requirements -> subrequirements -> courses,
// as selected in routes/progress.js. `reviews` is optional and only used by tests.
function buildProgressOverview(rawAudit, reviews) {
  // Same review layer the audit page uses, so charts and audit page agree.
  const reviewed = applyAuditReview(rawAudit, reviews);
  const organized = organizeAudit(reviewed);
  const sourceByCode = new Map(reviewed.requirements.map(req => [req.sourceRtabx, req.sourceData || {}]));

  // ---- requirement sections --------------------------------------------
  const academic = organized.requirements.filter(req => req.academic);
  const sections = { ...emptyCounts(), total: academic.length };
  const groupMap = new Map();
  const unitsBySection = [];
  let coursesNeeded = 0;
  let unfulfilledSections = 0;

  for (const req of academic) {
    const key = STATUS_KEY[req.status] || "needsReview";
    sections[key]++;
    const group = requirementGroup(req);
    if (!groupMap.has(group)) groupMap.set(group, { name: group, ...emptyCounts() });
    groupMap.get(group)[key]++;

    if (key === "needsAttention") {
      unfulfilledSections++;
      const source = sourceByCode.get(req.sourceRtabx) || {};
      const units = needed(source.NEEDHRS);
      const courses = needed(source.NEEDCT);
      if (units) unitsBySection.push({ title: req.displayTitle, units, group });
      if (courses) coursesNeeded += courses;
    }
  }
  unitsBySection.sort((a, b) => b.units - a.units);

  // ---- units and GPA (read from the reviewed source values) -------------
  const sourceOf = predicate => (reviewed.requirements.find(predicate) || {}).sourceData;
  const category = value => req => norm(req.sourceData?.CATEGORY) === value;
  const cumulative = sourceOf(category("CUM UNITS & GPA"));
  const overall = sourceOf(category("CUM 2.0 GPA"));
  const csusb = sourceOf(category("CSUSB GPA"));
  const majors = reviewed.requirements.filter(req =>
    norm(req.sourceName).endsWith("-AVE") && norm(req.sourceData?.CATEGORY) === "MAJOR");

  const gpaRow = (key, label, source) => ({
    key, label, ...auditGpa(source), required: number(source?.REQGPA)
  });
  const gpas = [
    gpaRow("overall", "Overall GPA", overall),
    gpaRow("csusb", "CSUSB GPA", csusb),
    ...majors.map(req => gpaRow("major-" + text(req.sourceName),
      majors.length > 1 ? `Major GPA (${req.sourceName.trim()})` : "Major GPA", req.sourceData))
  ];

  // ---- courses -----------------------------------------------------------
  // Same scope as the Coursework page: every course in the audit, with one
  // record per (course, term, grade, in-progress code) so a course that appears
  // under several requirements is not counted twice.
  const seenAttempts = new Set();
  const attemptsByCourse = new Map();
  for (const req of reviewed.requirements) {
    for (const sub of req.subrequirements || []) {
      for (const course of sub.courses || []) {
        const key = courseKey(course.courseCode);
        if (!key) continue;
        const attempt = JSON.stringify([key, norm(course.termCode), norm(course.grade), norm(course.inProgressCode)]);
        if (seenAttempts.has(attempt)) continue;
        seenAttempts.add(attempt);
        if (!attemptsByCourse.has(key)) attemptsByCourse.set(key, []);
        attemptsByCourse.get(key).push(course);
      }
    }
  }

  const courses = { passed: 0, inProgress: 0, failedOnly: 0, other: 0, total: attemptsByCourse.size, repeated: 0, inProgressUnits: 0 };
  for (const attempts of attemptsByCourse.values()) {
    const outcomes = attempts.map(classifyCourse);
    if (attempts.length > 1) courses.repeated++;
    // One outcome per distinct course: a later failure never erases an earlier pass.
    if (outcomes.includes("passed")) courses.passed++;
    else if (outcomes.includes("inProgress")) courses.inProgress++;
    else if (outcomes.includes("failed")) courses.failedOnly++;
    else courses.other++;
    attempts.forEach((course, index) => {
      if (outcomes[index] === "inProgress") {
        courses.inProgressUnits += number(course.credits?.toString?.() ?? course.credits) || 0;
      }
    });
  }

  const units = {
    required: number(cumulative?.REQHRS),
    recorded: number(cumulative?.GOTHRS),
    needed: number(cumulative?.NEEDHRS),
    inProgress: courses.inProgressUnits
  };

  // ---- plain-language caveats shown with the charts ------------------------
  const notes = [];
  if (reviewed.review) {
    notes.push(`Statuses and figures reflect the review of your official report dated ${reviewed.review.date}.`);
  }
  notes.push("Recorded units come from the imported audit and can include in-progress coursework.");
  if (courses.other) {
    notes.push(`${courses.other} course${courses.other === 1 ? " has" : "s have"} a result this portal does not classify (for example transfer, credit/no-credit, or withdrawal). ${courses.other === 1 ? "It is" : "They are"} not counted as completed; confirm with your advisor.`);
  }
  if (courses.failedOnly) {
    notes.push(`${courses.failedOnly} course${courses.failedOnly === 1 ? " shows" : "s show"} only a failing grade and ${courses.failedOnly === 1 ? "is" : "are"} not counted as completed.`);
  }
  if (!cumulative) notes.push("Cumulative unit data is not available in this audit.");

  return {
    program: organized.programTitle || null,
    auditDate: organized.runDate || null,
    reviewed: reviewed.review || null,
    sections,
    groups: [...groupMap.values()],
    units,
    gpas,
    courses,
    needed: {
      unfulfilledSections,
      // Sum of the audit's own "courses still needed" for each unfulfilled
      // section. Sections can overlap, so this is an estimate, not a schedule.
      coursesApprox: coursesNeeded || null,
      unitsBySection: unitsBySection.slice(0, 8)
    },
    notes
  };
}

module.exports = { buildProgressOverview, classifyCourse, requirementGroup };
