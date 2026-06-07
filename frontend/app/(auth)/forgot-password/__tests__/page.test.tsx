import { render, screen } from "@testing-library/react";
import ForgotPasswordPage from "../page";

describe("<ForgotPasswordPage />", () => {
    it("renders the Reset your password heading", () => {
        render(<ForgotPasswordPage />);
        expect(
            screen.getByRole("heading", { name: /reset your password/i }),
        ).toBeInTheDocument();
    });

    it("renders the coming-soon copy", () => {
        render(<ForgotPasswordPage />);
        expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    });

    it("renders a link back to /login", () => {
        render(<ForgotPasswordPage />);
        const link = screen.getByRole("link", { name: /back to log in/i });
        expect(link).toHaveAttribute("href", "/login");
    });
});
