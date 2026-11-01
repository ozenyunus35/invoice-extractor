// Prints the rebuilt lines of cached OCR readings and what the readers make of them:
// DOC=photo-inv-tr-modern,/abs/path/words.json npx vitest run -c vitest.eval.config.ts tests/eval/show.test.ts
import { readFileSync } from "node:fs";
import { it } from "vitest";
import { classifyDocument } from "@/lib/classify";
import { extractInvoice } from "@/lib/extract";
import { wordsToLines } from "@/lib/layout";
import { extractReport } from "@/lib/report";

it.skipIf(!process.env.DOC)("show", () => {
  for (const name of (process.env.DOC ?? "").split(",")) {
    const path = name.endsWith(".json") ? name : `corpus/ocr/${name}.json`;
    const lines = wordsToLines(JSON.parse(readFileSync(path, "utf8")).words);
    const kind = classifyDocument(lines);
    console.log(`\n=== ${name} (${JSON.stringify(kind)})\n` + lines.map((l) => l.text).join("\n"));
    if (process.env.REPORT) console.log(JSON.stringify(extractReport(lines).tables?.map((t: { title?: string; kind?: string; rows?: unknown[] }) => [t.title, t.kind, t.rows?.length])));
    else {
      const inv = extractInvoice(lines);
      console.log(`--- date ${inv.date.value} due ${inv.dueDate.value} cur ${inv.currency.value} vat ${JSON.stringify(inv.vat.map((v) => [v.rate, v.amount]))} items ${JSON.stringify(inv.items.map((i) => [i.quantity, i.unitPrice, i.amount]))}`);
    }
  }
});
