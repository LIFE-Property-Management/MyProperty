import { render, screen } from "@testing-library/react";
import HomePage from "../page";

// StatsStrip is an async Server Component (it fetches server-side). Stub it with
// a sync placeholder so HomePage renders in jsdom; its behavior is covered by
// StatsStrip.test.tsx / StatsStripView.test.tsx.
jest.mock("../_components/landing/StatsStrip", () => ({
    __esModule: true,
    default: () => <div data-testid="stats-strip" />,
}));

describe("<HomePage />", () => {
    it("renders the hero heading", () => {
        render(<HomePage />);
        expect(
            screen.getByRole("heading", { name: /manage your properties/i, level: 1 }),
        ).toBeInTheDocument();
    });

    it("renders the features section heading", () => {
        render(<HomePage />);
        expect(screen.getByText(/everything you need to manage/i)).toBeInTheDocument();
    });

    it("renders the how-it-works section heading", () => {
        render(<HomePage />);
        expect(screen.getByText(/get started in minutes/i)).toBeInTheDocument();
    });

    it("renders the stats strip", () => {
        render(<HomePage />);
        expect(screen.getByTestId("stats-strip")).toBeInTheDocument();
    });

    it("renders the final CTA heading", () => {
        render(<HomePage />);
        expect(screen.getByText(/ready to simplify property management/i)).toBeInTheDocument();
    });

    it("renders the footer copyright", () => {
        render(<HomePage />);
        expect(screen.getByText(/© 2026 MyProperty/i)).toBeInTheDocument();
    });

    it("has a main landmark with id='main-content' for the skip link", () => {
        render(<HomePage />);
        expect(document.getElementById("main-content")).toBeInTheDocument();
    });
});
