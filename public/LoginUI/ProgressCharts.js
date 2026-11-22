// Progress charts for the student dashboard.
// Plain SVG and DOM calls only: no chart library, no inline scripts, and every
// value is inserted with textContent, so the page's security headers stay intact.
(() => {
  const root = document.getElementById("progressCharts");
  if (!root) return;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const COLORS = { complete: "#2E7D32", progress: "#195AA5", needed: "#C0392B", review: "#64748B" };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    return node;
  }

  const show = value => (value === null || value === undefined ? "Not available" : String(value));
  const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

  function legend(items) {
    const list = el("ul", "pc-legend");
    for (const item of items) {
      const row = el("li");
      const swatch = el("span", "pc-swatch");
      swatch.style.background = item.color;
      row.append(swatch, el("span", "", `${item.label}: ${item.value}`));
      list.appendChild(row);
    }
    return list;
  }

  function card(title) {
    const wrapper = el("div", "pc-chart");
    wrapper.appendChild(el("h3", "", title));
    return wrapper;
  }

  // slices: [{ label, value, color }]. Draws a ring using stroke-dasharray on a
  // circle whose circumference is 100, so each value maps straight to a percent.
  function donutChart(title, slices, centerTop, centerBottom, ariaLabel) {
    const wrapper = card(title);
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    if (!total) {
      wrapper.appendChild(el("p", "pc-note", "No data available for this chart."));
      return wrapper;
    }
    const chart = svgEl("svg", { viewBox: "0 0 36 36", width: "170", height: "170", role: "img", "aria-label": ariaLabel });
    chart.appendChild(svgEl("circle", { cx: 18, cy: 18, r: 15.9155, fill: "none", stroke: "#E2E8F0", "stroke-width": 5 }));
    let offset = 0;
    for (const slice of slices) {
      if (!slice.value) continue;
      const percent = (slice.value / total) * 100;
      chart.appendChild(svgEl("circle", {
        cx: 18, cy: 18, r: 15.9155, fill: "none", stroke: slice.color, "stroke-width": 5,
        "stroke-dasharray": `${percent} ${100 - percent}`,
        "stroke-dashoffset": 25 - offset
      }));
      offset += percent;
    }
    const top = svgEl("text", { x: 18, y: 18.5, "text-anchor": "middle", "font-size": 6, "font-weight": 700, fill: "#192B40" });
    top.textContent = centerTop;
    const bottom = svgEl("text", { x: 18, y: 23, "text-anchor": "middle", "font-size": 2.6, fill: "#64748B" });
    bottom.textContent = centerBottom;
    chart.append(top, bottom);
    wrapper.append(chart, legend(slices.map(s => ({ label: s.label, value: s.value, color: s.color }))));
    return wrapper;
  }

  function stackedBarRow(label, counts) {
    const done = counts.completed;
    const total = counts.completed + counts.inProgress + counts.needsAttention + counts.needsReview;
    const row = el("div", "pc-row");
    const head = el("div", "pc-row-label");
    head.append(el("span", "", label), el("span", "", `${done} of ${total} complete`));
    const bar = el("div", "pc-bar");
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", `${label}: ${counts.completed} completed, ${counts.inProgress} in progress, ${counts.needsAttention} need attention, ${counts.needsReview} need advisor review`);
    for (const [key, className] of [["completed", "c-complete"], ["inProgress", "c-progress"], ["needsAttention", "c-needed"], ["needsReview", "c-review"]]) {
      if (!counts[key]) continue;
      const segment = el("span", className);
      segment.style.width = `${(counts[key] / total) * 100}%`;
      bar.appendChild(segment);
    }
    row.append(head, bar);
    return row;
  }

  function gpaRow(gpa) {
    const row = el("div", "pc-row pc-gpa");
    const head = el("div", "pc-row-label");
    head.append(el("span", "", gpa.label),
      el("strong", "", typeof gpa.value === "number" ? gpa.value.toFixed(3) : "Not available"));
    row.appendChild(head);
    if (typeof gpa.value === "number") {
      const track = el("div", "pc-gpa-track");
      track.setAttribute("role", "img");
      track.setAttribute("aria-label", `${gpa.label} ${gpa.value.toFixed(3)} on a 4.0 scale` +
        (gpa.required ? `, requirement ${gpa.required}` : ""));
      const fill = el("div", "pc-gpa-fill");
      fill.style.width = `${Math.min(Math.max(gpa.value / 4, 0), 1) * 100}%`;
      fill.style.background = gpa.required && gpa.value < gpa.required ? COLORS.needed : COLORS.progress;
      track.appendChild(fill);
      if (gpa.required) {
        const mark = el("div", "pc-gpa-mark");
        mark.style.left = `${Math.min(gpa.required / 4, 1) * 100}%`;
        mark.title = `Requirement: ${gpa.required}`;
        track.appendChild(mark);
      }
      row.appendChild(track);
      if (gpa.required) row.appendChild(el("div", "pc-note", `Requirement: ${gpa.required} (marker on the bar). Scale 0 to 4.0.`));
    } else if (gpa.explanation) {
      row.appendChild(el("div", "pc-note", gpa.explanation));
    }
    return row;
  }

  function unitsBars(rows) {
    const max = Math.max(...rows.map(row => row.units));
    const list = el("div");
    for (const item of rows) {
      const row = el("div", "pc-row");
      const head = el("div", "pc-row-label");
      head.append(el("span", "", item.title), el("span", "", `${item.units} units`));
      const bar = el("div", "pc-bar");
      bar.setAttribute("role", "img");
      bar.setAttribute("aria-label", `${item.title}: ${item.units} units still needed`);
      const fill = el("span", "c-needed");
      fill.style.width = `${(item.units / max) * 100}%`;
      bar.appendChild(fill);
      row.append(head, bar);
      list.appendChild(row);
    }
    return list;
  }

  function tile(label, value, hint) {
    const node = el("div", "pc-tile");
    node.append(el("span", "", label), el("strong", "", value));
    if (hint) node.appendChild(el("small", "", hint));
    return node;
  }

  function render(overview) {
    root.replaceChildren();
    root.appendChild(el("h2", "", "Degree Progress at a Glance"));
    root.appendChild(el("p", "pc-note", (overview.program ? overview.program + " \u2014 " : "") + "figures come from your imported degree audit, not live records."));

    const { sections, units, courses, needed } = overview;
    const overall = overview.gpas.find(gpa => gpa.key === "overall");

    const tiles = el("div", "pc-tiles");
    tiles.append(
      tile("Overall GPA", overall && typeof overall.value === "number" ? overall.value.toFixed(3) : "Not available"),
      tile("Classes completed", String(courses.passed), "Distinct courses with a passing letter grade"),
      tile("Classes in progress", String(courses.inProgress)),
      tile("Classes still needed", needed.coursesApprox === null ? "Not reported" : "About " + needed.coursesApprox,
        needed.coursesApprox === null ? "The audit gives no course count for open sections" : "Estimate from the audit's open sections, which can overlap"),
      tile("Sections needing attention", String(needed.unfulfilledSections), `of ${plural(sections.total, "requirement section")}`)
    );
    root.appendChild(tiles);

    const grid = el("div", "pc-grid");

    grid.appendChild(donutChart("Requirement sections by status", [
      { label: "Completed", value: sections.completed, color: COLORS.complete },
      { label: "In progress", value: sections.inProgress, color: COLORS.progress },
      { label: "Needs attention", value: sections.needsAttention, color: COLORS.needed },
      { label: "Needs advisor review", value: sections.needsReview, color: COLORS.review }
    ], `${sections.completed}/${sections.total}`, "sections complete",
    `${sections.completed} of ${sections.total} requirement sections completed`));

    const haveUnits = units.required !== null && units.recorded !== null;
    const unitsLeft = units.needed !== null ? units.needed : (haveUnits ? Math.max(units.required - units.recorded, 0) : 0);
    if (haveUnits) {
      const unitsCard = donutChart("Units toward graduation", [
        { label: "Units recorded", value: units.recorded, color: COLORS.complete },
        { label: "Units still needed", value: unitsLeft, color: COLORS.needed }
      ], `${units.recorded}/${units.required}`, "units recorded",
      `${units.recorded} of ${units.required} required units recorded`);
      unitsCard.appendChild(el("p", "pc-note",
        `Recorded units can include in-progress work. In-progress units found in your coursework: ${units.inProgress}.`));
      grid.appendChild(unitsCard);
    } else {
      const unitsCard = card("Units toward graduation");
      unitsCard.appendChild(el("p", "pc-note", "Unit totals are not available in this audit."));
      grid.appendChild(unitsCard);
    }

    const groupsCard = card("Progress by requirement area");
    if (overview.groups.length) {
      for (const group of overview.groups) groupsCard.appendChild(stackedBarRow(group.name, group));
      groupsCard.appendChild(legend([
        { label: "Completed", value: "green", color: COLORS.complete },
        { label: "In progress", value: "blue", color: COLORS.progress },
        { label: "Needs attention", value: "red", color: COLORS.needed },
        { label: "Advisor review", value: "gray", color: COLORS.review }
      ]));
    } else {
      groupsCard.appendChild(el("p", "pc-note", "No requirement sections found."));
    }
    grid.appendChild(groupsCard);

    const gpaCard = card("GPA");
    for (const gpa of overview.gpas) gpaCard.appendChild(gpaRow(gpa));
    grid.appendChild(gpaCard);

    const coursesCard = donutChart("Courses in your audit", [
      { label: "Completed (passing grade)", value: courses.passed, color: COLORS.complete },
      { label: "In progress", value: courses.inProgress, color: COLORS.progress },
      { label: "Failing grade only", value: courses.failedOnly, color: COLORS.needed },
      { label: "Other result (verify)", value: courses.other, color: COLORS.review }
    ], String(courses.total), "distinct courses", `${courses.total} distinct courses: ${courses.passed} completed, ${courses.inProgress} in progress`);
    grid.appendChild(coursesCard);

    if (needed.unitsBySection.length) {
      const neededCard = card("Units still needed, largest sections");
      neededCard.appendChild(unitsBars(needed.unitsBySection));
      grid.appendChild(neededCard);
    }

    root.appendChild(grid);

    for (const note of overview.notes) root.appendChild(el("p", "pc-note", note));
  }

  async function load() {
    root.replaceChildren(el("p", "pc-note", "Loading degree progress..."));
    try {
      const auditId = new URLSearchParams(location.search).get("auditId");
      const url = "/api/progress/overview" + (auditId ? "?auditId=" + encodeURIComponent(auditId) : "");
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        location.replace("/LoginUI/Main.html");
        return;
      }
      if (!response.ok) throw new Error("Unable to load degree progress.");
      render((await response.json()).overview);
    } catch (error) {
      console.error(error);
      root.replaceChildren(el("p", "pc-error", error.message || "Unable to load degree progress."));
    }
  }

  load();
})();
