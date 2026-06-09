// End-to-end smoke test: the admin/stakeholder dashboard.
//
// What this covers:
//   1. Load /admin/dashboard. The (admin) KeycloakInit dev-bypass signs the
//      session in as the admin fixture (portal: "admin"), so the route gate
//      passes; MSW serves GET /admin/dashboard from stakeholderDashboardFixture.
//   2. Assert the four section headings render.
//   3. Assert KPI values, the per-currency financial breakdown (never summed),
//      and that recharts trend containers mount.
//   4. Assert the dashboard issued the real GET /admin/dashboard request.

import { test, expect } from "@playwright/test";

test.describe("Admin stakeholder dashboard", () => {
  test("renders KPIs, per-currency financials, and trend charts", async ({ page }) => {
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes("/admin/dashboard") && req.method() === "GET",
      ),
      page.goto("/admin/dashboard"),
    ]);
    expect(request.method()).toBe("GET");

    // Page + section headings.
    await expect(page.getByRole("heading", { name: "Stakeholder dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Growth & users" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Adoption & occupancy" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Invites", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Financial & operations" })).toBeVisible();

    // KPI values from the fixture.
    await expect(page.getByText("142", { exact: true })).toBeVisible(); // total users
    await expect(page.getByText("79.7%", { exact: true })).toBeVisible(); // occupancy
    await expect(page.getByText("18.5 h", { exact: true })).toBeVisible(); // avg time to confirm

    // Per-currency financial breakdown — never summed across currencies.
    await expect(page.getByText("EUR 58,200", { exact: true })).toBeVisible();
    await expect(page.getByText("USD 21,300", { exact: true })).toBeVisible();

    // Trend charts mount (user growth + lease growth + invites + revenue×2 = 5).
    await expect(page.getByTestId("trend-chart")).toHaveCount(5);

    // System-health line.
    await expect(page.getByText(/failed email this month/i)).toBeVisible();
  });

  test("sign-out control is present in the admin shell", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  });
});
