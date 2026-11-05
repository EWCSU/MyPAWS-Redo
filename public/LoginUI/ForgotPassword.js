
const form = document.getElementById("forgotPasswordForm");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitButton");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email")
        .value.trim();

    submitButton.disabled = true;
    message.textContent = "Sending request...";

    try {
        const response = await fetch("/api/auth/forgot-password", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                response.status === 429
                    ? "Too many requests. Please try again later."
                    : "Unable to process your request."
            );
        }

        message.textContent = data.message;

        form.reset();

    } catch (error) {
        console.error("Password reset request failed.");
        message.textContent = error.message;

    } finally {
        submitButton.disabled = false;
    }
});
