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
  const rows: number[] = [];
  for (let y = 0; y < h; y += step) rows.push(rowFill(y));
  const cols: number[] = [];
  for (let x = 0; x < w; x += step) cols.push(colFill(x));
  // How many samples to cut from the start of a fill profile. Only a real background is cut:
  // nearly no paper in the strip, then a sharp rise to paper (the sheet's edge). A shadow
  // that darkens the page gradually, a page that fills the frame or a dark table header
  // rise slowly or not at all, and are kept.
  const cut = (fill: number[]) => {
    let i = 0;
    while (i < fill.length - 1 && fill[i] < 0.5) i++;
    if (i === 0) return 0;
    const strip = fill.slice(0, i);
    if (strip.reduce((s, f) => s + f, 0) / strip.length > 0.15) return 0;
    let j = i;
    while (j > 0 && fill[j - 1] >= 0.25) j--;
    return i - j <= Math.max(2, fill.length * 0.08) ? i : 0;
  };
  let y0 = cut(rows) * step;
  let y1 = h - 1 - cut(rows.slice().reverse()) * step;
  let x0 = cut(cols) * step;
  let x1 = w - 1 - cut(cols.slice().reverse()) * step;
  // And never a strip with writing in it.
  if (y0 && hasText(p, 0, 0, w, y0)) y0 = 0;
  if (y1 < h - 1 && hasText(p, 0, y1, w, h)) y1 = h - 1;
  if (x0 && hasText(p, 0, 0, x0, h)) x0 = 0;
  if (x1 < w - 1 && hasText(p, x1, 0, w, h)) x1 = w - 1;
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

/**
 * Whether a strip holds writing: along its rows or along its columns (a page photographed
 * sideways), letter strokes, narrow dips clearly darker than the paper on both sides. Text has
 * them even when it is small and in shadow; a table, a wooden desk, sensor noise or the single
 * edge of the sheet does not.
 */
export function hasText(p: Pixels, x0: number, y0: number, x1: number, y1: number): boolean {
  return strokesAlong(p, x0, y0, x1, y1, false) || strokesAlong(p, x0, y0, x1, y1, true);
}

function strokesAlong(p: Pixels, x0: number, y0: number, x1: number, y1: number, vertical: boolean): boolean {
  const { width: w, data } = p;
  const along = vertical ? y1 - y0 : x1 - x0;
  const across = vertical ? x1 - x0 : y1 - y0;
  if (along < 24 || across < 6) return false;
  const pitch = Math.max(1, Math.round(Math.max(p.width, p.height) / 1800)); // about one stroke width
  const reach = 4; // a stroke is at most this many samples wide
  const lines = Math.max(1, Math.min(400, Math.floor(across / (pitch * 3))));
  const v = new Float32Array(Math.ceil(along / pitch));
  let texty = 0;
  for (let k = 0; k < lines; k++) {
    const c = Math.min(across - 2, Math.floor(((k + 0.5) * across) / lines));
    let n = 0;
    for (let t = 0; t < along; t += pitch, n++) {
      // Average three pixels across the line: steadier against noise, still sharp along it.
      let sum = 0;
      for (let d = -1; d <= 1; d++) {
        const cc = Math.max(0, Math.min(across - 1, c + d));
        const x = vertical ? x0 + cc : x0 + t;
        const y = vertical ? y0 + t : y0 + cc;
        sum += luminance(data, (y * w + x) * 4);
      }
      v[n] = sum / 3;
    }
    let strokes = 0;
    for (let t = reach; t < n - reach; t++) {
      if (v[t] > v[t - 1] || v[t] > v[t + 1]) continue;
      let left = 0;
      let right = 0;
      for (let d = 1; d <= reach; d++) {
        left = Math.max(left, v[t - d]);
        right = Math.max(right, v[t + d]);
      }
      const need = Math.max(20, 0.22 * Math.min(left, right));
      if (left - v[t] > need && right - v[t] > need) {
        strokes++;
        t += reach;
      }
    }
    if (strokes >= 5) texty++;
  }
  return texty / lines > 0.08;
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

/** Box blur of a grayscale channel (running sums along rows, then columns). */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1);
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/**
 * Unsharp mask on a grayscale page: the difference to a blurred copy is added
 * back, so soft, out-of-focus strokes get edges again. Used only when a first
 * reading shows the photo is blurred or small.
 */
export function sharpen(p: Pixels, radius: number, amount: number): Pixels {
  const { width: w, height: h, data } = p;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = luminance(data, i * 4);
  const soft = boxBlur(boxBlur(gray, w, h, radius), w, h, radius);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = gray[i] + amount * (gray[i] - soft[i]);
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data: out };
}
