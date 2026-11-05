const { test } = require("node:test");
const assert = require("node:assert/strict");
const { describe, remainingRequirements, organizeAudit } = require("../utils/auditLogic");
const { checkPrerequisites } = require("../utils/prerequisites");
const { catalogGuidance } = require("../utils/auditLogic");

const req = (overrides = {}) => ({ sourceRtabx: "03", sourceName: "UNITS", satisfiedCode: "N",
  sourceData: { CATEGORY: "MIN CSUSB", NEEDHRS: "30" }, subrequirements: [], ...overrides });
test("zero units does not turn an in-progress requirement into completed", () => {
  assert.equal(describe(req({ satisfiedCode: "I", sourceData: { NEEDHRS: "0" } })).status, "in-progress");
});
test("remaining checklist includes residency and GPA but excludes hidden/optional bookkeeping", () => {
  const requirements = [req(), req({ sourceRtabx: "04", sourceData: { CATEGORY: "CSUSB GPA" } }),
    req({ sourceRtabx: "05", sourceData: { HIDDEN: "H" } }),
    req({ sourceRtabx: "06", sourceName: "ELECT", sourceData: { OPTREQ: "1", NEEDHRS: "988" } }),
    req({ sourceRtabx: "07", satisfiedCode: "C" })];
  assert.deepEqual(remainingRequirements({ requirements }).map(r => r.requirementCode), ["03", "04"]);
  assert.equal(organizeAudit({ requirements }).requirements.length, 5);
});
test("parent completion is authoritative even when an unused alternative is incomplete", () => {
  assert.equal(remainingRequirements({ requirements: [req({ satisfiedCode: "C", subrequirements: [
    { sourceStabx: "001", satisfiedCode: "N", sourceData: { ORSUB: "X" } }
  ] })] }).length, 0);
});
test("missing coursework, units and GPA are explained without inventing completion", () => {
  const result = describe(req({ sourceData: { NEEDHRS: "4", NEEDCT: "1", REQGPA: "2", GOTGPA: "1.8" } }));
  assert.equal(result.reasons.length, 3);
  assert.match(result.reasons.join(" "), /4 units.*1 courses.*1.8/);
  assert.equal(describe(req({ satisfiedCode: "F" })).status, "unverified");
});
test("remaining children exclude completed, hidden and optional rows", () => {
  const subrequirements = [
    { sourceStabx: "1", satisfiedCode: "C" },
    { sourceStabx: "2", satisfiedCode: "N", sourceData: { HIDDEN: "H" } },
    { sourceStabx: "3", satisfiedCode: "N", sourceData: { OPTSUB: "X" } },
    { sourceStabx: "4", satisfiedCode: "N", allowableCourseRules: [
      { ruleType: "A", coursePattern: "MATH 2220" }, { ruleType: "R", coursePattern: "MATH 2210" },
      { ruleType: "A", coursePattern: "CSE 4***" }
    ] }
  ];
  const subs = remainingRequirements({ requirements: [req({ subrequirements })] })[0].subrequirements;
  assert.equal(subs.length, 1);
  assert.deepEqual(subs[0].aCodedCoursePatterns, ["MATH 2220"]);
  assert.equal(subs[0].otherPatternCount, 1);
});
const attempt = (grade, extra = {}) => ({ courseCode: "MATH 2210", credits: 4, grade, ...extra });
test("prerequisite minimum grade and alternatives are enforced", () => {
  assert.equal(checkPrerequisites("MATH2220", [attempt("D")]).status, "needs-review");
  assert.equal(checkPrerequisites("MATH2220", [attempt("C-")]).status, "recorded-prerequisites-met");
  assert.equal(checkPrerequisites("MATH2220", [attempt("B", { courseCode: "MATH2120Q2S" })]).status, "recorded-prerequisites-met");
});
test("in-progress, failure, unknown grades and zero-credit attempts do not satisfy prerequisites", () => {
  for (const record of [attempt("F"), attempt("CR"), attempt("RG", { inProgressCode: "I" }),
    attempt("A", { inProgressCode: "I" }), attempt("A", { credits: 0 })]) {
    assert.equal(checkPrerequisites("MATH2220", [record]).status, "needs-review");
  }
});
test("an earlier passing attempt survives a later unsuccessful attempt", () => {
  assert.equal(checkPrerequisites("MATH2220", [attempt("B"), attempt("F")]).status, "recorded-prerequisites-met");
});
test("AND prerequisites require every course; unknown catalog coverage stays unknown", () => {
  assert.equal(checkPrerequisites("CSE4010", [{ courseCode: "CSE3100", grade: "A", credits: 4 }]).status, "needs-review");
  assert.equal(checkPrerequisites("ART1234", []).status, "unknown");
});

test("NOT FROM exclusions override potential courses despite whitespace differences", () => {
  const subrequirements = [{ sourceStabx: "1", satisfiedCode: "N", allowableCourseRules: [
    { ruleType: "A", coursePattern: "CSE 4200" },
    { ruleType: "R", coursePattern: "CSE4200" },
    { ruleType: "A", coursePattern: "CSE 4050" }
  ] }];
  const sub = remainingRequirements({ requirements: [req({ subrequirements })] })[0].subrequirements[0];
  assert.deepEqual(sub.aCodedCoursePatterns, ["CSE 4050"]);
  assert.deepEqual(sub.rCodedCoursePatterns, ["CSE4200"]);
});

test("a completed waiver-bearing section is not reopened by nominal course counts", () => {
  const subrequirements = [{ sourceStabx: "1", title: "Calculus I and II", satisfiedCode: "C",
    sourceData: { REQCT: "2", GOTCT: "1" }, courses: [{ courseCode: "MATH2220", grade: "A", credits: 4 }] }];
  const result = remainingRequirements({ requirements: [req({ satisfiedCode: "I", subrequirements })] });
  assert.equal(result[0].subrequirements.length, 0);
  assert.equal(result[0].status, "in-progress");
});

test("game-development catalog guidance explains approval without changing audit status", () => {
  const requirement = req({ sourceName: "CSGAMEDEV", sourceData: { CATLYT: "20264 " },
    subrequirements: [{ sourceStabx: "1", satisfiedCode: "N",
      title: "THREE UNITS OF GAME DEVELOPMENT ELECTIVES" }] });
  const result = remainingRequirements({ requirements: [requirement] })[0].subrequirements[0];
  assert.equal(result.statusCode, "N");
  assert.match(result.catalogGuidance.description, /three units/);
  assert.match(result.catalogGuidance.nextStep, /approve/);
  assert.deepEqual(result.aCodedCoursePatterns, []);
  assert.equal(catalogGuidance({ ...requirement, sourceName: "CSCI" }, requirement.subrequirements[0]), null);
  assert.equal(catalogGuidance({ ...requirement, sourceData: { CATLYT: "20254" } }, requirement.subrequirements[0]), null);
});

test("archived major catalogs explain elective totals without adding courses to in-progress sections", () => {
  for (const [name, year, title, units, archive] of [
    ["UDCOMPENG", "20244", "CSE ELECTIVES NUMBERED 4000 AND ABOVE", 9, "2024-25"],
    ["CSCIELECT", "20254", "CSE ELECTIVES 4000-LEVEL AND ABOVE", 12, "2025-26"]
  ]) {
    const requirement = req({ sourceName: name, sourceData: { CATLYT: year } });
    const sub = { satisfiedCode: "I", title };
    const guidance = catalogGuidance(requirement, sub);
    assert.ok(guidance.description.includes(`${units} total units`));
    assert.match(guidance.nextStep, /not a recommendation to add more/);
    assert.ok(guidance.programUrl.includes(`/archive/${archive}/`));
    assert.equal(catalogGuidance({ ...requirement, sourceData: { CATLYT: "20264" } }, sub), null);
  }
});
