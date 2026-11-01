import { expect, test, type Page } from "@playwright/test";

const openDoc = async (page: Page, name: string) => {
  const isMobile = (page.viewportSize()?.width ?? 1200) < 1024;
  await page.getByRole("navigation", { name: "Documents" }).getByText(name, { exact: true }).click();
  if (isMobile) await page.getByRole("tab", { name: "Extracted data" }).click();
};

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByTestId("total")).toBeVisible();
});

test("opens on a read invoice with every check passing", async ({ page }) => {
  await expect(page.getByTestId("total")).toHaveText("$525.87");
  await expect(page.getByTestId("summary")).toContainText("5 checks pass");
  await expect(page.getByTestId("pay-status")).toContainText("Paid on Oct 27, 2026");
  await expect(page.getByLabel("Invoice number")).toHaveValue("INV-2026-0418");
});

test("flags an invoice whose lines do not add up", async ({ page }) => {
  await openDoc(page, "Ridgeline Studio LLC");
  await expect(page.getByTestId("summary")).toContainText("1 check needs attention");
  await expect(page.getByTestId("checks")).toContainText("off by 100.00");
});

test("editing a line recalculates the checks", async ({ page }) => {
  await openDoc(page, "Ridgeline Studio LLC");
  // The printed subtotal and total are 100.00 too high; correcting both clears the warning.
  for (const label of ["Subtotal", "Total"]) {
    await page.getByLabel(label, { exact: true }).fill("2,810.00");
    await page.getByLabel(label, { exact: true }).press("Enter");
  }
  await expect(page.getByTestId("summary")).toContainText("checks pass");
  await expect(page.getByTestId("total")).toHaveText("$2,810.00");
});

test("reads a bank statement and reconciles it", async ({ page }) => {
  await openDoc(page, "Northshore Bank");
  await expect(page.getByTestId("summary")).toContainText("12 transactions reconcile");
  await expect(page.getByTestId("transactions").getByRole("listitem")).toHaveCount(12);
  await page.getByLabel("Search transactions").fill("wire");
  await expect(page.getByTestId("transactions").getByRole("listitem")).toHaveCount(2);
});

test("uploads a text PDF and reads it without OCR", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles("tests/e2e/fixtures/brauer.pdf");
  if ((page.viewportSize()?.width ?? 1200) < 1024) await page.getByRole("tab", { name: "Extracted data" }).click();
  await expect(page.getByTestId("total")).toHaveText("€345.25");
  await expect(page.getByTestId("duplicate")).toContainText("Possible duplicate of brauer.png");
});

test("recognises an uploaded bank statement instead of reading it as an invoice", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles("tests/e2e/fixtures/statement-tr.pdf");
  if ((page.viewportSize()?.width ?? 1200) < 1024) await page.getByRole("tab", { name: "Extracted data" }).click();
  await expect(page.getByTestId("summary")).toContainText("9 transactions reconcile");
  await expect(page.getByRole("radio", { name: "Bank statement" })).toHaveAttribute("aria-checked", "true");
});

test("says so when a document is not supported", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf") });
  await expect(page.getByText("notes.pdf").first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "notes.pdf" }).first()).toBeVisible();
});

test("keeps uploads after a reload", async ({ page }) => {
  await page.getByTestId("file-input").setInputFiles("tests/e2e/fixtures/statement-tr.pdf");
  await expect(page.getByRole("navigation", { name: "Documents" }).getByText("Örnek Katılım Bankası")).toBeVisible();
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Documents" }).getByText("Örnek Katılım Bankası")).toBeVisible();
});

test("overview matches payments and exports a workbook", async ({ page }) => {
  await page.getByRole("button", { name: "Overview" }).first().click();
  const overview = page.getByTestId("overview");
  await expect(overview).toContainText("Matched to a payment");
  await expect(overview.getByText("Paid Oct 20, 2026")).toBeVisible();
  const download = page.waitForEvent("download");
  await overview.getByRole("button", { name: "Export workbook" }).click();
  expect((await download).suggestedFilename()).toBe("tally-export.xlsx");
});

test("has no horizontal overflow", async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
