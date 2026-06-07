import { render, screen } from "@testing-library/react";
import { StepIndicator } from "../StepIndicator";

// StepIndicator is a small state machine: each step is done / current / upcoming
// relative to `current`. State is expressed via CSS classes + aria-current, so
// the tone tests assert those rather than just the visible label.

describe("StepIndicator", () => {
  it("renders all three step titles", () => {
    render(<StepIndicator current={0} />);
    expect(screen.getByText("Review lease")).toBeInTheDocument();
    expect(screen.getByText("Accept & verify")).toBeInTheDocument();
    expect(screen.getByText("Create account")).toBeInTheDocument();
  });

  it("renders the mobile 'Step N of M' progress text for the current step", () => {
    render(<StepIndicator current={1} />);
    expect(screen.getByText("Step 2 of 3: Accept & verify")).toBeInTheDocument();
  });

  it("marks only the current step with aria-current='step'", () => {
    render(<StepIndicator current={1} />);
    expect(screen.getByText("2")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("1")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("3")).not.toHaveAttribute("aria-current");
  });

  it("styles past steps as done, the current step as current, and later steps as upcoming", () => {
    render(<StepIndicator current={1} />);

    // Step 1 (index 0) is behind us → done: filled, no ring.
    const done = screen.getByText("1");
    expect(done).toHaveClass("bg-primary");
    expect(done).not.toHaveClass("ring-2");

    // Step 2 (index 1) is current → filled + ring.
    const current = screen.getByText("2");
    expect(current).toHaveClass("ring-2");

    // Step 3 (index 2) is upcoming → surface background, not filled.
    const upcoming = screen.getByText("3");
    expect(upcoming).toHaveClass("bg-surface");
    expect(upcoming).not.toHaveClass("bg-primary");
  });
});
