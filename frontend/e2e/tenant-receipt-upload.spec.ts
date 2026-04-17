// End-to-end test: the complete tenant "submit receipt" flow.
//
// What this covers:
//   1. Load the tenant dashboard (middleware stamps a dev auth cookie on first hit).
//   2. Dashboard fetches lease + current payment (served by MSW in dev mode).
//   3. Open the "Upload Receipt" modal, upload a PDF, submit.
//   4. Assert the success toast is announced and the payment flips to Pending
//      after the current-payment query invalidation triggers a refetch.
//   5. Validation path: non-JPEG/PNG/PDF files are rejected by the Zod refine
//      before the network call is attempted.
//   6. Escape closes the Manual Request modal without side effects.
//
// MSW's stateful handlers own the data layer here — handlers.ts updates
// `currentPaymentState` on successful submission so the follow-up GET /current
// returns the Pending payment that the UI expects to render.

import { test, expect } from "@playwright/test";
import path from "node:path";

const RECEIPT_FIXTURE = path.join(__dirname, "fixtures", "receipt.pdf");

test.describe("Tenant payment submission", () => {
  test("tenant uploads a receipt and sees the payment flip to Pending", async ({ page }) => {
    await page.goto("/tenant/dashboard");

    // Dashboard renders once MSW finishes starting and the initial queries resolve.
    await expect(page.getByRole("heading", { name: /my dashboard/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /lease summary/i })).toBeVisible();

    const paymentCard = page
      .getByRole("heading", { name: "Current Payment" })
      .locator("xpath=ancestor::*[contains(@class,'rounded-xl')][1]");
    await expect(paymentCard).toContainText("Outstanding");
    await expect(paymentCard).toContainText(/350/);

    // Open the modal.
    await page.getByRole("button", { name: "Upload Receipt" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Upload Receipt" })).toBeVisible();

    // Upload a valid PDF fixture and an optional note.
    await dialog.getByLabel(/receipt \(jpeg, png, or pdf/i).setInputFiles(RECEIPT_FIXTURE);
    await dialog.getByLabel(/notes/i).fill("Paid April rent on time");

    // Capture the actual request so we can assert the multipart payload shape.
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) =>
          req.url().includes("/tenant/payments/receipt") && req.method() === "POST",
      ),
      dialog.getByRole("button", { name: /submit receipt/i }).click(),
    ]);
    const contentType = request.headers()["content-type"] ?? "";
    expect(contentType).toContain("multipart/form-data");

    // Success notification in the aria-live region.
    await expect(
      page.getByRole("region", { name: "Notifications" }).getByText(/receipt submitted/i),
    ).toBeVisible();

    // Payment section flips to Pending once the refetch completes.
    await expect(paymentCard).toContainText("Pending");
    await expect(paymentCard).toContainText(/awaiting landlord confirmation/i);
    await expect(page.getByRole("button", { name: "Upload Receipt" })).toHaveCount(0);
  });

  test("validation blocks submission when the file type is unsupported", async ({ page }) => {
    const postRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/tenant/payments/receipt") && req.method() === "POST") {
        postRequests.push(req.url());
      }
    });

    await page.goto("/tenant/dashboard");
    await page.getByRole("button", { name: "Upload Receipt" }).click();
    const dialog = page.getByRole("dialog");

    // Plain-text file is rejected by Zod's MIME refine.
    await dialog.getByLabel(/receipt \(jpeg, png, or pdf/i).setInputFiles({
      name: "bad.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a receipt"),
    });
    await dialog.getByRole("button", { name: /submit receipt/i }).click();

    await expect(dialog.getByText(/jpeg, png, or pdf/i).first()).toBeVisible();
    // Small wait to ensure we would have seen a POST if one had fired.
    await page.waitForTimeout(500);
    expect(postRequests).toHaveLength(0);
  });

  test("Escape closes the manual request modal without side effects", async ({ page }) => {
    await page.goto("/tenant/dashboard");
    await page.getByRole("button", { name: "Request Manual Confirmation" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Request Manual Confirmation" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const paymentCard = page
      .getByRole("heading", { name: "Current Payment" })
      .locator("xpath=ancestor::*[contains(@class,'rounded-xl')][1]");
    await expect(paymentCard).toContainText("Outstanding");
  });
});
