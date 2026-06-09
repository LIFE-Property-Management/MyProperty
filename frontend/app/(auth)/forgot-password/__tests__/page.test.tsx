import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/lib/auth/keycloak", () => ({
    resetPassword: jest.fn(),
}));

import ForgotPasswordPage from "../page";
import { resetPassword as mockResetFn } from "@/lib/auth/keycloak";

const mockReset = mockResetFn as jest.Mock;

beforeEach(() => {
    mockReset.mockReset();
});

describe("<ForgotPasswordPage />", () => {
    it("renders the Reset your password heading", () => {
        render(<ForgotPasswordPage />);
        expect(
            screen.getByRole("heading", { name: /reset your password/i }),
        ).toBeInTheDocument();
    });

    it("clicking the continue button calls resetPassword()", () => {
        render(<ForgotPasswordPage />);
        fireEvent.click(
            screen.getByRole("button", { name: /continue to password reset/i }),
        );
        expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it("renders a link back to /login", () => {
        render(<ForgotPasswordPage />);
        const link = screen.getByRole("link", { name: /back to log in/i });
        expect(link).toHaveAttribute("href", "/login");
    });
});
