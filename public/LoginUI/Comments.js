(() => {
  const form = document.getElementById('commentForm');
  const select = document.getElementById('recipient');
  const email = document.getElementById('recipientEmail');
  select.addEventListener('change', () => {
    email.value = select.value; email.readOnly = !!select.value;
    document.getElementById('commentPreview').hidden = true;
  });
  form.addEventListener('input', () => { document.getElementById('commentPreview').hidden = true; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!await window.studentSession || !form.reportValidity()) return;
    const recipient = email.value.trim();
    const subject = document.getElementById('subject').value.trim();
    const body = document.getElementById('commentBody').value.trim();
    if (!subject || !body || /[\r\n]/.test(recipient)) return;
    document.getElementById('previewText').textContent = `To: ${recipient}\nSubject: ${subject}\n\n${body}`;
    document.getElementById('openEmail').href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const preview = document.getElementById('commentPreview'); preview.hidden = false; preview.focus();
  });
})();
