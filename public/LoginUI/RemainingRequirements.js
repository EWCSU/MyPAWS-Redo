
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
  return "Source status: " + (code || "Unknown");
}

function createStatus(code) {
  return makeElement(
    "span",
    "status" + (code === "I" ? " pending" : ""),
    statusLabel(code)
  );
}

function createPatternSection(title, patterns, allowPlanning = false) {
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

const standardCourseCode =
  /^[A-Z]{2,5}\s*\d{4}[A-Z]?$/.test(
    String(pattern).trim().toUpperCase()
  );

if (
  allowPlanning &&
  standardCourseCode &&
  getCourseHistoryStatus(pattern) ===
    "No matching coursework record"
) {
  const planLink = document.createElement("a");

  planLink.href =
    "MyCAPS.html?courseCode=" +
    encodeURIComponent(pattern);

  planLink.textContent = "Plan this course";
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

  details.appendChild(createPatternSection(
  "A-coded source course patterns",
  sub.aCodedCoursePatterns || [],
  true
));

  if ((sub.rCodedCoursePatterns || []).length > 0) {
    details.appendChild(createPatternSection(
      "R-coded source course patterns",
      sub.rCodedCoursePatterns
    ));
  }

  if (sub.otherPatternCount > 0) {
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
  const details = makeElement("details", "requirement");

  details.appendChild(makeElement(
    "summary",
    "",
    req.title || "Unnamed requirement"
  ));

  details.appendChild(createStatus(req.statusCode));

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
      "in the selected categories.";

    const container = $("requirementList");
    container.replaceChildren();

    const categories = [
      ["GENERAL EDUC", "General Education"],
      ["MAJOR", "Major Requirements"],
      ["ELECTIVES", "Electives"]
    ];

    for (const [category, title] of categories) {
      const matches = requirements.filter(req =>
        category === "ELECTIVES"
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
