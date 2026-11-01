import { expect, test, type Page } from "@playwright/test";

// Files people actually drop on the page: none of them may break it, and each
// gets a message that says what to do.

const upload = (page: Page, files: Parameters<Page["setInputFiles"]>[1]) => page.getByTestId("file-input").setInputFiles(files);
const alert = (page: Page, text: RegExp) => expect(page.getByRole("status").filter({ hasText: text }).first()).toBeVisible({ timeout: 20_000 });

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.getByTestId("total")).toBeVisible();
});

test("an empty file", async ({ page }) => {
  await upload(page, "tests/e2e/fixtures/empty.pdf");
  await alert(page, /This file is empty/);
});

test("a damaged PDF", async ({ page }) => {
  await upload(page, "tests/e2e/fixtures/truncated.pdf");
  await alert(page, /not a valid PDF, or it is damaged/);
});

test("a password-protected PDF", async ({ page }) => {
  await upload(page, "tests/e2e/fixtures/locked.pdf");
  await alert(page, /password-protected/);
});

test("a damaged Word document", async ({ page }) => {
  await upload(page, { name: "contract.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("PK fake") });
  await alert(page, /could not be opened/);
});

test("a file type it does not read", async ({ page }) => {
  await upload(page, { name: "drawing.dwg", mimeType: "application/octet-stream", buffer: Buffer.from("AC1032") });
  await alert(page, /isn't supported/);
});

test("an iPhone HEIC photo", async ({ page }) => {
  await upload(page, { name: "IMG_0042.HEIC", mimeType: "image/heic", buffer: Buffer.from("not decodable") });
  await alert(page, /HEIC or TIFF/);
});

test("a tiny image", async ({ page }) => {
  // 1×1 PNG
  await upload(page, { name: "dot.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") });
  await alert(page, /too small to read/);
});

test("a 60-page PDF reads the first 20 pages and says so", async ({ page }) => {
  test.setTimeout(60_000);
  await upload(page, "tests/e2e/fixtures/long-60-pages.pdf");
  await expect(page.getByRole("navigation", { name: "Documents" }).getByText("Read the first 20 of 60 pages")).toBeVisible({ timeout: 40_000 });
});

test("several files at once, good and bad", async ({ page }) => {
  await upload(page, ["tests/e2e/fixtures/brauer.pdf", "tests/e2e/fixtures/truncated.pdf", "tests/e2e/fixtures/statement-tr.pdf"]);
  const nav = page.getByRole("navigation", { name: "Documents" });
  await expect(nav.getByText("Örnek Katılım Bankası")).toBeVisible({ timeout: 20_000 });
  await expect(nav.getByText("not a valid PDF, or it is damaged")).toBeVisible();
  // The good ones still open and read correctly.
  await nav.getByText("Brauer & Lenz GmbH").first().click();
  if ((page.viewportSize()?.width ?? 1200) < 1024) await page.getByRole("tab", { name: "Extracted data" }).click();
  await expect(page.getByTestId("total")).toHaveText("€345.25");
});

test("a 50-megapixel phone photo is scaled down and read", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "One engine is enough for the slow OCR run");
  test.setTimeout(150_000);
  await upload(page, "tests/e2e/fixtures/huge-photo.jpg");
  if ((page.viewportSize()?.width ?? 1200) < 1024) await page.getByRole("tab", { name: "Extracted data" }).click();
  await expect(page.getByTestId("total")).toHaveText("$525.87", { timeout: 140_000 });
});
