import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/lib/auth/keycloak", () => ({
    login: jest.fn(),
}));

jest.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: jest.fn() }),
}));

import LoginPage from "../page";
import { login as mockLoginFn } from "@/lib/auth/keycloak";

const mockLogin = mockLoginFn as jest.Mock;

beforeEach(() => {
    mockLogin.mockReset();
});

describe("<LoginPage />", () => {
    it("renders the continue-to-sign-in button", () => {
        render(<LoginPage />);
        expect(
            screen.getByRole("button", { name: /continue to sign-in/i }),
        ).toBeInTheDocument();
    });

    it("clicking the button calls login()", () => {
        render(<LoginPage />);
        fireEvent.click(screen.getByRole("button", { name: /continue to sign-in/i }));
        expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it("the 'Create a landlord account' link points to /signup", () => {
        render(<LoginPage />);
        const link = screen.getByRole("link", { name: /create a landlord account/i });
        expect(link).toHaveAttribute("href", "/signup");
    });

    it("does NOT show the registration banner when query param is absent", () => {
        render(<LoginPage />);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
});
