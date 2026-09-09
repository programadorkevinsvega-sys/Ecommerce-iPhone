import { expect, test } from "@playwright/test";

test("catalog renders real product data", async ({ page }) => {
  await page.goto("/catalog");
  await expect(page.getByRole("heading", { name: "Encuentra tu próximo smartphone." })).toBeVisible();
  await expect(page.getByText("iPhone 17 Pro Max")).toBeVisible();
  await expect(page.getByText("$6.499.900")).toBeVisible();
});

test("iPhone category exposes canonical product URL", async ({ page }) => {
  await page.goto("/iphone");
  await expect(page.getByRole("heading", { name: "iPhone para cada necesidad." })).toBeVisible();
  await page.getByRole("link", { name: /iPhone 17 Pro Max/ }).click();
  await expect(page).toHaveURL(/\/iphone\/iphone-17-pro-max$/);
  await expect(page.getByRole("heading", { name: "iPhone 17 Pro Max" })).toBeVisible();
});
