import { test, expect } from "@playwright/test";

// This suite reads the deployed StudioNet contract through the Vite /api proxy.
// It is opt-in because the public RPC is rate limited and the data is live.
//   npm run test:e2e:real
test.skip(process.env.E2E_REAL !== "1", "set E2E_REAL=1 to run against the deployed contract");

const READY = { timeout: 30000 };
const RATE_LIMITED = /rate-limited/i;

async function loadLive(page, path, ready) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(path);
    try {
      await ready();
      return;
    } catch (error) {
      const limited = await page.getByText(RATE_LIMITED).count();
      if (!limited) throw error;
      if (attempt === 1) throw error;
      // StudioNet allows 30 requests per minute. The UI explains the limit and offers
      // a retry; the test waits out the window instead of pretending it did not happen.
      await page.waitForTimeout(65000);
    }
  }
}

test.describe("deployed contract reads", () => {
  test("overview renders live totals without errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await loadLive(page, "/", async () => {
      await expect(page.getByRole("heading", { name: /Did the process hold/ })).toBeVisible(READY);
    });
    const metrics = await page.locator(".metric").allTextContents();
    expect(metrics.length).toBeGreaterThanOrEqual(3);
    await expect(page.getByText("Mock mode.")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  // The Proposals screen previously failed here on every deployment:
  // "Could not load proposals" because list_proposals raised KeyError on chain.
  test("proposals screen lists the seeded proposals", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await loadLive(page, "/proposals", async () => {
      await expect(page.getByRole("heading", { name: "Proposals" })).toBeVisible(READY);
      await expect(page.getByText("P-REVIEW", { exact: true })).toBeVisible(READY);
    });
    await expect(page.getByText("Could not load proposals")).toHaveCount(0);
    await expect(page.getByText("P-DISCUSSION", { exact: true })).toBeVisible();
    await expect(page.getByText("P-TREASURY", { exact: true })).toBeVisible();
    await expect(page.getByText("P-CONTENT", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("P-REVIEW shows its sourced process events", async ({ page }) => {
    await loadLive(page, "/proposals/P-REVIEW", async () => {
      await expect(page.getByRole("heading", { name: "P-REVIEW" })).toBeVisible(READY);
      await expect(page.getByRole("heading", { name: "Process rail" })).toBeVisible(READY);
      await expect(page.getByText("SUBMITTED").first()).toBeVisible(READY);
      await expect(page.getByText("VOTING_STARTED").first()).toBeVisible(READY);
    });
  });

  test("D-REVIEW is decided by code, not consensus", async ({ page }) => {
    await loadLive(page, "/disputes/D-REVIEW", async () => {
      await expect(page.getByRole("heading", { name: "Dispute D-REVIEW" })).toBeVisible(READY);
      await expect(page.getByText("Rule check").first()).toBeVisible(READY);
      await expect(page.getByText("Violation").first()).toBeVisible(READY);
      await expect(page.getByText("Assessment history")).toBeVisible(READY);
    });
    // The page mentions "validator consensus" in its explanation of the pipeline, so
    // scope the check to the verdict badge: DecidedByBadge uses .pending for an
    // INTERPRETATION (consensus) result and .system for a code-decided one.
    await expect(page.locator(".badge.pending")).toHaveCount(0);
  });
});
