(() => {
  const list = document.getElementById('reports');
  const filter = document.getElementById('reportRange');
  const order = document.getElementById('reportOrder');
  let student;
  function render() {
    list.replaceChildren();
    const reports = [...(student?.degreeAudits || [])].filter(a => filter.value !== 'recent' || Date.now() - new Date(a.runDate).getTime() <= 30 * 86400000)
      .sort((a,b) => (new Date(b.runDate) - new Date(a.runDate)) * (order.value === 'newest' ? 1 : -1));
    if (!reports.length) { list.textContent = 'No imported reports in this date range. Choose All imported reports to see older records.'; return; }
    for (const audit of reports) {
      const card = document.createElement('article'); card.className = 'portal-card';
      const heading = document.createElement('h3'); heading.textContent = audit.programTitle;
      const date = document.createElement('p'); date.textContent = 'Source audit: ' + new Date(audit.runDate).toLocaleDateString('en-US', { timeZone:'UTC' });
      const link = document.createElement('a'); link.href = 'DegreeAudit.html?auditId=' + encodeURIComponent(audit.id); link.textContent = 'View this audit';
      card.append(heading, date, link); list.append(card);
    }
  }
  filter.addEventListener('change', render); order.addEventListener('change', render);
  window.studentSession.then(value => { student = value; if (student) render(); });
  document.getElementById('runAudit').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    const status = document.getElementById('runStatus'); status.textContent = 'Refreshing your report…';
    try {
      const response = await fetch('/api/student/audit-details', { credentials:'same-origin', cache:'no-store' });
      if (!response.ok) throw new Error('Unable to refresh your audit. Please sign in again or retry.');
      const { audit } = await response.json();
      location.assign('DegreeAudit.html?auditId=' + encodeURIComponent(audit.id));
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  });
})();
