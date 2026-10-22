const loginForm = document.querySelector(".Input-form");
const codeForm = document.getElementById("codeForm");
const messageEl = document.getElementById("message");

// Where to send the student after a successful login.
// Change this to whatever page should come next.
const REDIRECT_AFTER_LOGIN = "RunDegreeAudit.html";

// Remembers which email we sent a code to, between step 1 and step 2
let pendingEmail = "";

if (loginForm) {
        loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        //test to see if login capturees info
        console.log("LOGIN FORM SUBMITTED");
        if (messageEl) {
            messageEl.textContent = "";
        }

        const email = document.querySelector(".Textbox1")?.value.trim() || "";
        const password = document.querySelector(".Textbox2")?.value || "";

        if (!email || !password) {
            messageEl.textContent = "Please enter both email and password.";
            return;
        }

        const userData = {
            email: email,
            password: password
        };

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!response.ok) {
                console.log("Login failed:", data.error);
                if (messageEl) {
                    messageEl.textContent = data.error || "Login failed.";
                }
                return;
            }

            console.log("Login successful");
            console.log(data.user);

            if (data.requiresVerification) {
                pendingEmail = data.email;
                loginForm.style.display = "none";
                codeForm.style.display = "";
                if (messageEl) {
                    messageEl.textContent =
                        "We emailed you a 6-digit code. It expires in 10 minutes.";
                }
            }

            window.location.href = "/LoginUI/" + REDIRECT_AFTER_LOGIN;
        } catch (error) {
            console.error("Login error:", error);
            if (messageEl) {
                messageEl.textContent = "Could not reach the server.";
            }
        }
    });
}

// Step 2: the emailed code
if (codeForm) {
    codeForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        messageEl.textContent = "";

        const code = document.getElementById("code")?.value.trim() || "";

        if (!pendingEmail) {
            messageEl.textContent = "Please log in again to receive a verification code.";
            return;
        }

        try {
            const response = await fetch("/api/auth/verify-code", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email: pendingEmail, code: code })
            });

            const data = await response.json();

            if (!response.ok) {
                messageEl.textContent = data.error || "Verification failed.";
                return;
            }

            window.location.href = "/LoginUI/" + REDIRECT_AFTER_LOGIN;
        } catch (error) {
            console.error("Verification error:", error);
            messageEl.textContent = "Could not reach the server.";
        }
    });
}

//