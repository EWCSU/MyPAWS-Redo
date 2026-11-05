(() => {
  let preferences = {};
  try { preferences = JSON.parse(localStorage.getItem('mypaws-display') || '{}') || {}; } catch {}
  for (const [key, name] of [['largeText','large-text'], ['highContrast','high-contrast'], ['reduceMotion','reduce-motion']]) {
    document.documentElement.classList.toggle(name, !!preferences[key]);
  }
  document.querySelectorAll('input[type="password"]').forEach(input => {
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'password-toggle';
    toggle.textContent = 'Show password'; toggle.setAttribute('aria-controls', input.id);
    toggle.setAttribute('aria-pressed', 'false');
    toggle.addEventListener('click', () => {
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      toggle.textContent = reveal ? 'Hide password' : 'Show password';
      toggle.setAttribute('aria-pressed', String(reveal));
    });
    input.after(toggle);
  });
})();
