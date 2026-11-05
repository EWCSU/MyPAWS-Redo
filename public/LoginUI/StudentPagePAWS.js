async function loadPAWSReport() {
    try {
        const response = await fetch("/api/report");

        const data = await response.json();

        if (!response.ok) {
            console.error("Report error:", data.error);
            return;
        }

        const student = data.student;
        const courses = data.courses;
        const requirements = data.requirements;
        const subrequirements = data.subrequirements;


        // General student information
        document.querySelector(".GeneralSudentInfo").innerHTML = `
            <h3>Student Information</h3>
            <p><strong>Name:</strong> ${student.name}</p>
            <p><strong>Student ID:</strong> ${student.studentNumber}</p>
            <p><strong>Program:</strong> ${student.degreeProgram}</p>
            <p><strong>Degree:</strong> ${student.degreeTitle}</p>
            <p><strong>Audit Date:</strong> ${student.runDate}</p>
        `;


        // Calculates total completed/in-progress units
        let completedUnits = 0;
        let inProgressUnits = 0;

        courses.forEach(course => {
            if (course.inProgress) {
                inProgressUnits += course.units;
            } else {
                completedUnits += course.units;
            }
        });


        document.querySelector(".UnitandGPA").innerHTML = `
            <h3>Units</h3>
            <p><strong>Completed:</strong> ${completedUnits.toFixed(1)}</p>
            <p><strong>In Progress:</strong> ${inProgressUnits.toFixed(1)}</p>
        `;


        // Course list
        let courseHTML = `
            <h3>Coursework</h3>

            <table>
                <tr>
                    <th>Course</th>
                    <th>Term</th>
                    <th>Units</th>
                    <th>Grade</th>
                    <th>Status</th>
                </tr>
        `;

        courses.forEach(course => {
            const status = course.inProgress
                ? "In Progress"
                : "Completed";

            courseHTML += `
                <tr>
                    <td>${course.code}</td>
                    <td>${course.term}</td>
                    <td>${course.units.toFixed(1)}</td>
                    <td>${course.grade || "-"}</td>
                    <td>${status}</td>
                </tr>
            `;
        });

        courseHTML += `</table>`;

        document.querySelector(".CourseWork").innerHTML =
            courseHTML;


        // Degree requirements
        // Degree requirements
        let requirementsHTML = `
            <h3>Degree Requirements</h3>
        `;

        const groupedRequirements = {};

        requirements.forEach(requirement => {
            const category =
                requirement.category ||
                "Other Requirements";

            if (!groupedRequirements[category]) {
                groupedRequirements[category] = [];
            }

            groupedRequirements[category].push(requirement);
        });

        Object.entries(groupedRequirements).forEach(([category, group]) => {

            requirementsHTML += `
                <div class="requirement-group">
                    <h4>${category}</h4>
            `;

            group.forEach(requirement => {

                const status = requirement.status;

                const requirementTitle =
                    requirement.label ||
                    requirement.name ||
                    "Requirement";

                requirementsHTML += `
                    <div class="requirement">
                        <strong>${requirementTitle}</strong>
                        <span> - ${status}</span>
                `;

                if (requirement.requiredHours > 0) {
                    requirementsHTML += `
                        <p>
                            Hours:
                            ${requirement.completedHours}
                            / ${requirement.requiredHours}
                        </p>
                    `;
                }

                const matchingSubs = subrequirements.filter(
                    sub => sub.rtabx === requirement.rtabx
                );

                matchingSubs.forEach(sub => {

                    const subStatus = sub.status;

                    requirementsHTML += `
                        <div class="subrequirement">
                            ${sub.title}
                            - ${subStatus}
                        </div>
                    `;
                });

                requirementsHTML += `
                    </div>
                `;
            });

            requirementsHTML += `
                </div>
            `;
        });

        document.querySelector(".Graphs").innerHTML =
            requirementsHTML;
                document.querySelector(".Legend").innerHTML = `
                    <h3>Legend</h3>
                    <p>Completed</p>
                    <p>In Progress</p>
                    <p>Remaining</p>
                `;


    } catch (error) {
        console.error("Could not load PAWS report:", error);
    }
}


loadPAWSReport();