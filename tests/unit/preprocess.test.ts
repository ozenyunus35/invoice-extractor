import { describe, expect, it } from "vitest";
import { hasText, paperBox, type Pixels } from "@/lib/preprocess";

/** A grey page of `w`×`h` with lines of "text" (short dark strokes) where `ink` says, on paper of `paper` brightness. */
function page(w: number, h: number, fill: (x: number, y: number) => number): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = fill(x, y);
      data.set([v, v, v, 255], (y * w + x) * 4);
    }
  return { width: w, height: h, data };
}
// Text lines every 24 px, strokes 3 px wide every 8 px: what letters look like to a row of pixels.
const isInk = (x: number, y: number) => y % 24 < 12 && x % 8 < 3;

describe("cropping to the paper", () => {
  it("crops a sheet lying on a dark table", () => {
    const p = page(800, 1000, (x, y) => (x < 100 || x > 700 || y < 100 || y > 900 ? 70 : isInk(x, y) && x > 150 && x < 650 && y > 150 && y < 850 ? 30 : 235));
    const box = paperBox(p)!;
    expect(box.x0).toBeGreaterThan(70);
    expect(box.x1).toBeLessThan(730);
  });

  it("keeps writing under a dark shadow along one side", () => {
    // The page fills the frame; the left 30 % is in deep shadow, the text runs to the edges.
    const p = page(800, 1000, (x, y) => {
      const light = x < 240 ? 0.38 : 1;
      return Math.round((isInk(x, y) && x > 10 && x < 790 ? 25 : 235) * light);
    });
    const box = paperBox(p);
    expect(box === null || box.x0 === 0).toBe(true);
  });

  it("keeps a dark table header band at the top", () => {
    const p = page(800, 1000, (x, y) => (y < 160 ? (isInk(x, y) && x > 20 ? 230 : 20) : isInk(x, y) ? 30 : 235));
    const box = paperBox(p);
    expect(box === null || box.y0 === 0).toBe(true);
  });
});

describe("finding writing in a strip", () => {
  it("sees text, even in shadow", () => {
    const p = page(400, 400, (x, y) => (isInk(x, y) ? 10 : 90));
    expect(hasText(p, 0, 0, 400, 400)).toBe(true);
  });

  it("sees text on a page photographed sideways", () => {
    const p = page(400, 400, (x, y) => (isInk(y, x) ? 30 : 230));
    expect(hasText(p, 0, 0, 400, 400)).toBe(true);
  });

  it("does not mistake a table, its grain or the sheet's edge for text", () => {
    const wood = page(400, 400, (x, y) => Math.round(110 + 20 * Math.sin(x / 9 + 4 * Math.sin(y / 140))));
    expect(hasText(wood, 0, 0, 400, 400)).toBe(false);
    const edge = page(400, 400, (x) => (x < 200 ? 70 : 235));
    expect(hasText(edge, 0, 0, 400, 400)).toBe(false);
    const noisy = page(400, 400, (x, y) => 60 + ((x * 7919 + y * 104729) % 23) - 11); // a dim, grainy table
    expect(hasText(noisy, 0, 0, 400, 400)).toBe(false);
  });
});
