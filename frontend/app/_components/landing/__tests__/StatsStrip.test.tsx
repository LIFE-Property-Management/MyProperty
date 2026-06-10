import { render, screen } from "@testing-library/react";
import { usePublicStats } from "@/lib/hooks";
import StatsStrip from "../StatsStrip";

jest.mock("@/lib/hooks", () => ({
    usePublicStats: jest.fn(),
}));

const mockUsePublicStats = usePublicStats as jest.MockedFunction<typeof usePublicStats>;

beforeEach(() => {
    mockUsePublicStats.mockReturnValue({
        data: { rentCollected: 0, propertiesManaged: 0, landlordsOnboarded: 0 },
    } as ReturnType<typeof usePublicStats>);
});

describe("<StatsStrip />", () => {
    it("renders all three stat items", () => {
        render(<StatsStrip />);
        expect(screen.getByTestId("stat-rent")).toBeInTheDocument();
        expect(screen.getByTestId("stat-properties")).toBeInTheDocument();
        expect(screen.getByTestId("stat-landlords")).toBeInTheDocument();
    });

    it("renders the stat labels", () => {
        render(<StatsStrip />);
        expect(screen.getByText("Rent collected")).toBeInTheDocument();
        expect(screen.getByText("Properties managed")).toBeInTheDocument();
        expect(screen.getByText("Landlords onboarded")).toBeInTheDocument();
    });

    it("formats rent collected from the hook data", () => {
        mockUsePublicStats.mockReturnValue({
            data: { rentCollected: 1500, propertiesManaged: 3, landlordsOnboarded: 2 },
        } as ReturnType<typeof usePublicStats>);
        render(<StatsStrip />);
        expect(screen.getByTestId("stat-rent")).toHaveTextContent("$2K");
        expect(screen.getByTestId("stat-properties")).toHaveTextContent("3");
        expect(screen.getByTestId("stat-landlords")).toHaveTextContent("2");
    });
});
