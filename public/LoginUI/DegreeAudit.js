
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
    N: "Needs attention"
  };

  if (labels[status]) {
    return labels[status];
  }

  return "Needs advisor review";
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
  const details = element("details", "subrequirement " + statusClass(sub.satisfiedCode));
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

  for (const reason of sub.reasons || []) details.appendChild(element("p", "", reason));
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
  const details = element("details", "requirement " + (req.academic ? statusClass(req.satisfiedCode) : "unknown"));
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

  for (const reason of req.reasons || []) details.appendChild(element("p", "", reason));
  if (req.academic && req.status !== "completed") {
    const link = element("a", "", "See remaining requirements and course options");
    link.href = "RemainingRequirements.html#requirement-" + encodeURIComponent(req.sourceRtabx);
    details.appendChild(link);
  }
  const subs = (req.subrequirements || []).filter(sub => !sub.hiddenInSource);

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
    req.academic === false ||
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
  $("unverifiedCount").parentElement.hidden = counts.other === 0;

  $("summaryNote").textContent = counts.N === 0 && counts.other === 0
    ? (counts.I > 0
      ? "All requirements are completed or covered by in-progress courses. Finish those courses successfully; no additional coursework is identified by this audit."
      : "All listed degree requirements are completed.")
    : "Review the sections needing attention below. In-progress coursework is listed separately from additional requirements.";

}


async function loadDegreeAudit() {
  try {
    const response = await fetch(
      "/api/student/audit-details" + (new URLSearchParams(location.search).has("auditId") ? "?auditId=" + encodeURIComponent(new URLSearchParams(location.search).get("auditId")) : ""),
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
      "Imported audit dated: " + formatDate(audit.runDate) +
      ". Later registrations, waivers, substitutions, and program changes are not reflected until a newer audit is imported.";

    if (audit.presentationVersion !== 2) {
      throw new Error("The server is running an older audit version. Restart the application server to load the updated audit.");
    }
    const requirements = (audit.requirements || []).filter(req => req.academic);
    if (audit.review) {
      $("auditDate").textContent = "Reviewed against your official report dated " + formatDate(audit.review.date) + ". " + audit.review.description;
    }
    renderRequirementSummary(requirements);

    $("requirementCount").textContent =
      requirements.length + " degree requirement sections";

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
  const progress = element("div", "section-progress");
  for (const [code, label] of [["C", "completed"], ["I", "in progress"], ["N", "need attention"]]) {
    progress.appendChild(element("span", "", items.filter(item => item.satisfiedCode === code).length + " " + label));
  }
  container.appendChild(progress);
  const chart = element('div', 'section-chart');
  chart.setAttribute('role', 'img');
  const reviewCount = items.filter(item => !['C','I','N'].includes(item.satisfiedCode)).length;
  if (reviewCount) progress.appendChild(element('span', '', reviewCount + ' need advisor review'));
  chart.setAttribute('aria-label', groupName + ': ' + [...progress.children].map(node => node.textContent).join(', ') + '. Counts of requirement sections, not percentage of degree completed.');
  for (const [code, className] of [['C','chart-complete'], ['I','chart-progress'], ['N','chart-needed'], ['other','chart-review']]) {
    const count = items.filter(item => code === 'other' ? !['C','I','N'].includes(item.satisfiedCode) : item.satisfiedCode === code).length;
    if (!count) continue;
    const segment = element('span', className);
    segment.style.flexGrow = count;
    chart.appendChild(segment);
  }
  container.appendChild(chart);

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
        error.message || "Unable to load degree audit information.")
    );
  }
}

loadDegreeAudit();
