import { expect, test, type Page } from "@playwright/test";

// The files people really send: written by real software with its quirks, misnamed,
// attached to e-mails, or broken. Each one is either read correctly or gets a message
// that says what to do; the page never breaks.

const upload = (page: Page, file: string) => page.getByTestId("file-input").setInputFiles(file);
const nav = (page: Page) => page.getByRole("navigation", { name: "Documents" });
const openData = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 1200) < 1024) await page.getByRole("tab", { name: "Extracted data" }).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByTestId("total")).toBeVisible();
});

for (const [file, total, note] of [
  ["hard-word-tabs.docx", "1,764.60", "Word document"],
  ["hard-eml-docx.eml", "1,764.60", "attached to the e-mail (Rechnung März.docx)"],
  ["hard-textutil.docx", "296.20", "Word document"],
  ["hard-excel-real-tr.xlsx", "6,485.09", "Excel workbook"],
  ["hard-csv-excel-tr.csv", "2,980.50", "CSV file"],
  ["hard-efatura.xml", "3,757.80", "e-Fatura (UBL-TR)"],
  ["hard-facturx.xml", "3,338.65", "E-invoice XML"],
  ["hard-eml-pdf.eml", "50,222.12", "attached to the e-mail"],
  ["hard-pdf-named.docx", "217.79", ""],
  ["hard-rtf-1254.rtf", "2,077.20", "RTF document"],
] as const) {
  test(`reads ${file}`, async ({ page }) => {
    await upload(page, `corpus/office/${file}`);
    if (note) await expect(nav(page).getByText(note).first()).toBeVisible({ timeout: 30_000 });
    await openData(page);
    await expect(page.getByTestId("total")).toContainText(total, { timeout: 30_000 });
    await expect(page.getByTestId("summary")).toContainText("checks pass");
  });
}

test("a Word file holding only a photo of the invoice is read with OCR", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "One engine is enough for the slow OCR run");
  test.setTimeout(150_000);
  await upload(page, "corpus/office/hard-word-picture.docx");
  await expect(nav(page).getByText("Picture inside the Word document")).toBeVisible({ timeout: 140_000 });
});

for (const [file, message] of [
  ["half-downloaded.docx", /could not be opened/],
  ["no-body.docx", /could not be opened/],
  ["cut-xml.docx", /could not be opened/],
  ["empty-workbook.xlsx", /could not be opened/],
  ["password.docx", /password-protected/],
  ["old-word.doc", /older Office file/],
  ["textutil-old.doc", /older Office file/],
  ["outlook.msg", /Save the e-mail as \.eml/],
  ["not-an-invoice.xml", /not an e-invoice/],
  ["random.bin", /isn't supported/],
] as const) {
  test(`explains ${file}`, async ({ page }) => {
    await upload(page, `tests/e2e/fixtures/hard/${file}`);
    await expect(page.getByRole("status").filter({ hasText: message }).first()).toBeVisible({ timeout: 20_000 });
  });
}

test("a ZIP archive is opened and its invoice read", async ({ page }) => {
  await upload(page, "tests/e2e/fixtures/hard/invoices.zip");
  await expect(nav(page).getByText("a.pdf from the ZIP archive")).toBeVisible({ timeout: 20_000 });
  await openData(page);
  await expect(page.getByTestId("summary")).toContainText("checks pass");
});

test("an e-mail whose attachment is broken falls back to the message", async ({ page }) => {
  await upload(page, "tests/e2e/fixtures/hard/bad-attachment.eml");
  await expect(nav(page).getByText("E-mail").first()).toBeVisible({ timeout: 20_000 });
  await openData(page);
  await expect(page.getByTestId("summary")).toContainText("checks pass");
});

test("a photo cut off halfway still opens", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "One engine is enough for the slow OCR run");
  test.setTimeout(120_000);
  await upload(page, "tests/e2e/fixtures/hard/broken-photo.jpg");
  // Either the readable part is shown or a clear message: never a spinner that never ends.
  await expect(page.getByText("broken-photo.jpg").or(page.getByRole("status").filter({ hasText: /could not be opened|too small/ })).first()).toBeVisible({ timeout: 100_000 });
});
