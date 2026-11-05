
const form = document.getElementById("resetPasswordForm");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitButton");

// Retrieve the reset token from the emailed link.
let resetToken = new URLSearchParams(
    window.location.search
).get("token");

// Remove the token from the visible browser URL.
window.history.replaceState(null, "", window.location.pathname);

// Check that the token has the correct format.
if (!resetToken || !/^[a-f0-9]{64}$/.test(resetToken)) {
    resetToken = null;
    message.textContent =
        "Invalid reset link. Please request a new one.";
    submitButton.disabled = true;
    form.hidden = true;
    document.getElementById('resetInstructions').hidden = true;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = document.getElementById("password").value;
    const confirmPassword =
        document.getElementById("confirmPassword").value;

    if (!resetToken) {
        message.textContent = "Invalid reset link.";
        return;
    }

    if (
        password.length < 8 ||
        !/[A-Za-z]/.test(password) ||
        !/\d/.test(password)
    ) {
        message.textContent =
            "Password must have at least 8 characters, one letter, and one number.";
        return;
    }

    if (password !== confirmPassword) {
        message.textContent = "Passwords do not match.";
        document.getElementById('confirmPassword').focus();
        return;
    }

    submitButton.disabled = true;
    message.textContent = "Updating password...";

    try {
        const response = await fetch("/api/auth/reset-password", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: resetToken,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Unable to reset password."
            );
        }

        
message.textContent = data.message;

resetToken = null;
form.reset();
form.hidden = true;

document.getElementById("resetInstructions").hidden = true;


    } catch (error) {
        message.textContent = error.message;

    } finally {
        submitButton.disabled = false;
    }
});
