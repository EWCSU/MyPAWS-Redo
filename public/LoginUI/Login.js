const loginForm = document.getElementById("loginForm");
const codeForm = document.getElementById("codeForm");
const messageEl = document.getElementById("message");

let pendingEmail = "";

const REDIRECT_AFTER_LOGIN = "/LoginUI/StudentDashboard.html";

async function postJSON(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(body)
    });

    const data = await response.json();

    return {
        ok: response.ok,
        data
    };
}

// Step 1: Validate email and password
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    loginForm.setAttribute('aria-busy', 'true');
    messageEl.textContent = "Signing in…";

    const email = document.getElementById("email")
        .value.trim();

    const password = document.getElementById("password")
        .value;

    try {
        const result = await postJSON("/api/auth/login", {
            email,
            password
        });

        if (!result.ok) {
            messageEl.textContent =
                result.data.error || "Login failed.";
            return;
        }

        if (result.data.requiresVerification) {
            pendingEmail = result.data.email || email;

            loginForm.hidden = true;
            codeForm.hidden = false;
            document.getElementById('password').value = '';

            messageEl.textContent =
                "A six-digit verification code was sent to your email.";

            document.getElementById("code").focus();
            return;
        }

        messageEl.textContent =
            "Unexpected login response. Please try again.";

    } catch (error) {
        console.error("Login error:", error);
        messageEl.textContent =
            "Could not reach the server.";
    } finally {
        button.disabled = false;
        loginForm.removeAttribute('aria-busy');
    }
});

// Step 2: Verify emailed code
codeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = codeForm.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    codeForm.setAttribute('aria-busy', 'true');
    messageEl.textContent = "Checking your code…";

    const code = document.getElementById("code")
        .value.trim();

    try {
        const result = await postJSON(
            "/api/auth/verify-code",
            {
                email: pendingEmail,
                code
            }
        );

        if (!result.ok) {
            messageEl.textContent =
                result.data.error || "Verification failed.";
            return;
        }


const role = result.data?.user?.role;

if (role === "ADMIN") {
    window.location.href = "/LoginUI/AdminDashboard.html";
} else if (role === "STUDENT") {
    window.location.href = REDIRECT_AFTER_LOGIN;
} else {
    messageEl.textContent = "Unable to determine account role.";
}


    } catch (error) {
        console.error("Verification error:", error);
        messageEl.textContent =
            "Could not reach the server.";
    } finally {
        button.disabled = false;
        codeForm.removeAttribute('aria-busy');
    }
});
