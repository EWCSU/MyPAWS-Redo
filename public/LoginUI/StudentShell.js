(() => {
  const root = document.documentElement;
  function applyPreferences() {
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem('mypaws-display') || '{}'); } catch {}
    root.classList.toggle('large-text', !!prefs.largeText);
    root.classList.toggle('high-contrast', !!prefs.highContrast);
    root.classList.toggle('reduce-motion', !!prefs.reduceMotion);
    return prefs;
  }
  applyPreferences();
  const header = document.querySelector('[data-student-header]');
  header.innerHTML = `
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <a class="portal-brand" href="StudentDashboard.html"><img src="/assets/mypaws-paw-icon.png" width="52" height="52" alt="">myPAWS <small>REDO</small></a>
    <nav aria-label="Student navigation">
      <details class="paws-menu"><summary>PAWS</summary><div class="paws-links">
        <a href="StudentDashboard.html">Dashboard</a><a href="DegreeAudit.html">My degree audit</a>
        <a href="RunDegreeAudit.html">Run / manage audits</a><a href="RemainingRequirements.html">Remaining requirements</a>
        <a href="Coursework.html">My coursework</a>
      </div></details>
      <a href="MyCAPS.html">myCAPs</a>
      <a href="https://mycoyote.csusb.edu/" target="_blank" rel="noopener noreferrer" title="Opens myCoyote in a new tab. Choose Academics, then Schedule Planner.">Schedule Builder <span aria-hidden="true">↗</span><span class="sr-only"> (myCoyote, new tab)</span></a>
      <a href="https://www.csusb.edu/advising/advising-tools/undergraduate-roadmaps" target="_blank" rel="noopener noreferrer">UGRD Roadmaps <span aria-hidden="true">↗</span><span class="sr-only"> (new tab)</span></a>
      <a href="https://www.csusb.edu/catalog" target="_blank" rel="noopener noreferrer">Course Catalog <span aria-hidden="true">↗</span><span class="sr-only"> (new tab)</span></a>
      <a href="Comments.html">Comments</a>
    </nav>
    <div class="portal-account"><span>Undergraduate</span><a href="Settings.html">Settings</a><button type="button" id="portalLogout">Log out</button></div>`;
  const main = document.querySelector('main');
  if (main) { main.id = 'main-content'; main.tabIndex = -1; }
  const page = location.pathname.split('/').pop();
  header.querySelectorAll('a').forEach(a => {
    if (a.getAttribute('href') === page) a.setAttribute('aria-current', 'page');
  });
  if (header.querySelector('.paws-links [aria-current]')) header.querySelector('.paws-menu').classList.add('current');
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') header.querySelectorAll('details[open]').forEach(d => { d.open = false; d.querySelector('summary').focus(); });
  });
  document.addEventListener('click', e => {
    header.querySelectorAll('details[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; });
  });
  const status = document.createElement('p');
  status.className = 'portal-status'; status.setAttribute('role', 'status');
  header.after(status);
  document.getElementById('portalLogout').addEventListener('click', async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Unable to log out. Please try again.');
      location.replace('/LoginUI/Main.html');
    } catch (error) { status.textContent = error.message; }
  });
  window.studentSession = fetch('/api/student/me', { credentials: 'same-origin', cache: 'no-store' }).then(async response => {
    if (response.status === 401 || response.status === 403) { location.replace('/LoginUI/Main.html'); return null; }
    if (!response.ok) throw new Error('Unable to load your student account. Please reload this page.');
    return (await response.json()).student;
  }).catch(error => { status.textContent = error.message; return null; });
  window.pawsDisplay = { applyPreferences };
  document.querySelectorAll('[data-print]').forEach(button => button.addEventListener('click', () => window.print()));
  let expandedForPrint = [];
  window.addEventListener('beforeprint', () => {
    expandedForPrint = [...document.querySelectorAll('main details:not([open])')];
    expandedForPrint.forEach(detail => { detail.open = true; });
  });
  window.addEventListener('afterprint', () => {
    expandedForPrint.forEach(detail => { detail.open = false; });
    expandedForPrint = [];
  });
})();
