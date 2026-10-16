const form = document.querySelector(".Forgot-form");
const message = document.querySelector(".message");

form.addEventListener("submit", async function(event) {

    event.preventDefault();

    const email = document.querySelector(".EmailBox").value;

    const resetData = {
        email: email
    };

    try {

        const response = await fetch("/api/auth/forgot-password", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(resetData)

        });

        const data = await response.json();

        if (response.ok) {

            message.textContent =
                "If an account exists with that email, a reset link has been sent.";

        } else {

            message.textContent =
                data.error || "Unable to process password reset.";

        }

    } catch (error) {

        console.error("Forgot password error:", error);

        message.textContent =
            "Password reset service is currently unavailable.";
    }

});