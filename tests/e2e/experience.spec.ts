import { expect, test, type Page } from "@playwright/test";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1200) < 1024;
const misses = (page: Page) => page.evaluate(() => [...((window as unknown as { __i18nMisses?: Set<string> }).__i18nMisses ?? [])]);

test("the whole interface works in Turkish", async ({ page }) => {
  await page.goto("./?lang=tr");
  await expect(page.getByTestId("total")).toHaveText("$525,87");
  await expect(page.getByTestId("summary")).toContainText("5 kontrol geçti · kayda hazır");
  await expect(page.getByRole("button", { name: "Belge ekle" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Belgeler" });
  for (const name of ["Brauer & Lenz GmbH", "Kuzey Ofis Malzemeleri Ltd. Şti.", "Ridgeline Studio LLC", "THE COPPER KETTLE", "Northshore Bank"]) {
    await nav.getByText(name, { exact: true }).click();
    if (isMobile(page)) {
      await page.getByRole("tab", { name: "Belge" }).click();
      await page.getByRole("tab", { name: "Okunan veriler" }).click();
    }
    await expect(page.getByTestId("checks")).toBeVisible();
  }
  await expect(page.getByTestId("summary")).toContainText("12 işlem mutabık");
  await nav.getByRole("button", { name: "Genel bakış" }).first().click();
  await expect(page.getByRole("heading", { name: "Genel bakış" })).toBeVisible();
  expect(await misses(page)).toEqual([]);

  // The choice sticks after the ?lang link is gone.
  await page.goto("./");
  await expect(page.getByTestId("summary")).toContainText("kontrol geçti");
  await page.getByRole("radio", { name: "en" }).click();
  await expect(page.getByTestId("summary")).toContainText("checks pass");
});

test("the command palette jumps to a document", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByTestId("total")).toBeVisible();
  await page.getByRole("button", { name: "Search and commands" }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("combobox").fill("northshore");
  await palette.getByRole("combobox").press("Enter");
  await expect(palette).toBeHidden();
  await expect(page.getByTestId("summary")).toContainText("12 transactions reconcile");
  await expect(page).toHaveURL(/#northshore$/);
});

test("finds a document by its Turkish type and runs actions from the keyboard", async ({ page, browserName }) => {
  test.skip(isMobile(page), "keyboard shortcut is for desktop");
  await page.goto("./?lang=tr");
  await expect(page.getByTestId("total")).toBeVisible();
  const palette = page.getByRole("dialog", { name: "Komut paleti" });
  const shortcut = browserName === "webkit" ? "Meta+k" : "Control+k";
  // The shortcut listener attaches on hydration; keep pressing until the palette shows.
  const open = () => expect(async () => {
    await page.keyboard.press(shortcut);
    await expect(palette).toBeVisible({ timeout: 500 });
  }).toPass();
  await open();
  await palette.getByRole("combobox").fill("kafe");
  await expect(palette.getByRole("option")).toHaveCount(1);
  await palette.getByRole("combobox").press("Enter");
  await expect(page.getByTestId("total")).toHaveText("£18,50");
  await open();
  await palette.getByRole("combobox").fill("english");
  await palette.getByRole("combobox").press("Enter");
  await expect(page.getByTestId("total")).toHaveText("£18.50");
});

test("a shared link opens the same document", async ({ page }) => {
  await page.goto("./#ridgeline");
  await expect(page.getByTestId("summary")).toContainText("1 check needs attention");
});
