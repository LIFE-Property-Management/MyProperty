import { render, screen } from "@testing-library/react";
import { Badge } from "../Badge";

describe("<Badge /> (tenant)", () => {
  it("renders children as text", () => {
    render(<Badge>Outstanding</Badge>);
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
  });

  it("uses neutral tone by default", () => {
    render(<Badge>Plain</Badge>);
    // Neutral bg hex from the component source — we only assert the hex
    // signature, not the full class list, to keep the test non-brittle.
    const badge = screen.getByText("Plain");
    expect(badge.className).toMatch(/bg-\[#f3f4f6\]/);
  });

  it.each([
    ["success", "#dcfce7"],
    ["warning", "#fef3c7"],
    ["info", "#dbeafe"],
    ["danger", "#fee2e2"],
  ] as const)("applies the %s tone classes", (tone, hex) => {
    render(<Badge tone={tone}>x</Badge>);
    const badge = screen.getByText("x");
    expect(badge.className).toContain(`bg-[${hex}]`);
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
