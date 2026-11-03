
async function loadAdminOverview() {
    const status = document.getElementById("status");

    try {
        const response = await fetch("/api/admin/overview", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (response.status === 401) {
            window.location.replace("/LoginUI/Main.html");
            return;
        }

        if (response.status === 403) {
            status.textContent = "Admin access only.";
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load admin overview.");
        }

        const data = await response.json();
        const overview = data.overview;

        document.getElementById("studentAccounts")
            .textContent = overview.studentAccounts;

        document.getElementById("adminAccounts")
            .textContent = overview.adminAccounts;

        document.getElementById("studentRecords")
            .textContent = overview.studentRecords;

        status.textContent = "Administrator access verified.";
	await loadAdminAccounts();

    } catch (error) {
        console.error(error);
        status.textContent = "Unable to load admin dashboard.";
    }
}

document.getElementById("logoutButton")
    .addEventListener("click", async () => {
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            });

            if (!response.ok) {
                throw new Error("Logout failed.");
            }

            window.location.replace("/LoginUI/Main.html");

        } catch (error) {
            document.getElementById("status")
                .textContent = "Unable to log out.";
        }
    });

async function loadAdminAccounts() {
    const status = document.getElementById("accountsStatus");
    const tbody = document.getElementById("accountsTableBody");

    try {
        const response = await fetch("/api/admin/accounts", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (response.status === 401) {
            window.location.replace("/LoginUI/Main.html");
            return;
        }

        if (response.status === 403) {
            status.textContent = "Admin access only.";
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to retrieve accounts.");
        }

        const data = await response.json();

        tbody.replaceChildren();

        for (const account of data.accounts) {
            const row = document.createElement("tr");

            const values = [
                account.email,
                account.studentRecordLinked ? "Yes" : "No",
                account.status,
                account.failedLoginAttempts
            ];


for (const value of values) {
    const cell = document.createElement("td");
    cell.textContent = String(value ?? "—");
    row.appendChild(cell);
}

// Create the account action column.
const actionCell = document.createElement("td");

if (account.status === "Temporarily Locked") {
    const unlockButton = document.createElement("button");

    unlockButton.type = "button";
    unlockButton.className = "unlock-button";
    unlockButton.textContent = "Unlock Account";

    unlockButton.addEventListener("click", async () => {
        const confirmed = confirm(
            `Unlock the test account ${account.email}?`
        );

        if (!confirmed) return;

        unlockButton.disabled = true;

        try {
            const response = await fetch(
                `/api/admin/accounts/${encodeURIComponent(account.id)}/unlock`,
                {
                    method: "POST",
                    credentials: "same-origin"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to unlock account."
                );
            }

            await loadAdminAccounts();

            status.textContent =
                "Student account unlocked successfully.";

        } catch (error) {
            console.error(error);
            status.textContent = error.message;
        } finally {
            unlockButton.disabled = false;
        }
    });

    actionCell.appendChild(unlockButton);
} else {
    actionCell.textContent = "No action needed";
}

row.appendChild(actionCell);
tbody.appendChild(row);

        }

        status.textContent =
            `${data.totalAccounts} student test account(s) found.`;

    } catch (error) {
        console.error(error);
        status.textContent = "Unable to load student accounts.";
    }
}

loadAdminOverview();
