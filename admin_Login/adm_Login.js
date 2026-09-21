const form = document.getElementById("adminLoginForm");

form.addEventListener("submit", function(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const loginData = {
        email: email,
        password: password
    };

    const jsonData = JSON.stringify(loginData, null, 2);

    const blob = new Blob([jsonData], {
        type: "application/json"
    });

    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "loginData.json";

    link.click();

    URL.revokeObjectURL(link.href);
});