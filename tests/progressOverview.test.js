const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildProgressOverview, classifyCourse } = require("../utils/progressOverview");

const course = (courseCode, grade, extra = {}) =>
  ({ courseCode, courseTitle: null, grade, credits: "3", termCode: "20254", inProgressCode: "", ...extra });
const sub = (courses = []) => [{ sourceStabx: "01", title: "Sub", satisfiedCode: "C", sourceData: {}, courses }];
const req = (sourceRtabx, sourceName, satisfiedCode, sourceData = {}, courses = []) =>
  ({ sourceRtabx, sourceName, title: sourceName, satisfiedCode, sourceData, subrequirements: sub(courses) });
const audit = (requirements, extra = {}) =>
  ({ sourceAuditSequence: "1", programCode: "TEST", programTitle: "Test Program", runDate: "2026-01-01", requirements, ...extra });

test("section and group counts follow the audit's own status codes", () => {
  const result = buildProgressOverview(audit([
    req("01", "MAJ1", "C", { CATEGORY: "MAJOR" }),
    req("02", "MAJ2", "I", { CATEGORY: "MAJOR" }),
    req("03", "GE1", "N", { CATEGORY: "GENERAL EDUC", NEEDHRS: "6", NEEDCT: "2" }),
    req("04", "GE2", "C", { CATEGORY: "GENERAL EDUC" }),
    req("05", "UNI1", "X", { CATEGORY: "MIN CSUSB" }),
    req("06", "HIDDEN1", "N", { CATEGORY: "MAJOR", HIDDEN: "H" }),
    req("07", "REC", "C", { CATEGORY: "RECORD" })
  ]));
  assert.deepEqual(result.sections, { completed: 2, inProgress: 1, needsAttention: 1, needsReview: 1, total: 5 });
  const major = result.groups.find(group => group.name === "Major");
  assert.equal(major.completed, 1);
  assert.equal(major.inProgress, 1);
  assert.equal(result.needed.unfulfilledSections, 1);
  assert.equal(result.needed.coursesApprox, 2);
  assert.deepEqual(result.needed.unitsBySection.map(row => row.units), [6]);
});

test("placeholder values of 900 or more are not reported as needed work", () => {
  const result = buildProgressOverview(audit([
    req("01", "GE1", "N", { CATEGORY: "GENERAL EDUC", NEEDHRS: "999", NEEDCT: "999" })
  ]));
  assert.equal(result.needed.coursesApprox, null);
  assert.deepEqual(result.needed.unitsBySection, []);
  assert.equal(result.needed.unfulfilledSections, 1);
});

test("units and GPAs come from the source values without recalculation", () => {
  const result = buildProgressOverview(audit([
    req("01", "CUM", "I", { CATEGORY: "CUM UNITS & GPA", REQHRS: "120", GOTHRS: "90", NEEDHRS: "30" }),
    req("02", "GPA", "C", { CATEGORY: "CUM 2.0 GPA", GOTGPA: "3.25", GOTGPAHRS: "60", REQGPA: "2" }),
    req("03", "CSUSBG", "C", { CATEGORY: "CSUSB GPA", GOTGPA: "0", GOTGPAHRS: "0" })
  ]));
  assert.deepEqual(
    { required: result.units.required, recorded: result.units.recorded, needed: result.units.needed },
    { required: 120, recorded: 90, needed: 30 });
  assert.equal(result.gpas.find(g => g.key === "overall").value, 3.25);
  assert.equal(result.gpas.find(g => g.key === "overall").required, 2);
  assert.equal(result.gpas.find(g => g.key === "csusb").value, null);
  assert.match(result.gpas.find(g => g.key === "csusb").explanation, /No GPA-bearing coursework/);
});

test("more than one major overview returns every major GPA instead of guessing one", () => {
  const result = buildProgressOverview(audit([
    req("01", "CSCI-AVE", "I", { CATEGORY: "MAJOR", GOTGPA: "3.0", GOTGPAHRS: "30" }),
    req("02", "CSGD-AVE", "I", { CATEGORY: "MAJOR", GOTGPA: "3.4", GOTGPAHRS: "12" })
  ]));
  const majors = result.gpas.filter(g => g.key.startsWith("major-"));
  assert.equal(majors.length, 2);
  assert.deepEqual(majors.map(g => g.label), ["Major GPA (CSCI-AVE)", "Major GPA (CSGD-AVE)"]);
  assert.deepEqual(majors.map(g => g.value), [3, 3.4]);
});

test("a course listed under two requirements is counted once", () => {
  const result = buildProgressOverview(audit([
    req("01", "A", "C", { CATEGORY: "MAJOR" }, [course("CSE 2010", "A")]),
    req("02", "B", "C", { CATEGORY: "MAJOR" }, [course("CSE2010", "A")])
  ]));
  assert.equal(result.courses.total, 1);
  assert.equal(result.courses.passed, 1);
});

test("an earlier pass survives a later failure, and failure-only courses are not completed", () => {
  const result = buildProgressOverview(audit([
    req("01", "A", "C", { CATEGORY: "MAJOR" }, [
      course("MATH 1", "C", { termCode: "20224" }),
      course("MATH 1", "F", { termCode: "20234" }),
      course("PHYS 1", "F")
    ])
  ]));
  assert.equal(result.courses.passed, 1);
  assert.equal(result.courses.failedOnly, 1);
  assert.equal(result.courses.repeated, 1);
  assert.ok(result.notes.some(note => /failing grade/.test(note)));
});

test("in-progress courses are separate from completed ones and their units are summed", () => {
  const result = buildProgressOverview(audit([
    req("01", "A", "I", { CATEGORY: "MAJOR" }, [
      course("CSE 1", "RG", { inProgressCode: "I", credits: "3.00000" }),
      course("CSE 2", "RG", { inProgressCode: "I", credits: "4" }),
      course("CSE 3", "B")
    ])
  ]));
  assert.equal(result.courses.inProgress, 2);
  assert.equal(result.courses.passed, 1);
  assert.equal(result.units.inProgress, 7);
});

test("unrecognized grades are reported, never silently counted as completed", () => {
  const result = buildProgressOverview(audit([
    req("01", "A", "C", { CATEGORY: "MAJOR" }, [course("ART 1", "CR"), course("ART 2", "W")])
  ]));
  assert.equal(result.courses.other, 2);
  assert.equal(result.courses.passed, 0);
  assert.ok(result.notes.some(note => /does not classify|do not classify/.test(note) || /not counted as completed/.test(note)));
});

test("classifyCourse matches the Coursework page for ambiguous in-progress records", () => {
  assert.equal(classifyCourse({ grade: "RG", inProgressCode: "I" }), "inProgress");
  assert.equal(classifyCourse({ grade: "RG", inProgressCode: "" }), "other");
  assert.equal(classifyCourse({ grade: "B+", inProgressCode: "I" }), "other");
  assert.equal(classifyCourse({ grade: "d-", inProgressCode: "" }), "passed");
});

test("reviewed corrections change both statuses and the numbers drawn from them", () => {
  const reviews = [{
    sourceAuditSequence: "1", programCode: "TEST", date: "2026-02-01", description: "Checked against the official report.",
    requirements: {
      GPA: { satisfiedCode: "C", explanation: "Matches official report.", metrics: { GOTGPA: "3.5", GOTGPAHRS: "40" } }
    }
  }];
  const raw = audit([req("01", "GPA", "N", { CATEGORY: "CUM 2.0 GPA", GOTGPA: "1.0", GOTGPAHRS: "40", REQGPA: "2" })]);
  const result = buildProgressOverview(raw, reviews);
  assert.equal(result.sections.completed, 1);
  assert.equal(result.gpas.find(g => g.key === "overall").value, 3.5);
  assert.equal(result.reviewed.date, "2026-02-01");
  assert.equal(buildProgressOverview(raw, []).gpas.find(g => g.key === "overall").value, 1);
});
