
const $ = id => document.getElementById(id);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  if (!value) return "Not available";

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



function statusText(code) {
  const status = String(code ?? "").trim().toUpperCase();

  const labels = {
    C: "Completed",
    I: "In Progress",
    N: "Not Completed"
  };

  if (labels[status]) {
    return labels[status];
  }

  return "Status Not Verified";
}



function statusClass(code) {
  const status = String(code ?? "").trim().toUpperCase();

  switch (status) {
    case "C":
      return "satisfied";
    case "N":
      return "not-satisfied";
    case "I":
      return "pending";
    default:
      return "unknown";
  }
}


function createCourse(course) {
  const row = element("div", "course");

  const title = element(
    "strong",
    "",
    course.courseCode +
      (course.courseTitle ? " — " + course.courseTitle : "")
  );

  const info = element("div", "muted");

  const parts = [];
  
const grade = String(course.grade ?? "").trim().toUpperCase();
const progressCode = String(course.inProgressCode ?? "").trim().toUpperCase();

if (grade === "RG" && progressCode === "I") {
  parts.push("Status: In Progress");
} else if (grade === "RG" || progressCode === "I") {
  parts.push("Status: Needs Verification");
} else if (grade) {
  parts.push("Status: Grade Recorded");
} else {
  parts.push("Status: Not Verified");
}


  if (course.grade) {
    parts.push("Grade: " + course.grade);
  }

  if (course.credits !== null &&
      course.credits !== undefined) {
    parts.push("Credits: " + course.credits);
  }

  if (course.termCode) {
    parts.push("Term: " + course.termCode);
  }

  if (course.inProgressCode) {
    parts.push("In-progress code: " +
      course.inProgressCode);
  }

  info.textContent = parts.join(" | ");

  row.append(title, info);
  return row;
}

function createSubrequirement(sub) {
  const details = element("details", "subrequirement");
  const summary = element("summary");

  summary.append(
    element(
      "span",
      "",
      sub.displayTitle || sub.title ||
          "Subrequirement " + sub.sourceStabx
    ),
element(
  "span",
  "status " + statusClass(sub.satisfiedCode),
  statusText(sub.satisfiedCode)
)
  );

  details.appendChild(summary);

  const courses = sub.courses || [];

  if (courses.length === 0) {
    details.appendChild(
      element("p", "muted",
        "No associated course records in this audit.")
    );
  } else {
    for (const course of courses) {
      details.appendChild(createCourse(course));
    }
  }

  return details;
}

function createRequirement(req) {
  const details = element("details", "requirement");
  const summary = element("summary");

  const title = req.displayTitle ||
     req.title ||
     req.sourceName ||
     "Requirement " + req.sourceRtabx;

  summary.append(
    element("span", "", title),
    element(
      "span",
      "status " + statusClass(req.satisfiedCode),
      statusText(req.satisfiedCode)
)
  );

  details.appendChild(summary);

  const subs = req.subrequirements || [];

  if (subs.length === 0) {
    details.appendChild(
      element("p", "muted",
        "No subrequirements recorded.")
    );
  } else {
    subs.sort((a, b) =>
      String(a.sourceStabx).localeCompare(
        String(b.sourceStabx),
        undefined,
        { numeric: true }
      )
    );

    for (const sub of subs) {
      details.appendChild(createSubrequirement(sub));
    }
  }

  return details;
}

function getRequirementGroup(req) {
  const category = String(req.category || "")
    .trim().toUpperCase();

  const name = String(req.sourceName || "")
    .trim().toUpperCase();

  // Keep technical records accessible, but separate.
  if (
    req.sourceRtabx === "00" ||
    name === "LEGEND" ||
    name === "REJECT" ||
    category === "RECORD"
  ) {
    return "Additional Audit Details";
  }

  if (category === "GENERAL EDUC") {
    return "General Education";
  }

  if (category === "MAJOR") {
    return "Major Requirements";
  }

  if (category.includes("ELECTIVE")) {
    return "Electives";
  }

  if (
    category.includes("GPA") ||
    category.startsWith("MIN ") ||
    category === "INSTITUTIONS" ||
    category.includes("DESIGNATION")
  ) {
    return "University & Graduation Requirements";
  }

  return "Other Academic Requirements";
}

function renderRequirementSummary(requirements) {
  const academic = requirements.filter(req =>
    getRequirementGroup(req) !== "Additional Audit Details"
  );

  const counts = {
    C: 0,
    I: 0,
    N: 0,
    other: 0
  };

  for (const req of academic) {
    const status = String(
      req.satisfiedCode ?? ""
    ).trim().toUpperCase();

    if (status === "C" ||
        status === "I" ||
        status === "N") {
      counts[status]++;
    } else {
      counts.other++;
    }
  }

  $("satisfiedCount").textContent = counts.C;
  $("pendingCount").textContent = counts.I;
  $("notSatisfiedCount").textContent = counts.N;
  $("unverifiedCount").textContent = counts.other;

  $("summaryNote").textContent =
    `${academic.length} academic requirement records summarized. ` +
    `Technical sections excluded. ` +
    `Counts do not represent a graduation completion percentage.`;
}


async function loadDegreeAudit() {
  try {
    const response = await fetch(
      "/api/student/audit-details",
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );

    if (response.status === 401 ||
        response.status === 403) {
      window.location.replace("/LoginUI/Main.html");
      return;
    }

    if (!response.ok) {
      throw new Error("Unable to retrieve degree audit.");
    }

    const data = await response.json();
    const audit = data.audit;

    $("programTitle").textContent =
      audit.programTitle || "Degree Audit";

    $("auditDate").textContent =
      "Audit generated: " + formatDate(audit.runDate);

    const requirements = audit.requirements || [];
    renderRequirementSummary(requirements);

    $("requirementCount").textContent =
      requirements.length + " recorded requirements";

    requirements.sort((a, b) =>
      String(a.sourceRtabx).localeCompare(
        String(b.sourceRtabx),
        undefined,
        { numeric: true }
      )
    );


const container = $("requirements");
container.replaceChildren();

const groupOrder = [
  "University & Graduation Requirements",
  "General Education",
  "Major Requirements",
  "Electives",
  "Other Academic Requirements",
  "Additional Audit Details"
];

const groups = new Map(
  groupOrder.map(name => [name, []])
);

for (const req of requirements) {
  const group = getRequirementGroup(req);
  groups.get(group).push(req);
}

for (const [groupName, items] of groups) {
  if (items.length === 0) continue;

  if (groupName === "Additional Audit Details") {
    const technical = document.createElement("details");
    technical.className = "card";

    const summary = document.createElement("summary");
    summary.textContent =
      `Additional Audit Details (${items.length})`;

    technical.appendChild(summary);

    for (const req of items) {
      technical.appendChild(createRequirement(req));
    }

    container.appendChild(technical);
    continue;
  }

  const heading = document.createElement("h3");
  heading.textContent =
    `${groupName} (${items.length})`;

  heading.style.margin = "30px 0 15px";
  heading.style.fontSize = "20px";

  container.appendChild(heading);

  for (const req of items) {
    container.appendChild(createRequirement(req));
  }
}


    if (!requirements.length) {
      container.textContent =
        "No requirements found for this audit.";
    }

  } catch (error) {
    console.error(error);
    $("requirements").replaceChildren(
      element("p", "error",
        "Unable to load degree audit information.")
    );
  }
}

loadDegreeAudit();
