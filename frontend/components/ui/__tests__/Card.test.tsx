import { render, screen } from "@testing-library/react";
import { Card } from "../Card";

describe("<Card /> (shared)", () => {
  it("renders children", () => {
    render(<Card>inside</Card>);
    expect(screen.getByText("inside")).toBeInTheDocument();
  });

  it("applies padding classes by default", () => {
    render(
      <Card data-testid="card">
        <p>x</p>
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveClass("p-4");
  });

  it("omits padding when padded=false", () => {
    render(
      <Card padded={false} data-testid="card">
        <p>x</p>
      </Card>,
    );
    expect(screen.getByTestId("card")).not.toHaveClass("p-4");
    expect(screen.getByTestId("card")).not.toHaveClass("p-6");
  });

  it("always applies the surface/border/rounded styling", () => {
    render(<Card data-testid="card">x</Card>);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("bg-surface");
    expect(card).toHaveClass("border-border");
    expect(card).toHaveClass("rounded-lg");
  });
});
