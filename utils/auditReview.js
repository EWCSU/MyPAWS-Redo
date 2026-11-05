const fs = require("node:fs");
const path = require("node:path");

// Local, evidence-backed corrections are scoped to an exact imported run.
// Keep student-specific review data outside version control. A newer import
// never inherits corrections made for a different source audit sequence.
function applyAuditReview(audit, reviews) {
  if (!reviews) {
    const file = path.join(__dirname, "../private-data/audit-reviews.json");
    reviews = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  }
  const review = reviews.find(r => r.sourceAuditSequence === audit.sourceAuditSequence &&
    r.programCode === audit.programCode);
  if (!review) return audit;
  const apply = (record, change) => {
    if (!change) return record;
    if (!["C", "I", "N"].includes(change.satisfiedCode)) throw new Error("Invalid reviewed audit status");
    return { ...record, originalSatisfiedCode: record.satisfiedCode,
      satisfiedCode: change.satisfiedCode, reviewNote: change.explanation,
      sourceData: { ...record.sourceData, ...change.metrics } };
  };
  return { ...audit, review: { date: review.date, description: review.description },
    requirements: audit.requirements.map(req => {
      const change = review.requirements[req.sourceName?.trim()];
      return { ...apply(req, change), subrequirements: req.subrequirements?.map(sub =>
        apply(sub, change?.subrequirements?.[sub.sourceStabx])) };
    }) };
}

module.exports = { applyAuditReview };
