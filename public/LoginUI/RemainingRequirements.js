
const $ = id => document.getElementById(id);

const courseworkByCode = new Map();

function normalizeCourseCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function getCourseHistoryStatus(pattern) {
  const key = normalizeCourseCode(pattern);
  const records = courseworkByCode.get(key) || [];

  if (records.some(course =>
    course.inProgressCode === "I"
  )) {
    return "On record: In Progress";
  }

if (
  records.length > 0 &&
  records.every(course =>
    String(course.grade ?? "").trim().toUpperCase() === "F"
  )
) {
  return "On record: F grade (retake may be needed)";
}


  if (records.some(course =>
    /^(A|B|C|D|F)[+-]?$/.test(
      String(course.grade ?? "").toUpperCase()
    )
  )) {
    return "On record: Graded";
  }

  if (records.length > 0) {
    return "On record: Other Result";
  }

  return "No matching coursework record";
}


function makeElement(tag, className, text) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;

  return node;
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function statusLabel(code) {
  if (code === "N") return "Not Satisfied";
  if (code === "I") return "Pending";
  return "Status not verified";
}

function createStatus(code) {
  return makeElement(
    "span",
    "status" + (code === "I" ? " pending" : code === "N" ? "" : " unknown"),
    statusLabel(code)
  );
}

function createPatternSection(title, patterns, allowPlanning = false, eligibility = {}) {
  const section = makeElement("div");

  section.appendChild(makeElement("h3", "", title));

  if (!patterns.length) {
    section.appendChild(
      makeElement("p", "muted", "No patterns recorded.")
    );
    return section;
  }

  const container = makeElement("div", "patterns");


for (const pattern of patterns) {
  const course = makeElement(
    "span",
    "pattern",
    pattern
  );

  const historyStatus = makeElement(
    "small",
    "course-match",
    getCourseHistoryStatus(pattern)
  );


course.appendChild(historyStatus);
const check = eligibility[pattern];
if (check) {
  course.appendChild(makeElement("p", "warning", check.message));
  const catalog = makeElement("a", "", "Review official prerequisites" );
  catalog.href = check.source;
  catalog.target = "_blank";
  catalog.rel = "noopener noreferrer";
  course.appendChild(catalog);
  if (check.requirements.length && check.status !== "recorded-prerequisites-met") {
    course.appendChild(makeElement("p", "", check.operator === "any"
      ? "Complete one of these alternatives:" : "Required before this course:"));
    for (const prerequisite of check.requirements.filter(r => !r.satisfied)) {
      const link = makeElement("a", "plan-option", prerequisite.courseCode +
        (prerequisite.minimumGrade ? " (minimum " + prerequisite.minimumGrade + ")" : "") +
        (prerequisite.inProgress ? " - in progress; finish first" : " - review and plan prerequisite"));
      link.href = "MyCAPS.html?courseCode=" + encodeURIComponent(prerequisite.courseCode);
      course.appendChild(link);
    }
  }
}


const standardCourseCode =
  /^[A-Z]{2,5}\s*\d{4}[A-Z]?$/.test(
    String(pattern).trim().toUpperCase()
  );


if (
  allowPlanning &&
  standardCourseCode &&
  (
    getCourseHistoryStatus(pattern) ===
      "No matching coursework record" ||
    getCourseHistoryStatus(pattern) ===
      "On record: F grade (retake may be needed)"
  )
) {

  const planLink = document.createElement("a");

  planLink.href =
    "MyCAPS.html?courseCode=" +
    encodeURIComponent(pattern);

  planLink.textContent = "Add to draft plan (eligibility unconfirmed)";
  planLink.className = "plan-option";

  course.appendChild(planLink);
}

container.appendChild(course);

}


  section.appendChild(container);
  return section;
}

function createSubrequirement(sub) {
  const details = makeElement("details", "subrequirement");

  const summary = makeElement(
    "summary",
    "",
    sub.title || "Unnamed subrequirement"
  );

  details.appendChild(summary);
  details.appendChild(createStatus(sub.statusCode));
  for (const reason of sub.reasons || []) details.appendChild(makeElement("p", "", reason));
  if (sub.alternative) details.appendChild(makeElement("p", "muted", "This is an alternative in the source audit; do not assume every alternative is required."));

  if (sub.catalogGuidance) {
    const guidance = sub.catalogGuidance;
    details.appendChild(makeElement("h3", "", guidance.title));
    details.appendChild(makeElement("p", "", guidance.description));
    details.appendChild(makeElement("p", "warning", guidance.nextStep));
    for (const [label, url] of [
      ["Read the major requirements (" + guidance.catalogYear + ")", guidance.programUrl],
      ["Browse CSUSB course descriptions", guidance.coursesUrl]
    ]) {
      const paragraph = makeElement("p");
      const link = makeElement("a", "", label);
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      paragraph.appendChild(link);
      details.appendChild(paragraph);
    }
  }

if (
  !sub.catalogGuidance &&
  !(sub.aCodedCoursePatterns || []).length
) {
  details.appendChild(makeElement(
    "p",
    "muted",
    "Needs review: No recognizable course options are listed " +
    "for this requirement. Check the full degree audit " +
    "or consult an academic advisor."
  ));
}


  if (!sub.catalogGuidance || (sub.aCodedCoursePatterns || []).length) details.appendChild(createPatternSection(
  "Potential courses from the imported audit",
  sub.aCodedCoursePatterns || [],
  sub.statusCode === "N",
  sub.courseEligibility || {}
));

  if ((sub.rCodedCoursePatterns || []).length > 0) {
    details.appendChild(makeElement("p", "warning",
      "The following courses are excluded from this subrequirement. They may apply to a different requirement."));
    details.appendChild(createPatternSection(
      "Excluded courses - not fulfillment options",
      sub.rCodedCoursePatterns
    ));
  }

  if (sub.otherPatternCount > 0 && !sub.catalogGuidance) {
    details.appendChild(makeElement(
      "p",
      "muted",
      `${sub.otherPatternCount} additional source pattern(s) ` +
      "require interpretation."
    ));
  }

  return details;
}

function createRequirement(req) {
  const details = makeElement("details", "requirement " +
    ({ N: "not-satisfied", I: "pending" }[req.statusCode] || "unknown"));
  details.id = "requirement-" + req.requirementCode;

  details.appendChild(makeElement(
    "summary",
    "",
    req.title || "Unnamed requirement"
  ));

  details.appendChild(createStatus(req.statusCode));
  for (const reason of req.reasons || []) details.appendChild(makeElement("p", "", reason));

  const subs = req.subrequirements || [];

  if (!subs.length) {
    details.appendChild(makeElement(
      "p",
      "muted",
      "No pending subrequirements were returned for " +
      "this requirement. Review the full degree audit " +
      "for additional information."
    ));
  }

  for (const sub of subs) {
    details.appendChild(createSubrequirement(sub));
  }

  return details;
}

async function loadRemainingRequirements() {
  try {
    const response = await fetch(
      "/api/student/remaining-course-options",
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );

    if (response.status === 401) {
      window.location.replace("/LoginUI/Main.html");
      return;
    }

    if (!response.ok) {
      throw new Error(
        response.status === 403
          ? "Access denied."
          : "Unable to load remaining requirements."
      );
    }

    const data = await response.json();

const courseworkResponse = await fetch(
  "/api/student/coursework",
  {
    credentials: "same-origin",
    cache: "no-store"
  }
);

if (courseworkResponse.status === 401) {
  window.location.replace("/LoginUI/Main.html");
  return;
}

if (!courseworkResponse.ok) {
  throw new Error("Unable to check course history.");
}

const courseworkData = await courseworkResponse.json();

courseworkByCode.clear();

for (const group of Object.values(
  courseworkData.coursework || {}
)) {
  for (const course of group) {
    const key = normalizeCourseCode(course.courseCode);

    if (!key) continue;

    if (!courseworkByCode.has(key)) {
      courseworkByCode.set(key, []);
    }

    courseworkByCode.get(key).push(course);
  }
}

    const requirements = data.requirements || [];

    $("programInfo").textContent =
      `${data.programTitle} · Audit ${formatDate(data.auditDate)}`;

    $("requirementCount").textContent =
      `${requirements.length} requirement records ` +
      "not yet confirmed complete across all academic categories.";
    if (data.review) {
      $("programInfo").textContent = `${data.programTitle} - Official report reviewed ${formatDate(data.review.date)}`;
      $("requirementCount").textContent = data.review.description;
    }

    const container = $("requirementList");
    container.replaceChildren();

    const categories = [
      ["GENERAL EDUC", "General Education"],
      ["MAJOR", "Major Requirements"],
      ["ELECTIVES", "Electives"],
      ["OTHER", "University & Other Graduation Requirements"]
    ];

    for (const [category, title] of categories) {
      const matches = requirements.filter(req =>
        category === "OTHER"
          ? !["GENERAL EDUC", "MAJOR"].includes(req.category) && !req.category.includes("ELECTIVE")
          : category === "ELECTIVES"
          ? req.category.includes("ELECTIVE")
          : req.category === category
      );

      if (!matches.length) continue;

      container.appendChild(makeElement(
        "h2", "", `${title} (${matches.length})`
      ));

      for (const req of matches) {
        container.appendChild(createRequirement(req));
      }
    }

    if (window.location.hash) {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (target) { target.open = true; target.scrollIntoView(); }
    }
    if (!requirements.length) {
      container.textContent =
        "No matching requirements found in this audit.";
    }

  } catch (error) {
    console.error(error);

    $("requirementList").replaceChildren(
      makeElement("p", "error", error.message)
    );
  }
}

loadRemainingRequirements();
