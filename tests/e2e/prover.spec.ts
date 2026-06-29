import { test, expect } from "@playwright/test";

/**
 * Real in-browser Groth16 proving, off the main thread.
 *
 * Drives the /shield flow (the proving path that runs locally without a deployed
 * contract): clicking "Shield funds" builds a witness and asks the proving Web
 * Worker for a real proof. We assert the staged progress surfaces, the worker
 * actually produces a proof (the success screen only renders when proving
 * resolves), the cold-start latency is logged, and the main thread stays
 * responsive (it scrolls) while the worker proves.
 */
test("shield generates a real proof in a worker without blocking the main thread", async ({ page }) => {
  const proverLogs: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => {
    const t = m.text();
    if (t.includes("[umbra:prover]")) proverLogs.push(t);
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/shield", { waitUntil: "domcontentloaded" });
  // The heading is server-rendered; wait it out so a slow first dev compile of
  // the route doesn't race the button assertion.
  await expect(page.getByRole("heading", { name: "Add funds privately" })).toBeVisible({ timeout: 60_000 });

  const shieldBtn = page.getByRole("button", { name: "Shield funds" });
  await expect(shieldBtn).toBeVisible({ timeout: 30_000 });
  await shieldBtn.click();

  // Staged crypto readout appears (worker → progress events).
  await expect(page.getByText("Loading proving key")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Generating zero-knowledge proof")).toBeVisible({ timeout: 30_000 });

  // Main thread is responsive WHILE the worker proves: a requestAnimationFrame
  // loop keeps ticking. If proving ran on the main thread this would stall near 0.
  const ticks = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let n = 0;
        const start = performance.now();
        const loop = () => {
          n++;
          if (performance.now() - start < 500) requestAnimationFrame(loop);
          else resolve(n);
        };
        requestAnimationFrame(loop);
      }),
  );
  expect(ticks).toBeGreaterThan(10); // ~30 at 60fps; >10 ⇒ main thread not frozen

  // The worker resolved with a real proof → the success screen renders.
  await expect(page.getByText("Funds shielded")).toBeVisible({ timeout: 60_000 });

  // Cold-start latency was logged for measurement on the demo machine.
  expect(proverLogs.some((l) => /shield (cold-start|warm): keyLoad=\d+ms prove=\d+ms total=\d+ms/.test(l))).toBe(true);
  expect(pageErrors, `unexpected page errors: ${pageErrors.join(" | ")}`).toEqual([]);
});
