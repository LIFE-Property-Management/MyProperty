import { render, screen } from "@testing-library/react";
import HeroSection from "../HeroSection";

describe("<HeroSection />", () => {
    it("renders the main heading", () => {
        render(<HeroSection />);
        expect(screen.getByText(/manage your properties/i)).toBeInTheDocument();
    });

    it("renders the primary CTA linking to /signup", () => {
        render(<HeroSection />);
        const links = screen.getAllByRole("link", { name: /get started/i });
        expect(links.some((l) => l.getAttribute("href") === "/signup")).toBe(true);
    });

    it("renders the secondary CTA linking to /login", () => {
        render(<HeroSection />);
        const link = screen.getByRole("link", { name: /^log in$/i });
        expect(link).toHaveAttribute("href", "/login");
    });
});
