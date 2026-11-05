// Old bookmarks use the supported reset flow; never offer a fake save action.
(() => {
  const token = new URLSearchParams(location.search).get('token');
  location.replace(token ? '/LoginUI/ResetPassword.html?token=' + encodeURIComponent(token) : '/LoginUI/ForgotPassword.html');
})();
