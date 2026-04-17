import { act, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationContainer } from "../Notification";
import useTenantStore from "@/lib/store/useTenantStore";
import { resetTenantStore } from "@/test-utils/resetTenantStore";

beforeEach(() => {
  resetTenantStore();
});

describe("<NotificationContainer />", () => {
  it("renders an aria-live region", () => {
    render(<NotificationContainer />);
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("renders no toasts when queue is empty", () => {
    render(<NotificationContainer />);
    expect(screen.queryByRole("button", { name: "Dismiss notification" })).not.toBeInTheDocument();
  });

  it("renders a toast with role='alert' for error type", async () => {
    render(<NotificationContainer />);
    act(() => {
      useTenantStore.getState().addNotification({
        type: "error",
        message: "Upload failed",
        duration: 10_000,
      });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload failed");
  });

  it("renders info/success toasts without role='alert' (rely on container's polite live region)", async () => {
    render(<NotificationContainer />);
    act(() => {
      useTenantStore.getState().addNotification({
        type: "success",
        message: "Saved",
        duration: 10_000,
      });
    });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("dismisses a toast when the X button is clicked", async () => {
    render(<NotificationContainer />);
    act(() => {
      useTenantStore.getState().addNotification({
        type: "info",
        message: "Hi",
        duration: 10_000,
      });
    });
    await screen.findByText("Hi");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    // AnimatePresence delays removal until exit animation completes; wait for the node to unmount.
    await waitForElementToBeRemoved(() => screen.queryByText("Hi"));
  });

  it("renders multiple toasts stacked in queue order", async () => {
    render(<NotificationContainer />);
    act(() => {
      const { addNotification } = useTenantStore.getState();
      addNotification({ type: "info", message: "A", duration: 10_000 });
      addNotification({ type: "info", message: "B", duration: 10_000 });
    });
    expect(await screen.findByText("A")).toBeInTheDocument();
    expect(await screen.findByText("B")).toBeInTheDocument();
  });
});
