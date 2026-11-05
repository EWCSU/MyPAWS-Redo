const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Zip = require("adm-zip");
const { parse } = require("csv-parse/sync");
const { remainingRequirements, organizeAudit } = require("../utils/auditLogic");
const folder = path.join(__dirname, "../private-data");
const files = fs.existsSync(folder) ? fs.readdirSync(folder).filter(f => f.endsWith(".zip")) : [];
test("private student audit fixtures are available", { skip: !files.length }, () => assert.equal(files.length, 3));
for (const [index, file] of files.entries()) {
  test(`private audit fixture ${index + 1}: source decisions and full checklist`, () => {
    const zip = new Zip(path.join(folder, file));
    const read = name => parse(zip.getEntries().find(e => e.entryName.endsWith(`/${name}.txt`)).getData().toString(),
      { columns: true, delimiter: "\t", trim: true, skip_empty_lines: true });
    const rows = read("JOB_QUEUE_REQ"), subs = read("JOB_QUEUE_SUBREQ"), rules = read("SUB_REQ_AR");
    const requirements = rows.map(r => ({ sourceRtabx: r.RTABX.trim(), sourceName: r.RNAME.trim(),
      satisfiedCode: r.SATISFIED.trim(), sourceData: r,
      subrequirements: subs.filter(s => s.RTABX === r.RTABX).map(s => ({
        sourceStabx: s.STABX.trim(), satisfiedCode: s.SATISFIED.trim(), sourceData: s,
        allowableCourseRules: rules.filter(a => a.SUB_INT_SEQ_NO === s.SUBREQ_ID).map(a => ({
          coursePattern: a.COURSE, ruleType: a.AR_TYPE
        }))
      })) }));
    const audit = { requirements };
    const organized = organizeAudit(audit), remaining = remainingRequirements(audit);
    assert.equal(organized.requirements.length, rows.length);
    for (const r of requirements) {
      const result = organized.requirements.find(o => o.sourceRtabx === r.sourceRtabx);
      assert.equal(result.statusCode, r.satisfiedCode);
      assert.equal(result.subrequirements.length, r.subrequirements.length);
      if (result.academic && r.satisfiedCode !== "C") {
        assert.ok(remaining.some(o => o.requirementCode === r.sourceRtabx));
        assert.ok(result.reasons.length);
      }
    }
    assert.ok(remaining.some(r => r.category === "MIN CSUSB"));
    assert.ok(!remaining.some(r => ["ELECT", "CALCELECT", "QTRUDWRIT"].includes(r.sourceName)));
    // Preserve this older snapshot faithfully. The newer official recording
    // has a department waiver; do not mistake this fixture for current truth.
    const calculus = remaining.flatMap(r => r.subrequirements).find(s => s.title === "CALCULUS I AND II");
    if (read("JOB_QUEUE_RUN")[0].DPROG.trim() === "CSCI-BS") {
      assert.equal(calculus.statusCode, "N");
      assert.match(calculus.reasons.join(" "), /4 units.*1 courses/);
      assert.ok(calculus.aCodedCoursePatterns.some(c => c.replace(/\s/g, "") === "MATH2220"));
    }
  });
}
