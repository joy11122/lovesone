import { expect, test } from "@playwright/test";

test("homepage exposes the primary shopping journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "LOVESONE" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Everything your best friend deserves/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore pet categories/i })).toHaveAttribute("href", "/shop");
});

test("login and registration pages render usable forms", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to LOVESONE" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/register/);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeVisible();
});
