import { render, screen } from "@testing-library/react";
import { Card } from "../Card";

describe("<Card /> (tenant)", () => {
  it("renders children", () => {
    render(<Card>inside</Card>);
    expect(screen.getByText("inside")).toBeInTheDocument();
  });

  it.each([
    ["none", "p-0"],
    ["sm", "p-4"],
    ["md", "p-6"],
    ["lg", "p-8"],
  ] as const)("applies padding=%s → %s", (padding, clazz) => {
    render(
      <Card padding={padding} data-testid="card">
        x
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveClass(clazz);
  });

  it.each([
    ["section", "section"],
    ["article", "article"],
  ] as const)("renders as a <%s>", (as, tag) => {
    render(
      <Card as={as} data-testid={`card-${as}`}>
        x
      </Card>,
    );
    expect(screen.getByTestId(`card-${as}`).tagName.toLowerCase()).toBe(tag);
  });

  it("merges custom className with base classes", () => {
    render(
      <Card className="custom" data-testid="card">
        x
      </Card>,
    );
    const el = screen.getByTestId("card");
    expect(el).toHaveClass("custom");
    expect(el).toHaveClass("rounded-xl");
  });
});
