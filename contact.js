// The address is assembled here so it never appears in the page source (most harvesting bots don't run JS).
const email = ['titusbusolo', 'gmail.com'].join('@');
document.querySelectorAll('[data-email]').forEach(link => {
  link.href = 'mailto:' + email;
  link.setAttribute('aria-label', 'Email ' + email);
});
document.querySelectorAll('[data-email-text]').forEach(el => { el.textContent = email; });

// No server: the form opens the visitor's email app with the message filled in.
const form = document.querySelector('#contact-form');
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const body = `${data.get('message')}\n\n— ${data.get('name')} (${data.get('email')})`;
  location.href = 'mailto:' + email + '?subject=' + encodeURIComponent(data.get('subject')) + '&body=' + encodeURIComponent(body);
});
