import { test, expect } from "@playwright/test";

/**
 * End-to-end test for the PKCE authorization code flow.
 *
 * Required environment variables (set via GitHub Secrets in CI,
 * or in .env.local locally):
 *
 *   TENANT_URL       – IBM Verify tenant base URL
 *   CLIENT_ID        – OAuth client ID registered on the tenant
 *   CLIENT_SECRET    – OAuth client secret
 *   REDIRECT_URI     – Must match the registered redirect URI
 *   RESPONSE_TYPE    – Should be "code"
 *   TEST_USERNAME    – Dedicated test-user username
 *   TEST_PASSWORD    – Dedicated test-user password
 */

const TEST_USERNAME = process.env.TEST_USERNAME ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

test.beforeAll(() => {
  if (!TEST_USERNAME || !TEST_PASSWORD) {
    throw new Error(
      "TEST_USERNAME and TEST_PASSWORD must be set to run E2E tests."
    );
  }
});

test("PKCE flow — login, verify user claims, logout", async ({ page }) => {
  // ── 1. Home page ──────────────────────────────────────────────────────────
  await page.goto("/");
  // Wait for the Login link to appear (authURL is fetched asynchronously)
  const loginLink = page.getByRole("link", { name: /login/i });
  await expect(loginLink).toBeVisible({ timeout: 15_000 });

  // ── 2. Navigate to IBM Verify login page ──────────────────────────────────
  await loginLink.click();
  // Wait for the ISV login page — look for the username input to appear
  // (URL pattern is tenant-specific so we wait on the DOM element instead)
  const usernameField = page.locator('input[placeholder="User name"], input[name="username"], input[type="text"]').first();
  await expect(usernameField).toBeVisible({ timeout: 15_000 });

  // ── 3. Enter credentials ───────────────────────────────────────────────────
  await usernameField.fill(TEST_USERNAME);

  const passwordField = page.locator('input[placeholder="Password"], input[name="password"], input[type="password"]').first();
  await expect(passwordField).toBeVisible({ timeout: 5_000 });
  await passwordField.fill(TEST_PASSWORD);

  // ── 4. Submit login ────────────────────────────────────────────────────────
  const signInButton = page.getByRole("button", { name: /sign in/i });
  await signInButton.click();

  // ── 5. Wait for redirect back to app dashboard ────────────────────────────
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  // ── 6. Assert page heading and success message ────────────────────────────
  await expect(page.getByText(/successfully authenticated/i)).toBeVisible({ timeout: 10_000 });
  // Welcome message includes the user's display name
  await expect(page.getByRole("heading", { name: new RegExp(`Welcome ${TEST_USERNAME}`, "i") })).toBeVisible();

  // ── 7. Assert all expected user claims are present ────────────────────────
  const table = page.locator("table");
  await expect(table).toBeVisible();

  // Claims that must always be present in an ISV userInfo response
  const expectedClaims = [
    "acr",
    "amr",
    "auth_time",
    "displayName",
    "name",
    "preferred_username",
    "realmName",
    "sub",
    "uniqueSecurityName",
    "userType",
  ];

  for (const claim of expectedClaims) {
    await expect(
      table.locator(`tbody tr:has(td:first-child:text-is("${claim}"))`),
      `Expected claim "${claim}" to be present in the user claims table`
    ).toBeVisible();
  }

  // ── 8. Assert stable claim values ─────────────────────────────────────────
  // These values are tied to the test user and tenant — they should not change between runs

  // preferred_username matches the TEST_USERNAME used to log in
  await expect(claimRow(page, "preferred_username")).toContainText(TEST_USERNAME);

  // realmName is always cloudIdentityRealm for IBM Verify Cloud Directory
  await expect(claimRow(page, "realmName")).toContainText("cloudIdentityRealm");

  // acr is always the IBM Verify policy ID
  await expect(claimRow(page, "acr")).toContainText("urn:ibm:security:policy:id:1");

  // userType is regular for a standard user account
  await expect(claimRow(page, "userType")).toContainText("regular");

  // sub and uniqueSecurityName should be non-empty and match each other
  const subValue = await claimRow(page, "sub").textContent();
  const uniqueSecurityNameValue = await claimRow(page, "uniqueSecurityName").textContent();
  expect(subValue?.trim()).toBeTruthy();
  expect(subValue?.trim()).toBe(uniqueSecurityNameValue?.trim());

  // ── 9. Logout ──────────────────────────────────────────────────────────────
  const logoutLink = page.getByRole("link", { name: /logout/i });
  await logoutLink.click();

  // After logout the app redirects to /
  await page.waitForURL(/\/$/, { timeout: 10_000 });
  await expect(loginLink).toBeVisible({ timeout: 10_000 });
});

// Helper — finds a row where the first cell exactly matches claimName
// Uses CSS :has to scope to the exact claim key cell, avoiding partial matches
// e.g. "name" would otherwise match "displayName", "realmName" etc.
function claimRow(page: import("@playwright/test").Page, claimName: string) {
  return page
    .locator(`table tbody tr:has(td:first-child:text-is("${claimName}"))`)
    .locator("td")
    .nth(1);
}
