(() => {
  const names = ['largeText', 'highContrast', 'reduceMotion'];
  const prefs = window.pawsDisplay.applyPreferences();
  names.forEach(name => {
    document.getElementById(name).checked = !!prefs[name];
    document.getElementById(name).addEventListener('change', save);
  });
  function save() {
    const value = Object.fromEntries(names.map(name => [name, document.getElementById(name).checked]));
    try {
      localStorage.setItem('mypaws-display', JSON.stringify(value));
      window.pawsDisplay.applyPreferences();
      document.getElementById('settingsStatus').textContent = 'Display settings saved.';
    } catch { document.getElementById('settingsStatus').textContent = 'Browser storage is unavailable. Settings could not be saved.'; }
  }
  document.getElementById('resetDisplay').addEventListener('click', () => { names.forEach(name => document.getElementById(name).checked = false); save(); });
})();
