
const $ = id => document.getElementById(id);

let allCourses = [];

const categoryLabels = {
  letterGraded: "Letter-Graded",
  inProgress: "In Progress",
  otherResults: "Other Results"
};

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });
}

function renderCourses() {
  const filter = $("filter").value;
  const search = $("search").value.trim().toLowerCase();

  const matches = allCourses.filter(course => {
    const categoryMatches =
      filter === "all" || course.category === filter;

    const searchable = [
      course.courseCode,
      course.courseTitle,
      course.termCode,
      course.grade
    ].join(" ").toLowerCase();

    return categoryMatches && searchable.includes(search);
  });

  const tbody = $("courseRows");
  tbody.replaceChildren();

  for (const course of matches) {
    const row = document.createElement("tr");

    const values = [
      course.courseCode,
      course.courseTitle || "Title not provided",
      course.termCode,
      course.grade,
      course.credits,
      categoryLabels[course.category]
    ];

    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value ?? "—";
      row.appendChild(cell);
    }

    tbody.appendChild(row);
  }

  $("resultCount").textContent =
    `Showing ${matches.length} of ${allCourses.length} ` +
    "distinct course signatures.";

  if (matches.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 6;
    cell.textContent = "No matching courses found.";

    row.appendChild(cell);
    tbody.appendChild(row);
  }
}

async function loadCoursework() {
  try {
    const response = await fetch("/api/student/coursework", {
      credentials: "same-origin",
      cache: "no-store"
    });

    if (response.status === 401 ||
        response.status === 403) {
      window.location.replace("/LoginUI/Main.html");
      return;
    }

    if (!response.ok) {
      throw new Error("Could not retrieve coursework.");
    }

    const data = await response.json();

    $("auditInfo").textContent =
      `${data.programTitle} · Audit ${formatDate(data.auditDate)}`;

    $("letterCount").textContent = data.counts.letterGraded;
    $("progressCount").textContent = data.counts.inProgress;
    $("otherCount").textContent = data.counts.otherResults;

    allCourses = Object.entries(data.coursework).flatMap(
      ([category, courses]) =>
        courses.map(course => ({ ...course, category }))
    );

    renderCourses();

  } catch (error) {
    console.error(error);
    $("resultCount").className = "error";
    $("resultCount").textContent =
      "Unable to load coursework. Please try again.";
  }
}

$("search").addEventListener("input", renderCourses);
$("filter").addEventListener("change", renderCourses);

loadCoursework();
