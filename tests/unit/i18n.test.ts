import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { misses, translate } from "@/lib/i18n";
import { TR } from "@/lib/tr";
import { sampleDocs, docChecks } from "@/lib/documents";
import { validateInvoice } from "@/lib/validate";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("Turkish interface", () => {
  it("has a translation for every literal passed to t()", () => {
    const keys = new Set<string>();
    for (const f of files("src")) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(JSON.parse(`"${m[1]}"`));
      // t(cond ? "a" : "b", ...) picks between two literals.
      for (const m of src.matchAll(/\bt\([^()]*?\?\s*"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
        keys.add(JSON.parse(`"${m[1]}"`));
        keys.add(JSON.parse(`"${m[2]}"`));
      }
    }
    const missing = [...keys].filter((k) => TR[k] === undefined);
    expect(missing).toEqual([]);
    expect(keys.size).toBeGreaterThan(150);
  });

  it("translates sentences built in code, keeping numbers and names", () => {
    expect(translate("tr", "Missing: vendor, date")).toBe("Eksik: satıcı, tarih");
    expect(translate("tr", "Items sum to 480.00, document says 485.00 (off by 5.00)")).toBe("Kalemlerin toplamı 480.00, belgede 485.00 yazıyor (5.00 fark)");
    expect(translate("tr", "SaaS invoice · US")).toBe("SaaS faturası · ABD");
    expect(translate("tr", "Income Statement: subtotals")).toBe("Income Statement: ara toplamlar");
    expect(translate("tr", "{n} lines", { n: 20 })).toBe("20 satır");
    expect(translate("en", "{n} lines", { n: 20 })).toBe("20 lines");
  });

  it("translates every check on the sample documents", () => {
    misses.clear();
    for (const d of sampleDocs()) for (const c of docChecks(d)) [c.label, c.detail].forEach((x) => translate("tr", x));
    expect([...misses]).toEqual([]);
  });

  it("translates failing invoice checks too", () => {
    misses.clear();
    const inv = sampleDocs()[0].invoice;
    const broken = { ...inv, subtotal: { ...inv.subtotal, value: 1 }, total: { ...inv.total, value: 2 }, items: inv.items.map((i) => ({ ...i, amount: i.amount + 1 })) };
    for (const c of validateInvoice(broken)) [c.label, c.detail].forEach((x) => translate("tr", x));
    expect([...misses]).toEqual([]);
  });
});
