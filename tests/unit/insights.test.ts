import { describe, expect, it } from "vitest";
import { docChecks, sampleDocs } from "@/lib/documents";
import { daysBetween, findDuplicates, overview, payStatus } from "@/lib/insights";

describe("cross-document insights", () => {
  const docs = sampleDocs();
  const byId = (id: string) => docs.find((d) => d.id === id)!;

  it("matches invoices to the statement lines that paid them", () => {
    const ridgeline = payStatus(byId("ridgeline"), docs, "2026-11-01");
    expect(ridgeline.kind).toBe("paid");
    if (ridgeline.kind === "paid") expect(ridgeline.payment.tx).toMatchObject({ date: "2026-10-20", amount: -2910 });
    expect(payStatus(byId("halcyon"), docs, "2026-11-01").kind).toBe("paid");
  });

  it("works out overdue and upcoming invoices", () => {
    expect(payStatus(byId("brauer"), docs, "2026-11-01")).toEqual({ kind: "overdue", days: 4 });
    expect(payStatus(byId("brauer"), docs, "2026-10-20")).toEqual({ kind: "due", days: 8 });
    expect(payStatus(byId("kettle"), docs, "2026-11-01").kind).toBe("none");
    expect(daysBetween("2026-10-28", "2026-11-01")).toBe(4);
  });

  it("flags the same invoice uploaded twice", () => {
    const copy = { ...byId("halcyon"), id: "copy", name: "halcyon (1).png" };
    const dupes = findDuplicates([...docs, copy]);
    expect(dupes.get("copy")?.id).toBe("halcyon");
    expect(findDuplicates(docs).size).toBe(0);
  });

  it("summarises totals and VAT per currency", () => {
    const o = overview(docs, (d) => docChecks(d).some((c) => c.status === "fail"));
    expect(o.bills).toHaveLength(5);
    expect(o.statements).toHaveLength(1);
    expect(o.attention).toBe(1);
    expect(o.byCurrency.find((c) => c.currency === "USD")).toMatchObject({ total: 3435.87, count: 2 });
    expect(o.vatByRate.filter((v) => v.currency === "EUR")).toEqual([
      { currency: "EUR", rate: 7, base: 161.4, vat: 11.3 },
      { currency: "EUR", rate: 19, base: 145, vat: 27.55 },
    ]);
  });
});
