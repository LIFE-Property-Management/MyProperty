import { render, screen } from "@testing-library/react";
import { Badge } from "../Badge";

describe("<Badge />", () => {
  it("renders children as text", () => {
    render(<Badge>Outstanding</Badge>);
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
  });

  it("uses neutral tone by default", () => {
    render(<Badge>Plain</Badge>);
    const badge = screen.getByText("Plain");
    expect(badge).toHaveClass("bg-neutral-light");
  });

  it.each([
    ["neutral", "bg-neutral-light"],
    ["success", "bg-success-light"],
    ["warning", "bg-warning-light"],
    ["info", "bg-info-light"],
    ["danger", "bg-danger-light"],
  ] as const)("applies the %s tone background class", (tone, bgClass) => {
    render(<Badge tone={tone}>x</Badge>);
    expect(screen.getByText("x")).toHaveClass(bgClass);
  });

  it("merges a user-supplied className with base classes", () => {
    render(
      <Badge tone="success" className="custom-extra">
        x
      </Badge>,
    );
    const badge = screen.getByText("x");
    expect(badge).toHaveClass("custom-extra");
    expect(badge).toHaveClass("whitespace-nowrap");
  });
});
