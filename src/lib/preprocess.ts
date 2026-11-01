/*
 * Phone-photo clean-up before OCR, on raw RGBA pixels so it runs anywhere a
 * canvas does:
 * - crop to the sheet of paper (it is brighter than the table under it);
 * - even out lighting: divide by a blurred copy of the page, which removes
 *   the shadow of a hand or a phone and the fall-off towards the edges;
 * - stretch contrast so faint thermal print turns black.
 */

export type Pixels = { width: number; height: number; data: Uint8ClampedArray };

const luminance = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/** Otsu's threshold over a 256-bin histogram. */
function otsu(hist: number[], total: number): number {
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * The bounding box of the paper: rows and columns where most pixels are
 * brighter than Otsu's threshold. Returns null when the image is already
 * all paper (a scan or a screenshot) or no clear sheet stands out.
 */
export function paperBox(p: Pixels): { x0: number; y0: number; x1: number; y1: number } | null {
  const { width: w, height: h, data } = p;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 400));
  const hist = new Array(256).fill(0);
  let n = 0;
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < w; x += step) {
      hist[Math.round(luminance(data, (y * w + x) * 4))]++;
      n++;
    }
  const t = otsu(hist, n);
  const rowFill = (y: number) => {
    let bright = 0;
    let all = 0;
    for (let x = 0; x < w; x += step) {
      all++;
      if (luminance(data, (y * w + x) * 4) > t) bright++;
    }
    return bright / all;
  };
  const colFill = (x: number) => {
    let bright = 0;
    let all = 0;
    for (let y = 0; y < h; y += step) {
      all++;
      if (luminance(data, (y * w + x) * 4) > t) bright++;
    }
    return bright / all;
  };
  let y0 = 0;
  while (y0 < h - 1 && rowFill(y0) < 0.5) y0 += step;
  let y1 = h - 1;
  while (y1 > y0 && rowFill(y1) < 0.5) y1 -= step;
  let x0 = 0;
  while (x0 < w - 1 && colFill(x0) < 0.5) x0 += step;
  let x1 = w - 1;
  while (x1 > x0 && colFill(x1) < 0.5) x1 -= step;
  const margin = 0.015;
  const box = {
    x0: Math.max(0, Math.round(x0 - w * margin)),
    y0: Math.max(0, Math.round(y0 - h * margin)),
    x1: Math.min(w, Math.round(x1 + w * margin)),
    y1: Math.min(h, Math.round(y1 + h * margin)),
  };
  const area = ((box.x1 - box.x0) * (box.y1 - box.y0)) / (w * h);
  // Nothing to crop, or a "sheet" too small to be the document.
  if (area > 0.97 || area < 0.25) return null;
  return box;
}

/** Copies a rectangle out of an RGBA buffer. */
export function crop(p: Pixels, b: { x0: number; y0: number; x1: number; y1: number }): Pixels {
  const width = b.x1 - b.x0;
  const height = b.y1 - b.y0;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) data.set(p.data.subarray(((b.y0 + y) * p.width + b.x0) * 4, ((b.y0 + y) * p.width + b.x1) * 4), y * width * 4);
  return { width, height, data };
}

/**
 * Grayscale page with even lighting and full contrast. The background is the
 * local maximum brightness on a coarse grid (paper), smoothed; each pixel is
 * divided by it, so a shadow over part of the page no longer looks like ink.
 */
export function flatten(p: Pixels): Pixels {
  const { width: w, height: h, data } = p;
  const cell = Math.max(8, Math.round(Math.max(w, h) / 48));
  const gw = Math.ceil(w / cell);
  const gh = Math.ceil(h / cell);
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      // A high percentile rather than the maximum, so specks don't count as paper.
      const vals: number[] = [];
      for (let y = gy * cell; y < Math.min(h, (gy + 1) * cell); y += 2) for (let x = gx * cell; x < Math.min(w, (gx + 1) * cell); x += 2) vals.push(luminance(data, (y * w + x) * 4));
      vals.sort((a, b) => a - b);
      grid[gy * gw + gx] = vals[Math.floor(vals.length * 0.9)] ?? 255;
    }
  // Smooth the grid (3×3 box, twice) so the background has no seams.
  for (let pass = 0; pass < 2; pass++) {
    const copy = grid.slice();
    for (let gy = 0; gy < gh; gy++)
      for (let gx = 0; gx < gw; gx++) {
        let s = 0;
        let c = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const yy = gy + dy;
            const xx = gx + dx;
            if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue;
            s += copy[yy * gw + xx];
            c++;
          }
        grid[gy * gw + gx] = s / c;
      }
  }
  const bg = (x: number, y: number) => {
    // Bilinear lookup in the grid.
    const fx = Math.min(gw - 1, Math.max(0, x / cell - 0.5));
    const fy = Math.min(gh - 1, Math.max(0, y / cell - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(gw - 1, x0 + 1);
    const y1 = Math.min(gh - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const top = grid[y0 * gw + x0] * (1 - tx) + grid[y0 * gw + x1] * tx;
    const bottom = grid[y1 * gw + x0] * (1 - tx) + grid[y1 * gw + x1] * tx;
    return top * (1 - ty) + bottom * ty;
  };
  const out = new Uint8ClampedArray(w * h * 4);
  const norm = new Float32Array(w * h);
  const hist = new Array(256).fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = Math.min(255, (luminance(data, i * 4) / Math.max(24, bg(x, y))) * 255);
      norm[i] = v;
      hist[Math.round(v)]++;
    }
  // Stretch: the darkest 1% becomes black, the paper white.
  let lo = 0;
  for (let acc = 0; lo < 255 && acc + hist[lo] < w * h * 0.01; lo++) acc += hist[lo];
  const hi = 245;
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, ((norm[i] - lo) / Math.max(1, hi - lo)) * 255));
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data: out };
}

/** How much a photo differs from a clean scan: dark borders or uneven light mean it needs clean-up. */
export function looksLikePhoto(p: Pixels): boolean {
  const { width: w, height: h, data } = p;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 200));
  let dark = 0;
  let n = 0;
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < w; x += step) {
      const edge = x < w * 0.06 || x > w * 0.94 || y < h * 0.06 || y > h * 0.94;
      if (!edge) continue;
      n++;
      if (luminance(data, (y * w + x) * 4) < 170) dark++;
    }
  return n > 0 && dark / n > 0.25;
}
