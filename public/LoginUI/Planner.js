// Term planner: add terms, drag courses in, between terms, or back out.
// Uses the existing /api/mycaps routes for courses and /api/planner for terms.
// Values are inserted with textContent only. Every drag action also has a menu
// alternative, because HTML5 drag and drop does not work on most touch screens.
(() => {
  const $ = id => document.getElementById(id);
  const TERM_ORDER = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };

  let terms = [];        // [{ term, year }]
  let courses = [];      // planned courses from the server
  let bankGroups = [];   // [{ title, courses: [{ code, eligibility }] }]
  const customCodes = new Set();
  let dragging = null;   // { kind: "bank", code } or { kind: "planned", id }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const pretty = code => String(code).trim().toUpperCase().replace(/^([A-Z]+)\s*(\d)/, "$1 $2").replace(/\s+/g, " ");
  const key = code => String(code).toUpperCase().replace(/\s+/g, "");
  const termLabel = t => `${t.term} ${t.year}`;
  const sameTerm = (a, b) => a.term === b.term && a.year === b.year;
  const sortTerms = list => [...list].sort((a, b) => a.year - b.year || TERM_ORDER[a.term] - TERM_ORDER[b.term]);
  const say = text => { $("message").textContent = text; };

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    if (response.status === 401) {
      location.replace("/LoginUI/Main.html");
      throw new Error("Please log in again.");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  const jsonOptions = (method, body) => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  // ---- actions ----------------------------------------------------------
  async function run(label, action) {
    say(label);
    try {
      await action();
      await load();
    } catch (error) {
      say(error.message);
    }
  }

  const addCourse = (code, target) => run(`Adding ${code} to ${termLabel(target)}...`, async () => {
    await api("/api/mycaps/courses", jsonOptions("POST", { courseCode: pretty(code), term: target.term, year: target.year }));
    say(`${code} added to ${termLabel(target)}.`);
  });

  const moveCourse = (course, target) => {
    if (sameTerm(course, target)) return Promise.resolve();
    return run(`Moving ${course.courseCode}...`, async () => {
      await api(`/api/mycaps/courses/${encodeURIComponent(course.id)}`, jsonOptions("PUT", {
        courseCode: course.courseCode, courseTitle: course.courseTitle,
        term: target.term, year: target.year, notes: course.notes
      }));
      say(`${course.courseCode} moved to ${termLabel(target)}.`);
    });
  };

  const removeCourse = course => run(`Removing ${course.courseCode}...`, async () => {
    await api(`/api/mycaps/courses/${encodeURIComponent(course.id)}`, { method: "DELETE" });
    say(`${course.courseCode} removed from your plan.`);
  });

  const removeTerm = target => run(`Removing ${termLabel(target)}...`, async () => {
    await api(`/api/planner/terms/${target.year}/${encodeURIComponent(target.term)}`, { method: "DELETE" });
    say(`${termLabel(target)} removed.`);
  });

  // ---- drop zones ---------------------------------------------------------
  function makeDropZone(node, onDrop, accepts) {
    node.addEventListener("dragover", event => {
      if (!dragging || !accepts(dragging)) return;
      event.preventDefault();
      node.classList.add("drop-over");
    });
    node.addEventListener("dragleave", () => node.classList.remove("drop-over"));
    node.addEventListener("drop", event => {
      event.preventDefault();
      node.classList.remove("drop-over");
      if (dragging && accepts(dragging)) onDrop(dragging);
      dragging = null;
      document.body.classList.remove("dragging-planned");
    });
  }

  function makeDraggable(node, payload) {
    node.draggable = true;
    node.addEventListener("dragstart", event => {
      dragging = payload;
      // Let a drop pass through the panel's text box and menus to the panel itself.
      document.body.classList.toggle("dragging-planned", payload.kind === "planned");
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData("text/plain", payload.code || payload.id);
      node.classList.add("dragging");
    });
    node.addEventListener("dragend", () => { dragging = null; document.body.classList.remove("dragging-planned"); node.classList.remove("dragging"); });
  }

  // ---- rendering ------------------------------------------------------------
  function termSelect(label, options, onChoose, emptyText = "Add a term first") {
    const select = el("select");
    select.setAttribute("aria-label", label);
    select.appendChild(new Option(options.length ? label : emptyText, ""));
    options.forEach(option => select.appendChild(new Option(option.text, option.value)));
    select.disabled = !options.length;
    select.addEventListener("change", () => {
      if (select.value) onChoose(select.value);
      select.value = "";
    });
    return select;
  }

  const termOptions = () => sortTerms(terms).map(t => ({ text: termLabel(t), value: `${t.year}|${t.term}` }));
  const parseTerm = value => { const [year, term] = value.split("|"); return { year: Number(year), term }; };

  function badgeFor(eligibility) {
    if (!eligibility) return null;
    if (eligibility.status === "recorded-prerequisites-met") return ["ok", "Prerequisites met"];
    if (eligibility.status === "needs-review") return ["warn", "Check prerequisites"];
    return ["unknown", "Prerequisites unverified"];
  }

  function renderBank() {
    const list = $("bankList");
    list.replaceChildren();
    const filter = key($("bankSearch").value);
    const plannedWhere = new Map(courses.map(c => [key(c.courseCode), termLabel(c)]));

    const groups = [...bankGroups];
    if (customCodes.size) {
      groups.push({ title: "Other courses you added", courses: [...customCodes].map(code => ({ code, eligibility: null })) });
    }
    let shown = 0;
    for (const group of groups) {
      const items = group.courses.filter(item => !filter || key(item.code).includes(filter));
      if (!items.length) continue;
      const section = el("div", "bank-group");
      section.appendChild(el("h3", "", group.title));
      const chips = el("div", "chip-list");
      for (const item of items) {
        shown++;
        const where = plannedWhere.get(key(item.code));
        const chip = el("div", "chip" + (where ? " planned" : ""));
        chip.appendChild(el("strong", "", item.code));
        const badge = badgeFor(item.eligibility);
        if (badge) {
          const tag = el("span", "badge " + badge[0], badge[1]);
          if (item.eligibility.message) tag.title = item.eligibility.message;
          chip.appendChild(tag);
        }
        if (where) chip.appendChild(el("small", "", `Planned: ${where}`));
        chip.appendChild(termSelect(`Add ${item.code} to...`, termOptions(), value => addCourse(item.code, parseTerm(value))));
        makeDraggable(chip, { kind: "bank", code: item.code });
        chips.appendChild(chip);
      }
      section.appendChild(chips);
      list.appendChild(section);
    }
    if (!shown) {
      list.appendChild(el("p", "muted", bankGroups.length || customCodes.size
        ? "No courses match that filter."
        : "No open course options were found in your audit. You can add a course below."));
    }
  }

  function plannedCard(course) {
    const card = el("div", "planned-card");
    const row = el("div", "row");
    row.appendChild(el("strong", "", course.courseCode + (course.courseTitle ? " - " + course.courseTitle : "")));
    const remove = el("button", "x", "\u00D7");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${course.courseCode} from ${termLabel(course)}`);
    remove.addEventListener("click", () => removeCourse(course));
    row.appendChild(remove);
    card.appendChild(row);
    if (course.notes) card.appendChild(el("div", "muted", course.notes));
    const others = termOptions().filter(option => option.value !== `${course.year}|${course.term}`);
    card.appendChild(termSelect(`Move ${course.courseCode} to...`, others, value => moveCourse(course, parseTerm(value)), "No other terms yet"));
    makeDraggable(card, { kind: "planned", id: course.id });
    return card;
  }

  function renderTerms() {
    const board = $("terms");
    board.replaceChildren();
    if (!terms.length) {
      board.appendChild(el("p", "muted", "No terms yet. Choose a semester and year above, then select Add term."));
      return;
    }
    for (const target of sortTerms(terms)) {
      const inTerm = courses.filter(course => sameTerm(course, target));
      const box = el("section", "term");
      box.setAttribute("aria-label", termLabel(target));
      const head = el("div", "term-head");
      const titleBlock = el("div");
      titleBlock.append(el("h3", "", termLabel(target)), el("span", "term-count", `${inTerm.length} course${inTerm.length === 1 ? "" : "s"}`));
      head.appendChild(titleBlock);
      const removeButton = el("button", "term-remove", "Remove term");
      removeButton.type = "button";
      removeButton.addEventListener("click", () => removeTerm(target));
      head.appendChild(removeButton);
      box.appendChild(head);

      if (!inTerm.length) box.appendChild(el("div", "term-empty", "Drag a course here"));
      for (const course of inTerm) box.appendChild(plannedCard(course));

      makeDropZone(box, item => {
        if (item.kind === "bank") return addCourse(item.code, target);
        const course = courses.find(c => c.id === item.id);
        if (course) return moveCourse(course, target);
      }, () => true);
      board.appendChild(box);
    }
  }

  function render() {
    renderBank();
    renderTerms();
  }

  // ---- loading ----------------------------------------------------------------
  function buildBank(options) {
    const groups = [];
    for (const requirement of options?.requirements || []) {
      for (const sub of requirement.subrequirements || []) {
        if (sub.statusCode !== "N") continue;
        const seen = new Set();
        const items = [];
        for (const raw of sub.aCodedCoursePatterns || []) {
          const code = pretty(raw);
          if (seen.has(key(code))) continue;
          seen.add(key(code));
          items.push({ code, eligibility: sub.courseEligibility?.[raw] || null });
        }
        if (items.length) groups.push({ title: `${requirement.title}: ${sub.title}`, courses: items });
      }
    }
    return groups;
  }

  async function load() {
    const plan = await api("/api/planner");
    terms = plan.terms || [];
    courses = plan.courses || [];
    render();
  }

  async function init() {
    try {
      const [plan, options] = await Promise.all([
        api("/api/planner"),
        api("/api/student/remaining-course-options").catch(() => null)
      ]);
      terms = plan.terms || [];
      courses = plan.courses || [];
      bankGroups = buildBank(options);
      render();
    } catch (error) {
      say(error.message);
      $("terms").textContent = "Unable to load your plan.";
      $("bankList").textContent = "Unable to load courses.";
    }
  }

  // ---- form and controls ---------------------------------------------------------
  $("termForm").addEventListener("submit", async event => {
    event.preventDefault();
    const target = { term: $("termName").value, year: Number($("termYear").value) };
    const button = $("addTermButton");
    button.disabled = true;
    try {
      await api("/api/planner/terms", jsonOptions("POST", target));
      await load();
      say(`${termLabel(target)} added.`);
    } catch (error) {
      say(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("bankSearch").addEventListener("input", renderBank);

  $("customButton").addEventListener("click", () => {
    const code = pretty($("customCode").value);
    if (!code || code.length > 30 || !/^[A-Z0-9][A-Z0-9 -]*$/.test(code)) {
      say("Enter a course code such as ART 2000.");
      return;
    }
    customCodes.add(code);
    $("customCode").value = "";
    say(`${code} added to the list. Drag it into a term.`);
    renderBank();
  });

  makeDropZone($("bank"), item => {
    const course = courses.find(c => c.id === item.id);
    if (course) removeCourse(course);
  }, item => item.kind === "planned");

  init();
})();
