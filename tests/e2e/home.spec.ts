import { expect, test } from "@playwright/test";

test.describe("Umbra landing page", () => {
  test("shows the wordmark, tagline, and four capability sections", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "UMBRA" })).toBeVisible();
    await expect(page.getByText("Private Finance for Stellar")).toBeVisible();

    for (const title of ["Shield", "Transfer", "Invoice", "Donation"]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }

    await expect(page.getByText("Consumer privacy layer for Stellar commerce")).toBeVisible();
  });
});
