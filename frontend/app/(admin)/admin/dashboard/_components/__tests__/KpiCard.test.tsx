import { render, screen } from "@testing-library/react";
import { KpiCard } from "../KpiCard";

describe("<KpiCard />", () => {
  it("renders the label and value", () => {
    render(<KpiCard label="Total users" value={142} />);
    expect(screen.getByText("Total users")).toBeInTheDocument();
    expect(screen.getByText("142")).toBeInTheDocument();
  });

  it("renders the optional hint when provided", () => {
    render(<KpiCard label="Occupancy" value="79.7%" hint="of 64 properties" />);
    expect(screen.getByText("of 64 properties")).toBeInTheDocument();
  });

  it("omits the hint when not provided", () => {
    const { container } = render(<KpiCard label="Active leases" value={51} />);
    // Only the label and value paragraphs render — no third line.
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });
});
