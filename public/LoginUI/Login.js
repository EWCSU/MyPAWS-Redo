const loginForm = document.getElementById("loginForm");
const codeForm = document.getElementById("codeForm");
const messageEl = document.getElementById("message");

// Where to send the student after a successful login.
// Change this to whatever page should come next.
const REDIRECT_AFTER_LOGIN = "RunDegreeAudit.html";

// Remembers which email we sent a code to, between step 1 and step 2
let pendingEmail = "";

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
    if (messageEl) {
        messageEl.textContent = "";
    }


    const studentID = document.querySelector(".Textbox1").value.trim();
    const password = document.querySelector(".Textbox2").value;

    const email = studentID + "@coyote.csusb.edu";  

    try {
        const result = await postJSON("/api/auth/login", { email: email, password: password });

        console.log("Login response:", result);

        if (result.data.requiresVerification) {
    sessionStorage.setItem("pendingEmail", result.data.email);

    window.location.href = "/LoginUI/CodeCheck.html";
    return;
}
    } catch (error) {
        console.error("Login error:", error);
        messageEl.textContent = "Could not reach the server.";
    }
});
