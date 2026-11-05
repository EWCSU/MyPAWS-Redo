const text = value => String(value ?? "").trim();
const norm = value => text(value).toUpperCase();
const courseKey = value => norm(value).replace(/\s+/g, "");
const number = value => text(value) !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
const { applyAuditReview } = require("./auditReview");

const requirementNames = {
  "CUM UNITS & GPA": "Total units toward graduation",
  "CUM 2.0 GPA": "Overall GPA requirement",
  "CSUSB GPA": "CSUSB GPA requirement",
  "MIN CSUSB": "Units completed at CSUSB",
  "MIN UD CSUSB": "Upper-division units completed at CSUSB",
  "MIN MAJOR CSUSB": "Major units completed at CSUSB",
  "MIN GE CSUSB": "General education units completed at CSUSB",
  "MIN GE": "Total general education units",
  INSTITUTIONS: "U.S. history, constitution, and California government",
  "WI DESIGNATION": "Writing-intensive coursework",
  "DI DESIGNATION": "Diversity and inclusiveness",
  "GP DESIGNATION": "Global perspectives"
};
const majorNames = {
  "CSCI-AVE": "Computer Science major overview", CSCILDSEM: "Lower-division Computer Science",
  CSCIUDSEM: "Upper-division Computer Science", CSCIELECT: "Computer Science electives",
  "COEN-AVE": "Computer Engineering major overview", LDCOMPENG: "Lower-division Computer Engineering",
  UDCOMPENG: "Upper-division Computer Engineering", "CSGD-AVE": "Game Development major overview",
  "CSGD-CORE": "Computer Systems core", CSGAMEDEV: "Game Development concentration"
};

function catalogGuidance(requirement, subrequirement) {
  const name = norm(requirement.sourceName);
  const year = text(requirement.sourceData?.CATLYT);
  const title = norm(subrequirement.sourceData?.STITLE || subrequirement.title);
  const electiveRules = [
    { name: "UDCOMPENG", year: "20244", title: "CSE ELECTIVES NUMBERED 4000 AND ABOVE",
      units: 9, catalogYear: "2024-25", program: "computer-engineering-bs" },
    { name: "CSCIELECT", year: "20254", title: "CSE ELECTIVES 4000-LEVEL AND ABOVE",
      units: 12, catalogYear: "2025-26", program: "computer-science-bs" }
  ];
  const elective = electiveRules.find(rule => rule.name === name && rule.year === year && rule.title === title);
  if (elective) {
    return {
      title: "Upper-division CSE elective requirements",
      description: `This section requires ${elective.units} total units of CSE courses numbered 4000 or above that have not previously been taken. This is the section total, not the number of additional units you need. Use the audit status and remaining-unit explanation above to see what is outstanding.`,
      nextStep: norm(subrequirement.satisfiedCode) === "I"
        ? "This section is already covered by in-progress coursework in the imported audit. Finish the courses applied here; this catalog rule is not a recommendation to add more electives."
        : "Browse CSE course descriptions for eligible subjects. Check prerequisite and enrollment restrictions, and confirm how the course applies in your audit before planning it. Do not assume a course already used elsewhere can also count here.",
      catalogYear: elective.catalogYear,
      programUrl: `https://catalog.csusb.edu/archive/${elective.catalogYear}/colleges-schools-departments/natural-sciences/computer-science-engineering/${elective.program}/`,
      coursesUrl: "https://catalog.csusb.edu/coursesaz/cse/"
    };
  }
  // Verified against the supplied 2026-27 BA Computer Systems catalog, p. 4.
  // Keep this guidance scoped to the matching concentration and catalog.
  if (norm(requirement.sourceName) !== "CSGAMEDEV" ||
      text(requirement.sourceData?.CATLYT) !== "20264" ||
      norm(subrequirement.sourceData?.STITLE || subrequirement.title) !==
        "THREE UNITS OF GAME DEVELOPMENT ELECTIVES") return null;
  return {
    title: "Game Development supporting elective - department approval required",
    description: "Complete three units of supporting coursework related to game development. Search the CSUSB catalog for courses involving 3D modeling, animation, level design, image editing, or other game-development topics.",
    nextStep: "Ask the School of Computer Science and Engineering to approve your chosen coursework before relying on it for this requirement. Check the course prerequisites before enrolling. This requirement stays incomplete until approved coursework is applied in your official audit.",
    catalogYear: "2026-27",
    programUrl: "https://catalog.csusb.edu/colleges-schools-departments/natural-sciences/computer-science-engineering/computer-systems-ba/",
    coursesUrl: "https://catalog.csusb.edu/coursesaz/"
  };
}

// Preserve the audit engine's decision. Child counts alone cannot resolve OR,
// optional, GPA, residency, substitution, and reuse rules.
function describe(record) {
  const source = record.sourceData || {};
  const code = norm(record.satisfiedCode);
  const status = { C: "completed", N: "unfulfilled", I: "in-progress" }[code] || "unverified";
  const reasons = [];
  if (record.reviewNote) reasons.push(record.reviewNote);
  if (status === "completed") reasons.push("Completed according to the imported audit.");
  else if (status === "in-progress") reasons.push("The audit marks this requirement in progress. Completion is conditional on successful completion of the coursework applied to it.");
  else if (status === "unverified") reasons.push("This source status requires verification; it is not treated as completed or as an additional requirement.");
  else {
    for (const [field, label] of [["NEEDHRS", "units"], ["NEEDCT", "courses"], ["NEEDSRQ", "subrequirements"]]) {
      const needed = number(source[field]);
      if (needed > 0 && needed < 900) reasons.push(`The audit reports ${needed} ${label} still needed in this section.`);
    }
    const requiredGpa = number(source.REQGPA), actualGpa = number(source.GOTGPA);
    if (requiredGpa > 0 && actualGpa !== null && actualGpa < requiredGpa) {
      reasons.push(`Required GPA: ${requiredGpa}; recorded GPA: ${actualGpa}.`);
    }
    if (!reasons.length) reasons.push("The audit marks this requirement unfulfilled. Its detailed conditions need review; zero remaining units does not establish completion.");
  }
  return { status, statusCode: code, reasons };
}

function isAcademic(req) {
  const source = req.sourceData || {};
  return norm(source.HIDDEN) !== "H" && !text(source.OPTREQ) &&
    text(req.sourceRtabx) !== "00" &&
    !["LEGEND", "REJECT", "RECORD", "CALCELECT"].includes(norm(req.sourceName)) &&
    norm(source.CATEGORY) !== "RECORD";
}

function organizeAudit(audit) {
  audit = applyAuditReview(audit);
  return { ...audit, presentationVersion: 2, requirements: audit.requirements.map(req => {
    const { sourceData: source = {}, subrequirements = [], ...rest } = req;
    return { ...rest, ...describe(req), academic: isAcademic(req),
      category: norm(source?.CATEGORY), hiddenInSource: norm(source?.HIDDEN) === "H",
      displayTitle: majorNames[norm(req.sourceName)] || requirementNames[norm(source?.CATEGORY)] ||
        text(source?.LABEL) || text(req.title) || text(req.sourceName),
      subrequirements: subrequirements.map(sub => {
        const { sourceData: data = {}, allowableCourseRules, courses = [], ...fields } = sub;
        return { ...fields, ...describe(sub),
          courses: courses.map(({ sourceData, ...course }) => course),
          displayTitle: text(data?.LABEL) || text(sub.title) || `Subrequirement ${sub.sourceStabx}`,
          hiddenInSource: norm(data?.HIDDEN) === "H",
          optional: Boolean(text(data?.OPTSUB)), alternative: Boolean(text(data?.ORSUB)) };
      }) };
  }) };
}

function remainingRequirements(audit) {
  const organized = organizeAudit(audit);
  return organized.requirements.filter(req => req.academic && req.status !== "completed").map(req => {
    const raw = audit.requirements.find(r => r.sourceRtabx === req.sourceRtabx);
    return { ...req, requirementCode: req.sourceRtabx, title: req.displayTitle,
      subrequirements: req.subrequirements.filter(sub => !sub.hiddenInSource && !sub.optional && sub.status !== "completed").map(sub => {
        const original = raw.subrequirements.find(s => s.sourceStabx === sub.sourceStabx);
        const rules = original.allowableCourseRules || [];
        const patterns = type => [...new Set(rules.filter(r => norm(r.ruleType) === type)
          .map(r => norm(r.coursePattern)).filter(p => /^[A-Z]{2,5}\s*\d{4}[A-Z]?$/.test(p)))].sort();
        // R entries match the official report's "NOT FROM" exclusions.
        // Exact exclusions take precedence; referenced lists/ranges still
        // need resolution and must not be expanded by guessing.
        const excluded = patterns("R");
        const excludedKeys = new Set(excluded.map(courseKey));
        return { ...sub, title: sub.displayTitle,
          catalogGuidance: catalogGuidance(raw, original),
          aCodedCoursePatterns: patterns("A").filter(code => !excludedKeys.has(courseKey(code))),
          rCodedCoursePatterns: excluded,
          otherPatternCount: rules.filter(r => !/^[A-Z]{2,5}\s*\d{4}[A-Z]?$/.test(norm(r.coursePattern))).length };
      }) };
  });
}

module.exports = { describe, isAcademic, organizeAudit, remainingRequirements, courseKey, catalogGuidance };
