import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../Modal";

describe("<Modal /> (shared)", () => {
  it("renders nothing when open=false", () => {
    render(
      <Modal open={false} onClose={() => {}}>
        body
      </Modal>,
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  it("renders dialog with aria-modal and aria-label from title when open", () => {
    render(
      <Modal open onClose={() => {}} title="Confirm">
        body
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Confirm");
  });

  it("renders the title in a heading when provided", () => {
    render(
      <Modal open onClose={() => {}} title="Delete item">
        body
      </Modal>,
    );
    expect(screen.getByRole("heading", { name: "Delete item" })).toBeInTheDocument();
  });

  it("renders footer content when provided", () => {
    render(
      <Modal open onClose={() => {}} footer={<button>OK</button>}>
        body
      </Modal>,
    );
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = jest.fn();
    render(
      <Modal open onClose={onClose}>
        body
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const onClose = jest.fn();
    render(
      <Modal open onClose={onClose}>
        body
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when inner content is clicked", async () => {
    const onClose = jest.fn();
    render(
      <Modal open onClose={onClose} title="Header">
        <span>inner content</span>
      </Modal>,
    );
    await userEvent.click(screen.getByText("inner content"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks body scroll while open and restores on close", () => {
    document.body.style.overflow = "";
    const { rerender } = render(
      <Modal open onClose={() => {}}>
        body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <Modal open={false} onClose={() => {}}>
        body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("");
  });
});
