import { render, screen } from "@testing-library/react";
import FinalCTA from "../FinalCTA";

describe("<FinalCTA />", () => {
    it("renders the CTA heading", () => {
        render(<FinalCTA />);
        expect(
            screen.getByText(/ready to simplify property management/i),
        ).toBeInTheDocument();
    });

    it("renders a link to /signup", () => {
        render(<FinalCTA />);
        const link = screen.getByRole("link", { name: /get started/i });
        expect(link).toHaveAttribute("href", "/signup");
    });
});
