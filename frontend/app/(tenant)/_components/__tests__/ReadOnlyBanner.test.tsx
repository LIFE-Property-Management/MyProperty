import { render, screen } from "@testing-library/react";
import { ReadOnlyBanner } from "../ReadOnlyBanner";
import useTenantStore from "@/lib/store/useTenantStore";
import { resetTenantStore } from "@/test-utils/resetTenantStore";

beforeEach(() => resetTenantStore());

describe("<ReadOnlyBanner />", () => {
  it("renders nothing when the tenant is Active (not read-only)", () => {
    useTenantStore.getState().setAuth({
      userId: "u1",
      email: "a@a.com",
      tenantAccountStatus: "Active",
    });
    const { container } = render(<ReadOnlyBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders role='alert' when the tenant is ReadOnly", () => {
    useTenantStore.getState().setAuth({
      userId: "u1",
      email: "a@a.com",
      tenantAccountStatus: "ReadOnly",
    });
    render(<ReadOnlyBanner />);
    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent(/read-only/i);
  });
});
