import { render, screen } from "@testing-library/react";
import StatsStrip from "../StatsStrip";

describe("<StatsStrip />", () => {
    it("renders all three stat items", () => {
        render(<StatsStrip />);
        expect(screen.getByTestId("stat-rent")).toBeInTheDocument();
        expect(screen.getByTestId("stat-properties")).toBeInTheDocument();
        expect(screen.getByTestId("stat-landlords")).toBeInTheDocument();
    });

    it("marks each stat value with data-todo='real-stats'", () => {
        render(<StatsStrip />);
        const statEls = screen.getAllByTestId(/^stat-/);
        statEls.forEach((el) => {
            expect(el).toHaveAttribute("data-todo", "real-stats");
        });
    });

    it("renders the stat labels", () => {
        render(<StatsStrip />);
        expect(screen.getByText("Rent collected")).toBeInTheDocument();
        expect(screen.getByText("Properties managed")).toBeInTheDocument();
        expect(screen.getByText("Landlords onboarded")).toBeInTheDocument();
    });
});
