import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFinance } from "../server/dist/index.mjs";
const app = createFinance({
  databasePath: join(
    mkdtempSync(join(tmpdir(), "finance-browser-")),
    "app.sqlite",
  ),
});
await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${app.server.address().port}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
mkdirSync("verification/fullstack", { recursive: true });
try {
  await page.goto(origin);
  await page
    .getByRole("heading", { name: "Sign in to your account" })
    .waitFor();
  await page.screenshot({
    path: "verification/fullstack/sign-in-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Browser Finance");
  await page.getByLabel("Email address").fill("browser@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser test password 123");
  await page.getByLabel("Start with sample records").uncheck();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByText("Browser Finance's finances", { exact: true }).waitFor();
  checks.push("Registration starts a private empty account");
  await page
    .getByRole("button", { name: "Opening balance", exact: true })
    .click();
  await page
    .getByLabel("Starting balance before recorded transactions")
    .fill("1000.00");
  await page
    .getByRole("button", { name: "Save opening balance", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save opening balance", exact: true })
    .waitFor({ state: "hidden" });
  checks.push("Opening balance saves");
  await page
    .getByRole("link", { name: "Transactions", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "+ Add Transaction", exact: true })
    .click();
  await page.getByLabel("Recipient / Sender").fill("Browser groceries");
  await page.getByLabel("Amount · USD").fill("25.35");
  await page
    .getByRole("dialog")
    .getByLabel("Category", { exact: true })
    .selectOption("Groceries");
  await page
    .getByRole("button", { name: "Save Transaction", exact: true })
    .click();
  await page.getByText("Browser groceries", { exact: true }).waitFor();
  checks.push("Manual transaction saves");
  await page
    .getByRole("button", {
      name: "Edit transaction Browser groceries",
      exact: true,
    })
    .click();
  await page.getByLabel("Amount · USD").fill("30.45");
  await page
    .getByRole("button", { name: "Save Transaction", exact: true })
    .click();
  await page.getByText("-$30.45", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("Browser groceries", { exact: true }).waitFor();
  checks.push("Transaction edit survives reload");
  await page.getByRole("link", { name: "Pots", exact: true }).first().click();
  await page
    .getByRole("button", { name: "+ Add New Pot", exact: true })
    .click();
  await page.getByLabel("Pot Name").fill("Laptop");
  await page.getByLabel("Target", { exact: true }).fill("2000");
  await page.getByRole("button", { name: "Add Pot", exact: true }).click();
  await page.getByRole("heading", { name: "Laptop", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Add money to Laptop", exact: true })
    .click();
  await page.getByLabel("Amount to Add").fill("100.25");
  await page
    .getByRole("button", { name: "Confirm Addition", exact: true })
    .click();
  await page.getByText("$100.25", { exact: true }).first().waitFor();
  checks.push("Savings pot creation and transfer");
  await page
    .getByRole("link", { name: "Overview", exact: true })
    .first()
    .click();
  await page.getByText("$869.30", { exact: true }).waitFor();
  await page.screenshot({
    path: "verification/fullstack/overview-desktop.png",
    fullPage: true,
  });
  checks.push("Balances reflect expense plus savings transfer");
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    axe.violations.map((v) => v.id),
    [],
  );
  checks.push("Desktop overview accessibility scan");
  for (const route of [
    "/",
    "/transactions",
    "/budgets",
    "/pots",
    "/recurring-bills",
  ]) {
    await page.goto(origin + route);
    await page
      .getByText("Browser Finance's finances", { exact: true })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      `overflow on ${route}`,
    );
  }
  checks.push("Five routes fit mobile width");
  await page.goto(origin + "/");
  await page.getByText("Browser Finance's finances", { exact: true }).waitFor();
  await page.screenshot({
    path: "verification/fullstack/overview-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email address").fill("browser@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser test password 123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByText("$869.30", { exact: true }).waitFor();
  checks.push("Sign out and sign in restore records");
  assert.deepEqual(errors, []);
  writeFileSync(
    "verification/fullstack/results.json",
    JSON.stringify({ checks, errors, violations: axe.violations }, null, 2),
  );
  console.log(JSON.stringify({ passed: checks.length, checks }));
} catch (e) {
  await page.screenshot({
    path: "verification/fullstack/failure.png",
    fullPage: true,
  });
  console.error(await page.locator("body").innerText());
  throw e;
} finally {
  await browser.close();
  await app.close();
}
