import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockMutate = jest.fn();
let mockIsPending = false;
let mockIsError = false;
let mockError: Error | null = null;

jest.mock("@/lib/hooks/auth/useLoginMutation", () => ({
    useLoginMutation: () => ({
        mutate: mockMutate,
        isPending: mockIsPending,
        isError: mockIsError,
        error: mockError,
    }),
}));

import LoginPage from "../page";

beforeEach(() => {
    mockMutate.mockReset();
    mockIsPending = false;
    mockIsError = false;
    mockError = null;
});

describe("<LoginPage />", () => {
    it("renders email and password fields and the submit button", () => {
        render(<LoginPage />);
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
    });

    it("shows required-field errors when submitted empty", async () => {
        render(<LoginPage />);
        fireEvent.click(screen.getByRole("button", { name: /log in/i }));
        await screen.findByText("Email is required");
        expect(screen.getByText("Password is required")).toBeInTheDocument();
        expect(mockMutate).not.toHaveBeenCalled();
    });

    it("shows email format error for an invalid email", async () => {
        render(<LoginPage />);
        fireEvent.change(screen.getByLabelText(/email address/i), {
            target: { value: "not-an-email" },
        });
        fireEvent.click(screen.getByRole("button", { name: /log in/i }));
        await screen.findByText("Enter a valid email");
        expect(mockMutate).not.toHaveBeenCalled();
    });

    it("calls mutate with form values on valid submission", async () => {
        render(<LoginPage />);
        fireEvent.change(screen.getByLabelText(/email address/i), {
            target: { value: "landlord@example.com" },
        });
        fireEvent.change(screen.getByLabelText(/password/i), {
            target: { value: "secret123" },
        });
        fireEvent.click(screen.getByRole("button", { name: /log in/i }));
        await waitFor(() =>
            expect(mockMutate).toHaveBeenCalledWith(
                { email: "landlord@example.com", password: "secret123" },
            ),
        );
    });

    it("renders the mutation error message when isError is true", () => {
        mockIsError = true;
        mockError = new Error("Authentication is not yet implemented.");
        render(<LoginPage />);
        expect(screen.getByRole("alert")).toHaveTextContent(
            "Authentication is not yet implemented.",
        );
    });

    it("the 'Sign up' link points to /signup", () => {
        render(<LoginPage />);
        const link = screen.getByRole("link", { name: /sign up/i });
        expect(link).toHaveAttribute("href", "/signup");
    });

    it("the 'Forgot password?' link points to /forgot-password", () => {
        render(<LoginPage />);
        const link = screen.getByRole("link", { name: /forgot password/i });
        expect(link).toHaveAttribute("href", "/forgot-password");
    });
});
