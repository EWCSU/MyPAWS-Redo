const { courseKey } = require("./auditLogic");

// Reviewed semester prerequisites from the 2026–27 CSUSB catalog.
// This is deliberately partial. Absence means unknown, never unrestricted.
const cseSource = "https://catalog.csusb.edu/coursesaz/cse/";
const mathSource = "https://catalog.csusb.edu/coursesaz/math/";
const rules = {
  MATH2220: { any: [["MATH2210", "C-"], ["MATH2120Q2S", "C-"]], source: mathSource },
  CSE2020: { all: [["CSE2010", "C"], ["MATH2372"]], source: cseSource },
  CSE2130: { all: [["CSE2010"]], source: cseSource },
  CSE3100: { all: [["CSE2010"], ["MATH2372"]], source: cseSource },
  CSE3350: { all: [["MATH2220"], ["MATH2310"]], source: cseSource },
  CSE4010: { all: [["CSE3100"], ["CSE2130"]], source: cseSource },
  CSE4030: { all: [["CSE3100"], ["CSE3350"]], source: cseSource },
  CSE4050: { all: [["CSE2020"]], source: cseSource },
  CSE4200: { all: [["CSE2020"], ["MATH2310"]], source: cseSource },
  CSE4310: { all: [["CSE2020"], ["MATH2310"]], source: cseSource },
  CSE4400: { all: [["CSE2020"]], source: cseSource },
  CSE4410: { all: [["CSE2020"]], source: cseSource },
  CSE4550: { all: [["CSE2020"]], source: cseSource },
  CSE4560: { all: [["CSE3100"], ["CSE2130"]], source: cseSource },
  CSE4600: { all: [["CSE2020"], ["CSE2130"]], source: cseSource }
};
const grades = { "A+": 4, A: 4, "A-": 3.7, "B+": 3.3, B: 3, "B-": 2.7,
  "C+": 2.3, C: 2, "C-": 1.7, "D+": 1.3, D: 1, "D-": 0.7, F: 0 };

function checkPrerequisites(code, coursework) {
  const rule = rules[courseKey(code)];
  if (!rule) return { status: "unknown", message: "Prerequisites have not been verified for this course. Review the official catalog before planning enrollment.", source: "https://catalog.csusb.edu/coursesaz/", requirements: [] };
  const requirements = (rule.all || rule.any).map(([courseCode, minimumGrade]) => {
    const attempts = coursework.filter(c => courseKey(c.courseCode) === courseCode);
    const satisfied = attempts.some(c => {
      const grade = String(c.grade || "").trim().toUpperCase();
      return String(c.inProgressCode || "").trim().toUpperCase() !== "I" &&
        Number(c.credits) > 0 && grades[grade] > 0 &&
        (!minimumGrade || grades[grade] >= grades[minimumGrade]);
    });
    return { courseCode, minimumGrade: minimumGrade || null, satisfied,
      inProgress: !satisfied && attempts.some(c => String(c.inProgressCode || "").trim().toUpperCase() === "I") };
  });
  const met = rule.all ? requirements.every(r => r.satisfied) : requirements.some(r => r.satisfied);
  return { status: met ? "recorded-prerequisites-met" : "needs-review", source: rule.source,
    catalogYear: "2026–27", operator: rule.all ? "all" : "any", requirements,
    message: met ? "Recorded coursework meets the listed prerequisites. Catalog applicability, transfer equivalencies, and enrollment restrictions still require confirmation."
      : "Warning: prerequisite completion is not established by this audit. Complete the prerequisite courses below or confirm an approved equivalent before enrolling." };
}
module.exports = { checkPrerequisites };
