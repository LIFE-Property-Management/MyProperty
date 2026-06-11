import { render, screen } from "@testing-library/react";
import StatsStripView from "../StatsStripView";

describe("<StatsStripView />", () => {
    it("renders all three stat items and their labels", () => {
        render(
            <StatsStripView rentCollected={0} currency="" propertiesManaged={0} landlordsOnboarded={0} />,
        );
        expect(screen.getByTestId("stat-rent")).toBeInTheDocument();
        expect(screen.getByTestId("stat-properties")).toBeInTheDocument();
        expect(screen.getByTestId("stat-landlords")).toBeInTheDocument();
        expect(screen.getByText("Rent collected")).toBeInTheDocument();
        expect(screen.getByText("Properties managed")).toBeInTheDocument();
        expect(screen.getByText("Landlords onboarded")).toBeInTheDocument();
    });

    it("formats rent compactly using the provided currency", () => {
        render(
            <StatsStripView rentCollected={1500} currency="EUR" propertiesManaged={3} landlordsOnboarded={2} />,
        );
        expect(screen.getByTestId("stat-rent")).toHaveTextContent("€1.5K");
        expect(screen.getByTestId("stat-properties")).toHaveTextContent("3");
        expect(screen.getByTestId("stat-landlords")).toHaveTextContent("2");
    });

    it("formats millions compactly", () => {
        render(
            <StatsStripView rentCollected={1_200_000} currency="USD" propertiesManaged={10} landlordsOnboarded={4} />,
        );
        expect(screen.getByTestId("stat-rent")).toHaveTextContent("$1.2M");
    });

    it("renders a plain zero when there is no currency yet (no confirmed payments)", () => {
        render(
            <StatsStripView rentCollected={0} currency="" propertiesManaged={0} landlordsOnboarded={0} />,
        );
        expect(screen.getByTestId("stat-rent")).toHaveTextContent("0");
    });
});
