export function createSheet({ sheet, scrim, body }) {
  let lastFocus = null;

  const close = () => {
    sheet.classList.remove('show');
    scrim.classList.remove('show');
    lastFocus?.focus?.({ preventScroll: true });
  };

  const open = (content) => {
    lastFocus = document.activeElement;
    body.replaceChildren(content);
    sheet.classList.add('show');
    scrim.classList.add('show');
    setTimeout(() => sheet.querySelector('input, button')?.focus({ preventScroll: true }), 350);
  };

  scrim.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('show')) close();
  });

  return { open, close };
}

export function createToast(el) {
  let timer = 0;
  return (text) => {
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 2200);
  };
}
