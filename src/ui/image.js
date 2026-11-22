export const fitSize = (w, h, max) => {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
};

export const squareCrop = (w, h) => {
  const side = Math.min(w, h);
  return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), side };
};

export const dataUrlBytes = (url) => Math.ceil(((url.length - url.indexOf(',') - 1) * 3) / 4);

async function loadImage(file) {
  if (globalThis.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {}
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function render(source, { sx = 0, sy = 0, sw, sh, w, h }) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
  return canvas;
}

function encode(canvas, maxBytes, quality = 0.82) {
  let q = quality;
  let url = canvas.toDataURL('image/jpeg', q);
  while (dataUrlBytes(url) > maxBytes && q > 0.4) {
    q -= 0.08;
    url = canvas.toDataURL('image/jpeg', q);
  }
  return url;
}

export async function makeGoalImages(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Bitte ein Bild auswählen');
  const img = await loadImage(file);
  const iw = img.width || img.naturalWidth;
  const ih = img.height || img.naturalHeight;
  const big = fitSize(iw, ih, 1000);
  const { sx, sy, side } = squareCrop(iw, ih);
  const bild = encode(render(img, { sw: iw, sh: ih, w: big.w, h: big.h }), 180 * 1024);
  const thumb = encode(render(img, { sx, sy, sw: side, sh: side, w: 240, h: 240 }), 26 * 1024, 0.78);
  img.close?.();
  return { bild, thumb };
}
