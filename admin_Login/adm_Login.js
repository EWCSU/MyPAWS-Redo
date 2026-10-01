const form = document.getElementById("adminLoginForm");

form.addEventListener("submit", function(event) {

    event.preventDefault();

    const userID = document.getElementById("userID").value;
    const password = document.getElementById("password").value;

    const userData = {
        id: userID,
        password: password
    };

    console.log(userData);
});