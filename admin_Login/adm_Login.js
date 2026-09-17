console.log("adm_Login.js loaded");

const form = document.getElementById("adminLoginForm");
const jsonData = JSON.stringify();

form.addEventListener("submit", function(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const loginData = {
        email: email, 
        password: password
    };
    body: JSON.stringify(loginData);
    console.log(loginData);
});