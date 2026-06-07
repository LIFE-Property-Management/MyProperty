import { render, screen } from "@testing-library/react";
import { Logo } from "../Logo";

describe("<Logo />", () => {
    it("renders the brand text", () => {
        render(<Logo />);
        expect(screen.getByText("MyProperty")).toBeInTheDocument();
    });

    it("uses default size 22 when no prop is given", () => {
        render(<Logo />);
        const text = screen.getByText("MyProperty");
        expect(text).toHaveStyle({ fontSize: "22px" });
    });

    it("applies the given size to the brand text", () => {
        render(<Logo size={32} />);
        const text = screen.getByText("MyProperty");
        expect(text).toHaveStyle({ fontSize: "32px" });
    });

    it("renders a green box with the house icon", () => {
        render(<Logo data-testid="logo" />);
        const box = screen.getByText("MyProperty").previousElementSibling;
        expect(box?.className).toMatch(/bg-primary/);
    });
});
