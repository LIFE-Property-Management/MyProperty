import { render, screen } from "@testing-library/react";
import { Spinner } from "../Spinner";

describe("<Spinner />", () => {
  it("exposes role='status' with aria-label", () => {
    render(<Spinner />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Loading");
  });

  it("uses a custom label when provided", () => {
    render(<Spinner label="Saving..." />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Saving...");
    // sr-only text is also in the DOM
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it.each([
    ["sm", "w-4"],
    ["md", "w-6"],
    ["lg", "w-10"],
  ] as const)("applies the %s size class", (size, clazz) => {
    render(<Spinner size={size} />);
    const svg = screen.getByRole("status").querySelector("svg");
    expect(svg).toHaveClass(clazz);
  });

  it("respects prefers-reduced-motion (motion-reduce:animate-none)", () => {
    render(<Spinner />);
    const svg = screen.getByRole("status").querySelector("svg");
    expect(svg).toHaveClass("motion-reduce:animate-none");
    expect(svg).toHaveClass("animate-spin");
  });
});
