
    const $ = id => document.getElementById(id);

    function formatDate(value) {
      if (!value) return "Not available";

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "Not available";
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC"
      });
    }

    async function loadDashboard() {
      try {
        const response = await fetch("/api/student/me", {
          credentials: "same-origin",
          cache: "no-store"
        });

        if (response.status === 401 ||
            response.status === 403) {
          window.location.replace("/LoginUI/Main.html");
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load student data.");
        }

        const data = await response.json();
        const student = data.student;

        $("welcome").textContent =
          "Welcome to MyPAWS";

        $("studentName").textContent =
          student.name || "Not available";

        $("programTitle").textContent =
          student.programTitle || "Not available";

        $("programCode").textContent =
          student.programCode || "Not available";

        const audits = student.degreeAudits || [];

        $("auditCount").textContent =
          String(audits.length);

        $("latestAudit").textContent = audits.length
          ? formatDate(audits[0].runDate)
          : "No reports available";

        const list = $("auditList");
        list.replaceChildren();

        if (audits.length === 0) {
          list.textContent = "No degree audits found.";
          return;
        }

        for (const audit of audits) {
          const item = document.createElement("div");
          item.className = "audit-item";

          const title = document.createElement("strong");
          title.textContent =
            audit.programTitle || "Degree Audit";

          const date = document.createElement("small");
          date.textContent =
            "Generated: " + formatDate(audit.runDate);

          const link = document.createElement("a");

      link.href = "/LoginUI/DegreeAudit.html";
      link.textContent = "View Full Audit";
      link.style.display = "inline-block";
      link.style.marginTop = "12px";
      link.style.color = "#0065BD";
      link.style.fontWeight = "600";

    item.append(title, date, link);
    list.appendChild(item);
        }

      } catch (error) {
        console.error(error);

        $("message").className = "error";
        $("message").textContent =
          "Unable to load your dashboard. Please try again.";
      }
    }

    $("logout").addEventListener("click", async () => {
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin"
        });

        if (!response.ok) {
          throw new Error("Logout failed");
        }

        window.location.replace("/LoginUI/Main.html");

      } catch (error) {
        $("message").textContent =
          "Unable to log out. Please try again.";
      }
    });

async function loadAcademicProgress() {
    try {
        const response = await fetch(
            "/api/student/academic-progress",
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
            throw new Error("Unable to load academic progress.");
        }

        const data = await response.json();
        const progress = data.progress;

        function displayValue(value) {
            return value === null || value === undefined
                ? "Not available"
                : String(value);
        }

        $("cumulativeGPA").textContent =
            displayValue(progress.cumulativeGPA);
	
	$("csusbGPA").textContent =
    	   displayValue(progress.csusbGPA);

	$("majorGPA").textContent =
    	   displayValue(progress.majorGPA);


        $("requiredUnits").textContent =
            displayValue(progress.requiredUnits);

        $("recordedUnits").textContent =
            displayValue(progress.recordedUnits);

        $("remainingUnits").textContent =
            displayValue(progress.remainingUnits);

    } catch (error) {
        console.error("Academic progress error:", error);

        for (const id of [
            "cumulativeGPA",
	    "csusbGPA",
    	    "majorGPA",
            "requiredUnits",
            "recordedUnits",
            "remainingUnits"
        ]) {
            $(id).textContent = "Unavailable";
        }
    }
}

    loadDashboard();
    loadAcademicProgress();
