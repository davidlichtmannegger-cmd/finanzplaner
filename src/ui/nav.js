export const PAGE_COUNT = 4;

export const clampPage = (index) => Math.max(0, Math.min(PAGE_COUNT - 1, index));

export function swipeTarget(current, dx, dy, threshold = 60) {
  if (Math.abs(dx) <= threshold || Math.abs(dx) <= Math.abs(dy) * 1.5) return current;
  return clampPage(current + (dx < 0 ? 1 : -1));
}

export function createNav({ pages, tabs, onChange }) {
  let current = 0;

  const go = (index) => {
    current = clampPage(index);
    pages.style.transform = `translateX(-${current * (100 / PAGE_COUNT)}%)`;
    tabs.forEach((tab) => {
      const active = Number(tab.dataset.i) === current;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-current', active ? 'page' : 'false');
    });
    onChange?.(current);
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => go(Number(tab.dataset.i))));

  let startX = null;
  let startY = 0;
  pages.addEventListener(
    'touchstart',
    (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    },
    { passive: true }
  );
  pages.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const touch = e.changedTouches[0];
    go(swipeTarget(current, touch.clientX - startX, touch.clientY - startY));
    startX = null;
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') go(current + 1);
    if (e.key === 'ArrowLeft') go(current - 1);
  });

  return {
    go,
    get current() {
      return current;
    }
  };
}
