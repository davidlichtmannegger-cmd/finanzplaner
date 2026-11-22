export function enableReorder(list, { itemSelector, handleSelector, onDrop }) {
  let drag = null;

  const items = () => [...list.querySelectorAll(itemSelector)];

  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest(handleSelector);
    if (!handle || !list.contains(handle)) return;
    const item = handle.closest(itemSelector);
    e.preventDefault();
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {}
    const rects = items().map((el) => ({ el, mid: el.getBoundingClientRect().top + el.offsetHeight / 2 }));
    drag = { item, handle, startY: e.clientY, rects, index: rects.findIndex((r) => r.el === item), pointerId: e.pointerId };
    item.classList.add('dragging');
    navigator.vibrate?.(8);
  });

  list.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dy = e.clientY - drag.startY;
    drag.item.style.transform = `translateY(${dy}px)`;
    const y = drag.rects[drag.index].mid + dy;
    let target = drag.rects.filter((r) => r.el !== drag.item && r.mid < y).length;
    drag.target = target;
    const h = drag.item.offsetHeight + 14;
    drag.rects.forEach((r, i) => {
      if (r.el === drag.item) return;
      const from = drag.index;
      let shift = 0;
      if (from < target && i > from && i <= target) shift = -h;
      if (from > target && i < from && i >= target) shift = h;
      r.el.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { item, index, rects } = drag;
    const target = drag.target ?? index;
    rects.forEach((r) => (r.el.style.transform = ''));
    item.classList.remove('dragging');
    drag = null;
    if (target === index) return;
    const ids = rects.map((r) => r.el.dataset.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(target, 0, moved);
    onDrop(ids);
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
}

export const moveId = (ids, id, delta) => {
  const out = [...ids];
  const i = out.indexOf(id);
  const j = Math.max(0, Math.min(out.length - 1, i + delta));
  if (i < 0 || i === j) return out;
  out.splice(i, 1);
  out.splice(j, 0, id);
  return out;
};
