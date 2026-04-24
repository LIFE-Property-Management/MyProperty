import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../Modal";

describe("<Modal />", () => {
  it("renders nothing when isOpen=false", () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        body
      </Modal>,
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog with aria-modal='true' when open", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Confirm">
        body
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("aria-labelledby references the heading's id", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Upload Receipt">
        body
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    const heading = screen.getByRole("heading", { name: "Upload Receipt" });
    expect(heading.getAttribute("id")).toBeTruthy();
    expect(dialog).toHaveAttribute("aria-labelledby", heading.getAttribute("id")!);
  });

  it("renders the title in a heading when provided", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Delete item">
        body
      </Modal>,
    );
    expect(screen.getByRole("heading", { name: "Delete item" })).toBeInTheDocument();
  });

  it("renders footer content when provided", () => {
    render(
      <Modal isOpen onClose={() => {}} footer={<button>OK</button>}>
        body
      </Modal>,
    );
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose} title="T">
        body
      </Modal>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed by default", async () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose}>
        body
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose on Escape when dismissOnEsc={false}", async () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose} dismissOnEsc={false}>
        body
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT call onClose on backdrop click by default (forms-first)", () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose} title="T">
        body
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on backdrop mouseDown when dismissOnBackdrop is set AND target is backdrop itself", () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose} title="T" dismissOnBackdrop>
        body
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when mouseDown bubbles up from inside the dialog content", () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose} title="T" dismissOnBackdrop>
        <span data-testid="inner">child</span>
      </Modal>,
    );
    fireEvent.mouseDown(screen.getByTestId("inner"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks body scroll while open and restores on close", () => {
    document.body.style.overflow = "";
    const { rerender } = render(
      <Modal isOpen onClose={() => {}}>
        body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <Modal isOpen={false} onClose={() => {}}>
        body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("omits the header entirely when no title and showCloseButton={false}", () => {
    render(
      <Modal isOpen onClose={() => {}} showCloseButton={false}>
        body
      </Modal>,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});
