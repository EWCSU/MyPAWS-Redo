function numberOrNull(value) {
  if (String(value ?? "").trim() === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

// GOTHRS can include current registration and non-GPA credit. Only
// GOTGPAHRS establishes whether the source GPA has a graded denominator.
function auditGpa(source) {
  const hours = numberOrNull(source?.GOTGPAHRS);
  const value = numberOrNull(source?.GOTGPA);
  if (hours === 0) return {
    value: null,
    explanation: "No GPA-bearing coursework recorded in this audit. In-progress courses do not establish a GPA."
  };
  if (hours === null || hours < 0 || value === null || value < 0 || value > 4) return {
    value: null,
    explanation: "GPA data is unavailable or incomplete in this audit."
  };
  return { value, explanation: null };
}

module.exports = { auditGpa };
