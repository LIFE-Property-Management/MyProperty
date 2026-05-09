import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  NotificationContainer,
  type NotificationItem,
} from "../Notification";

describe("<NotificationContainer />", () => {
  it("renders an aria-live region", () => {
    render(<NotificationContainer notifications={[]} onDismiss={() => {}} />);
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("renders an empty container when notifications is empty", () => {
    render(<NotificationContainer notifications={[]} onDismiss={() => {}} />);
    expect(
      screen.queryByRole("button", { name: "Dismiss notification" }),
    ).not.toBeInTheDocument();
  });

  it("renders one toast per notification item with its message", () => {
    const items: NotificationItem[] = [
      { id: "a", type: "info", message: "First" },
      { id: "b", type: "info", message: "Second" },
    ];
    render(<NotificationContainer notifications={items} onDismiss={() => {}} />);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("gives error-type toasts role='alert'", () => {
    const items: NotificationItem[] = [
      { id: "e", type: "error", message: "Boom" },
    ];
    render(<NotificationContainer notifications={items} onDismiss={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
  });

  it("does not give success or info toasts role='alert'", () => {
    const items: NotificationItem[] = [
      { id: "s", type: "success", message: "Saved" },
      { id: "i", type: "info", message: "Hello" },
    ];
    render(<NotificationContainer notifications={items} onDismiss={() => {}} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls onDismiss with the correct id when the dismiss button is clicked", async () => {
    const onDismiss = jest.fn();
    const items: NotificationItem[] = [
      { id: "xyz", type: "info", message: "Hi" },
    ];
    render(<NotificationContainer notifications={items} onDismiss={onDismiss} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(onDismiss).toHaveBeenCalledWith("xyz");
  });
});
