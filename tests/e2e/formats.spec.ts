import { expect, test, type Page } from "@playwright/test";

// Invoices arrive as Word and Excel files, CSV exports and e-mails as often as PDFs.

const openData = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 1200) < 1024) await page.getByRole("tab", { name: "Extracted data" }).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByTestId("total")).toBeVisible();
});

for (const [file, total, kind] of [
  ["inv-de-multi-vat.docx", "€18,082.21", "Word document"],
  ["inv-de-multi-vat.xlsx", "€18,082.21", "Excel workbook"],
  ["inv-tr-discount.odt", "₺6,485.09", "OpenDocument text"],
  ["inv-fr-classic.csv", "€5,002.80", "CSV file"],
  ["inv-pl-classic.eml", "1,652.73 zł", "E-mail"],
] as const) {
  test(`reads an invoice sent as ${kind}`, async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles(`tests/e2e/fixtures/${file}`);
    await expect(page.getByRole("navigation", { name: "Documents" }).getByText(kind).first()).toBeVisible({ timeout: 20_000 });
    await openData(page);
    await expect(page.getByTestId("total")).toContainText(total.replace(/[^\d.,]/g, ""));
    await expect(page.getByTestId("summary")).toContainText("checks pass");
  });
}

test("an old .doc file gets told what to do", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles({ name: "invoice.doc", mimeType: "application/msword", buffer: Buffer.from("old") });
  await expect(page.getByRole("status").filter({ hasText: /Save it as PDF/ }).first()).toBeVisible();
});

test("phones get a camera button", async ({ page }) => {
  const isPhone = (page.viewportSize()?.width ?? 1200) < 1024;
  await expect(page.getByRole("button", { name: "Take a photo" })).toBeVisible({ visible: isPhone });
  await expect(page.getByTestId("camera-input")).toHaveAttribute("capture", "environment");
});

test("a second page can be added to an uploaded document", async ({ page }) => {
  test.setTimeout(60_000);
  await page.getByTestId("file-input").setInputFiles("tests/e2e/fixtures/statement-tr.pdf");
  const nav = page.getByRole("navigation", { name: "Documents" });
  await expect(nav.getByText("Örnek Katılım Bankası")).toBeVisible({ timeout: 20_000 });
  if ((page.viewportSize()?.width ?? 1200) < 1024) await page.getByRole("tab", { name: "Document" }).click();
  await page.getByTestId("add-page-input").setInputFiles("tests/e2e/fixtures/brauer.pdf");
  await expect(nav.getByText("2 pages")).toBeVisible({ timeout: 30_000 });
});
