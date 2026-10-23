// End-to-end walk through the component map using the locally installed Chrome.
// Usage: BASE_URL=http://localhost:3100 APP_PASSCODE=... node tests/e2e.mjs [--shots dir] [--no-po]
// Without --no-po this creates real DRAFT purchase orders in Zoho Inventory.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const args = process.argv.slice(2);
const shots = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
const createPo = !args.includes("--no-po");
if (shots) mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
};

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Passcode gate
  await page.goto(`${BASE}/review`);
  if (!page.url().includes("/login")) fail("unauthenticated request was not redirected to /login");
  await page.fill("#passcode", "wrong");
  await page.click("button:has-text('Sign in')");
  await page.waitForSelector("text=Wrong passcode.");
  step("wrong passcode rejected");
  await page.fill("#passcode", process.env.APP_PASSCODE);
  await page.click("button:has-text('Sign in')");
  await page.waitForURL(/\/review/);
  step("signed in and returned to /review");

  // 1. Raghav clicks "Run Demand Planning"
  await page.goto(`${BASE}/`);
  await page.locator("form button:has-text('Run')").first().click();
  await page.waitForURL(/\/review\?run=/, { timeout: 60_000 });
  const runId = new URL(page.url()).searchParams.get("run");
  step(`planning run created (${runId.slice(0, 8)})`);

  // 2. Results screen: dashboard with tiles, charts, AI briefing
  await page.goto(`${BASE}/`);
  await page.waitForSelector("text=Weeks of stock cover by SKU");
  const tiles = await page.locator(".card p.text-2xl").allInnerTexts();
  step(`overview tiles: ${tiles.join(" | ")}`);
  const briefing = await page.locator("text=AI briefing for Raghav").locator("..").innerText();
  if (/AI notes unavailable/.test(briefing)) fail("AI briefing missing: " + briefing.slice(0, 200));
  else step("AI briefing present");
  if (shots) await page.screenshot({ path: `${shots}/overview-desktop.png`, fullPage: true });

  // 3. Raghav reviews, edits and approves
  await page.goto(`${BASE}/review?run=${runId}`);
  await page.waitForSelector("text=Needs review");
  const rowFor = (sku) => page.locator("li", { has: page.locator(`text=${sku}`) }).filter({ has: page.locator("button") }).first();

  const sku1 = rowFor("SKU001");
  await sku1.locator("input[type=number]").fill("700");
  await sku1.locator("button:has-text('Approve')").click();
  await page.waitForTimeout(1500);
  for (const sku of ["SKU004", "SKU011"]) {
    await rowFor(sku).locator("button:has-text('Approve')").click();
    await page.waitForTimeout(1500);
  }
  await rowFor("SKU006").locator("button:has-text('Confirm pause')").click();
  await page.waitForTimeout(1500);
  await rowFor("SKU013").locator("button:has-text('Reject')").click();
  await page.waitForTimeout(1500);
  await page.reload();
  await page.click("button[role=tab]:has-text('Approved')");
  const approvedText = await page.locator("main").innerText();
  if (!approvedText.includes("Approved 700")) fail("edited quantity 700 for SKU001 not saved");
  else step("SKU001 qty edited 750 → 700 and approved; SKU004, SKU011 approved; SKU006 pause confirmed; SKU013 rejected");

  // Validation: an out-of-range quantity is refused
  await page.click("button[role=tab]:has-text('Needs review')");
  const sku3 = rowFor("SKU003");
  await sku3.locator("input[type=number]").fill("99999");
  await sku3.locator("button:has-text('Approve')").click();
  await page.waitForSelector("text=Quantity must be between");
  step("out-of-range quantity rejected by server validation");
  await sku3.locator("input[type=number]").fill("300");
  if (shots) await page.screenshot({ path: `${shots}/review-desktop.png`, fullPage: true });

  // 4. Validate + create Zoho draft POs
  if (createPo) {
    await page.click("button:has-text('Create draft POs in Zoho')");
    await page.waitForSelector("text=Zoho Inventory response", { timeout: 60_000 });
    const resp = await page.locator("text=Zoho Inventory response").locator("..").innerText();
    console.log(resp.split("\n").map((l) => "    " + l).join("\n"));
    if (/failed|error/i.test(resp)) fail("a Zoho PO failed");
    else step("draft POs created in Zoho");

    // 5. Confirmation: PO number, status, link to Zoho
    await page.goto(`${BASE}/orders`);
    const link = page.locator("a:has-text('Open in Zoho')").first();
    await link.waitFor();
    step(`orders page shows Zoho link: ${(await link.getAttribute("href")).replace(/\d{6,}/g, "…")}`);
    if (shots) await page.screenshot({ path: `${shots}/orders-desktop.png`, fullPage: true });
  }

  for (const path of ["/data", "/about"]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForSelector("main h1");
    await page.waitForSelector("[aria-busy=true]", { state: "detached" });
    if (shots) await page.screenshot({ path: `${shots}${path}-desktop.png`, fullPage: true });
  }
  step("data and about pages render");

  // Mobile
  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mobile.context().addCookies(await page.context().cookies());
  for (const path of ["/", "/review", "/orders", "/about"]) {
    await mobile.goto(`${BASE}${path}`);
    await mobile.waitForSelector("main h1");
    await mobile.waitForSelector("[aria-busy=true]", { state: "detached" });
    await mobile.waitForTimeout(500);
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) fail(`horizontal overflow of ${overflow}px on ${path} at 375px`);
    if (shots) await mobile.screenshot({ path: `${shots}/mobile${path === "/" ? "-overview" : path.replace("/", "-")}.png`, fullPage: true });
  }
  step("mobile 375px pages render without horizontal scroll");

  if (errors.length) fail(`browser errors: ${errors.join("; ")}`);
} catch (err) {
  fail(err.stack ?? String(err));
} finally {
  await browser.close();
}
console.log(process.exitCode ? "E2E FAILED" : "E2E PASSED");
