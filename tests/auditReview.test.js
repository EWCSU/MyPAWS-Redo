const { test } = require("node:test");
const assert = require("node:assert/strict");
const { applyAuditReview } = require("../utils/auditReview");
const audit = { sourceAuditSequence: "test-run", programCode: "TEST", requirements: [
  { sourceName: "CALCULUS", satisfiedCode: "N", sourceData: { NEEDCT: "1" }, subrequirements: [] }
] };
const reviews = [{ sourceAuditSequence: "test-run", programCode: "TEST", date: "2026-11-04",
  description: "Official report reviewed", requirements: { CALCULUS: {
    satisfiedCode: "C", explanation: "Approved waiver", metrics: { NEEDCT: "0" }
  } } }];
test("review retains original decision and does not mutate historical records", () => {
  const result = applyAuditReview(audit, reviews);
  assert.equal(result.requirements[0].satisfiedCode, "C");
  assert.equal(result.requirements[0].originalSatisfiedCode, "N");
  assert.equal(result.requirements[0].reviewNote, "Approved waiver");
  assert.equal(audit.requirements[0].satisfiedCode, "N");
  assert.equal(audit.requirements[0].sourceData.NEEDCT, "1");
});
test("reviews do not carry into another program or a newer audit", () => {
  for (const other of [{ ...audit, programCode: "OTHER" }, { ...audit, sourceAuditSequence: "new-run" }]) {
    assert.equal(applyAuditReview(other, reviews), other);
  }
});
