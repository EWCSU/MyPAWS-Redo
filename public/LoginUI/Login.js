const loginForm = document.getElementById("loginForm");
const codeForm = document.getElementById("codeForm");
const messageEl = document.getElementById("message");

// Where to send the student after a successful login.
// Change this to whatever page should come next.
const REDIRECT_AFTER_LOGIN = "RunDegreeAudit.html";

// Remembers which email we sent a code to, between step 1 and step 2
let pendingEmail = "";

    const email = document.querySelector(".Textbox1").value;
    const password = document.querySelector(".Textbox2").value;
async function postJSON(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    return { ok: response.ok, data: data };
}
// Step 1: email + password
loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    messageEl.textContent = "";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
        const result = await postJSON("/api/auth/login", { username: username, password: password });


        if (result.data.requiresVerification) {
            pendingEmail = result.data.email;
            loginForm.style.display = "none";
            codeForm.style.display = "";
            messageEl.textContent = "We emailed you a 6-digit code. It expires in 10 minutes.";
        }
    } catch (error) {
        console.error("Login error:", error);
        messageEl.textContent = "Could not reach the server.";
    }
});

// Step 2: the emailed code
codeForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    messageEl.textContent = "";

    const code = document.getElementById("code").value.trim();

    try {
        const result = await postJSON("/api/auth/verify-code", { email: pendingEmail, code: code });

        if (!result.ok) {
            messageEl.textContent = result.data.error || "Verification failed.";
            return;
        }

        window.location.href = REDIRECT_AFTER_LOGIN;
    } catch (error) {
        console.error("Verification error:", error);
        messageEl.textContent = "Could not reach the server.";
    }
});