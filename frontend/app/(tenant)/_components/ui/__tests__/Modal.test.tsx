import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../Modal";

describe("<Modal /> (tenant)", () => {
  it("renders nothing when isOpen=false", () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        content
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders role='dialog' with aria-modal=true and labels by title id", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Upload Receipt">
        content
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const heading = screen.getByRole("heading", { name: "Upload Receipt" });
    expect(heading.getAttribute("id")).toBeTruthy();
    expect(dialog).toHaveAttribute("aria-labelledby", heading.getAttribute("id")!);
  });

  it("renders children and optional footer", () => {
    render(
      <Modal isOpen onClose={() => {}} title="T" footer={<button>OK</button>}>
        body content
      </Modal>,
    );
    expect(screen.getByText("body content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
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
      <Modal isOpen onClose={onClose} title="T">
        body
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose on Escape when dismissOnEsc=false", async () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose} title="T" dismissOnEsc={false}>
        body
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT call onClose on backdrop click by default (forms-first)", async () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose} title="T">
        body
      </Modal>,
    );
    // The backdrop is the fixed inset-0 wrapper; targeting it via the dialog's parent.
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    await userEvent.pointer({ target: backdrop, keys: "[MouseLeft>]" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on backdrop mousedown when dismissOnBackdrop=true and target is the backdrop itself", () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose} title="T" dismissOnBackdrop>
        body
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    // fireEvent preserves React's synthetic event currentTarget identity,
    // which the component uses to distinguish backdrop vs dialog clicks.
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when mousedown bubbles up from inside the dialog content", () => {
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
      <Modal isOpen onClose={() => {}} title="T">
        body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <Modal isOpen={false} onClose={() => {}} title="T">
        body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("omits the header when no title and showCloseButton=false", () => {
    render(
      <Modal isOpen onClose={() => {}} showCloseButton={false}>
        body
      </Modal>,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});
