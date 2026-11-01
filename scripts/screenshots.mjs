// Takes the README screenshots from the local build (npm run build, then npm run serve).
// Usage: node scripts/screenshots.mjs
import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:4173/invoice-extractor/";
const browser = await chromium.launch();

async function shot(file, { device, setup, theme = "dark" } = {}) {
  const ctx = await browser.newContext(device ? { ...devices[device] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript((t) => localStorage.setItem("tally:theme", t), theme);
  await page.goto(BASE);
  await page.getByTestId("total").waitFor();
  if (setup) await setup(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `docs/${file}`, type: file.endsWith(".jpg") ? "jpeg" : "png", quality: file.endsWith(".jpg") ? 88 : undefined });
  await ctx.close();
}

const open = (name) => async (page) => page.getByRole("navigation", { name: "Documents" }).getByText(name, { exact: true }).click();

await shot("cover.jpg");
await shot("statement.png", { setup: open("Northshore Bank") });
await shot("overview.png", { setup: async (page) => page.getByRole("button", { name: "Overview" }).first().click() });
await shot("check-failed.png", { setup: open("Ridgeline Studio LLC"), theme: "light" });
await shot("mobile.png", { device: "iPhone 15" });
await browser.close();
