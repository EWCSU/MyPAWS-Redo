
const $ = id => document.getElementById(id);
let editingCourseId = null;

const termOrder = {
  Winter: 0,
  Spring: 1,
  Summer: 2,
  Fall: 3
};

function makeElement(tag, text, className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options
  });

  if (response.status === 401) {
    window.location.replace("/LoginUI/Main.html");
    throw new Error("Please log in again.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function cancelEditing() {
  editingCourseId = null;

  $("planForm").reset();
  $("saveButton").textContent = "Add to My Plan";
  $("cancelEditButton").hidden = true;
  $("message").textContent = "";
}

function startEditing(course) {
  editingCourseId = course.id;

  $("courseCode").value = course.courseCode;
  $("courseTitle").value = course.courseTitle || "";
  $("term").value = course.term;
  $("year").value = course.year;
  $("notes").value = course.notes || "";

  $("saveButton").textContent = "Save Changes";
  $("cancelEditButton").hidden = false;

  $("message").textContent =
    `Editing ${course.courseCode}`;

  $("planForm").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  $("courseCode").focus({
    preventScroll: true
  });
}

function renderPlan(courses) {
  const container = $("plannedCourses");
  container.replaceChildren();

  $("courseCount").textContent =
    `${courses.length} planned course(s)`;

  if (!courses.length) {
    container.appendChild(makeElement(
      "p",
      "No courses planned yet.",
      "muted"
    ));
    return;
  }

  const sorted = [...courses].sort((a, b) =>
    a.year - b.year ||
    (termOrder[a.term] ?? 9) -
    (termOrder[b.term] ?? 9) ||
    a.courseCode.localeCompare(b.courseCode)
  );

  const semesters = new Map();

  for (const course of sorted) {
    const semester = `${course.term} ${course.year}`;

    if (!semesters.has(semester)) {
      semesters.set(semester, []);
    }

    semesters.get(semester).push(course);
  }

  for (const [semester, items] of semesters) {
    const card = makeElement("div", "", "term-card");
    card.appendChild(makeElement("h3", semester));

    for (const course of items) {
      const row = makeElement("div", "", "planned-course");

      row.appendChild(makeElement(
        "strong",
        course.courseCode +
          (course.courseTitle
            ? " — " + course.courseTitle
            : "")
      ));


if (course.notes) {
  row.appendChild(makeElement(
    "p",
    course.notes,
    "muted"
  ));
}
const editButton = document.createElement("button");

editButton.type = "button";
editButton.className = "edit-course";
editButton.textContent = "Edit";

editButton.addEventListener("click", () => {
  startEditing(course);
});

row.appendChild(editButton);
const removeButton = document.createElement("button");
removeButton.type = "button";
removeButton.className = "remove-course";
removeButton.textContent = "Remove";

removeButton.addEventListener("click", async () => {
  const confirmed = confirm(
    `Remove ${course.courseCode} from ` +
    `${course.term} ${course.year}?`
  );

  if (!confirmed) return;

  removeButton.disabled = true;

  try {
    await apiRequest(
      `/api/mycaps/courses/${encodeURIComponent(course.id)}`,
      { method: "DELETE" }
    );

    await loadPlan();

    $("message").textContent =
      "Course removed from your academic plan.";

  } catch (error) {
    $("message").textContent = error.message;
    removeButton.disabled = false;
  }
});

row.appendChild(removeButton);
card.appendChild(row);

    }

    container.appendChild(card);
  }
}

async function loadPlan() {
  const data = await apiRequest("/api/mycaps");

  const courses = Array.isArray(data.plan?.courses)
    ? data.plan.courses
    : [];

  renderPlan(courses);
}

$("planForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("saveButton");
  button.disabled = true;
  $("message").textContent = "Saving course...";

  try {
    const course = {
      courseCode: $("courseCode").value.trim(),
      courseTitle: $("courseTitle").value.trim(),
      term: $("term").value,
      year: Number($("year").value),
      notes: $("notes").value.trim()
    };


const isEditing = editingCourseId !== null;

const url = isEditing
  ? `/api/mycaps/courses/${encodeURIComponent(editingCourseId)}`
  : "/api/mycaps/courses";

await apiRequest(url, {
  method: isEditing ? "PUT" : "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(course)
});

cancelEditing();
await loadPlan();

$("message").textContent = isEditing
  ? "Planned course updated successfully."
  : "Course saved to your academic plan.";


  } catch (error) {
    console.error(error);
    $("message").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
$("cancelEditButton").addEventListener(
  "click",
  cancelEditing
);

function prefillPlannedCourse() {
  const params = new URLSearchParams(
    window.location.search
  );

  const courseCode = params.get("courseCode");

  if (!courseCode) return;

  const normalized = courseCode
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

  if (!/^[A-Z]{2,5}\s*\d{4}[A-Z]?$/.test(normalized)) {
    return;
  }

  $("courseCode").value = normalized;

  $("message").textContent =
    "Course code added from your degree audit. " +
    "Choose a semester and review the course before saving. " +
    "Eligibility has not been verified.";
}

prefillPlannedCourse();

loadPlan().catch(error => {
  console.error(error);
  $("courseCount").textContent =
    "Unable to load academic plan.";
});

// A compact audit comparison alongside the student's saved semester plan.
apiRequest('/api/student/audit-summary').then(({ audit }) => {
  const rows = audit.requirements;
  $('planAuditSummary').textContent = ['C', 'I', 'N'].map((code, index) =>
    rows.filter(row => row.statusCode === code).length + ' ' + ['completed', 'in progress', 'need attention'][index]).join(' · ');
}).catch(error => { $('planAuditSummary').textContent = error.message; });
