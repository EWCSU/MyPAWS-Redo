const { test } = require("node:test");
const assert = require("node:assert/strict");
const { auditGpa } = require("../utils/auditGpa");

test("registration-only CSUSB units do not turn placeholder zero into a GPA", () => {
  const result = auditGpa({ GOTHRS: "18", IPHRS: "18", GOTGPAHRS: "0", GOTGPAPTS: "0", GOTGPA: "0" });
  assert.equal(result.value, null);
  assert.match(result.explanation, /No GPA-bearing coursework/);
});

test("genuine zero GPA with graded hours is preserved even if no credit was earned", () => {
  assert.deepEqual(auditGpa({ GOTHRS: "0", GOTGPAHRS: "3", GOTGPAPTS: "0", GOTGPA: "0" }),
    { value: 0, explanation: null });
});

test("missing or malformed GPA data is unavailable, never silently converted to zero", () => {
  for (const source of [undefined, {}, { GOTGPAHRS: "", GOTGPA: "0" },
    { GOTGPAHRS: "3", GOTGPA: "" }, { GOTGPAHRS: "bad", GOTGPA: "3" },
    { GOTGPAHRS: "3", GOTGPA: "5" }]) assert.equal(auditGpa(source).value, null);
});

test("valid source GPA precision is retained without recalculating rounded source values", () => {
  assert.equal(auditGpa({ GOTGPAHRS: "42", GOTGPA: "3.483" }).value, 3.483);
  assert.equal(auditGpa({ GOTGPAHRS: "13", GOTGPA: "1.231" }).value, 1.231);
});
