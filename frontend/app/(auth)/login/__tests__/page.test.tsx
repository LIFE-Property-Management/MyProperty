import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/lib/auth/keycloak", () => ({
    login: jest.fn(),
    // Resolve immediately with no session so the page leaves its initial
    // "Signing you in…" state and renders the unauthenticated sign-in view.
    initKeycloak: jest.fn(() => Promise.resolve()),
}));

jest.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

import LoginPage from "../page";
import { login as mockLoginFn } from "@/lib/auth/keycloak";

const mockLogin = mockLoginFn as jest.Mock;

beforeEach(() => {
    mockLogin.mockReset();
});

describe("<LoginPage />", () => {
    it("renders the continue-to-sign-in button once init resolves", async () => {
        render(<LoginPage />);
        expect(
            await screen.findByRole("button", { name: /continue to sign-in/i }),
        ).toBeInTheDocument();
    });

    it("clicking the button calls login()", async () => {
        render(<LoginPage />);
        fireEvent.click(
            await screen.findByRole("button", { name: /continue to sign-in/i }),
        );
        expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it("the 'Create a landlord account' link points to /signup", async () => {
        render(<LoginPage />);
        await screen.findByRole("button", { name: /continue to sign-in/i });
        const link = screen.getByRole("link", { name: /create a landlord account/i });
        expect(link).toHaveAttribute("href", "/signup");
    });

    it("does NOT show the registration banner when query param is absent", async () => {
        render(<LoginPage />);
        // Wait out the loading state (which itself uses role="status").
        await screen.findByRole("button", { name: /continue to sign-in/i });
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
});
