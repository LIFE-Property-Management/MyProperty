import { render, screen } from "@testing-library/react";
import LandingNav from "../LandingNav";

describe("<LandingNav />", () => {
    it("renders the brand text", () => {
        render(<LandingNav />);
        expect(screen.getByText("MyProperty")).toBeInTheDocument();
    });

    it("renders a link to /login", () => {
        render(<LandingNav />);
        const link = screen.getByRole("link", { name: /log in/i });
        expect(link).toHaveAttribute("href", "/login");
    });

    it("renders a link to /signup", () => {
        render(<LandingNav />);
        const link = screen.getByRole("link", { name: /sign up/i });
        expect(link).toHaveAttribute("href", "/signup");
    });
});
