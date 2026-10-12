const form = document.querySelector(".Input-form");

form.addEventListener("submit", async function(event) {
    event.preventDefault();

    const userID = document.querySelector(".Textbox1").value;
    const password = document.querySelector(".Textbox2").value;

    const userData = {
        id: userID,
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

        if (response.ok) {
            console.log("Login successful");
            console.log(data.user);
        } else {
            console.log("Login failed:", data.error);

            alert(data.error)
        }

    } catch (error) {
        console.error("Login error:", error);
    }
});