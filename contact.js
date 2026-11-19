// No server: the form opens the visitor's email app with the message filled in.
const form = document.querySelector('#contact-form');
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const body = `${data.get('message')}\n\n— ${data.get('name')} (${data.get('email')})`;
  location.href = 'mailto:titusbusolo@gmail.com?subject=' + encodeURIComponent(data.get('subject')) + '&body=' + encodeURIComponent(body);
});
