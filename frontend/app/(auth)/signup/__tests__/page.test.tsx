import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockMutate = jest.fn();
let mockIsPending = false;
let mockIsError = false;
let mockError: Error | null = null;

jest.mock("@/lib/hooks/auth/useSignupMutation", () => ({
    useSignupMutation: () => ({
        mutate: mockMutate,
        isPending: mockIsPending,
        isError: mockIsError,
        error: mockError,
    }),
}));

import SignupPage from "../page";

beforeEach(() => {
    mockMutate.mockReset();
    mockIsPending = false;
    mockIsError = false;
    mockError = null;
});

function fillValidForm() {
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "John" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Smith" } });
    fireEvent.change(screen.getByLabelText("Email address"), {
        target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
        target: { value: "password123" },
    });
}

describe("<SignupPage />", () => {
    it("renders all form fields", () => {
        render(<SignupPage />);
        expect(screen.getByLabelText("First name")).toBeInTheDocument();
        expect(screen.getByLabelText("Last name")).toBeInTheDocument();
        expect(screen.getByLabelText("Email address")).toBeInTheDocument();
        expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
        expect(screen.getByLabelText("Password")).toBeInTheDocument();
        expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    });

    it("shows required-field errors when submitted empty", async () => {
        render(<SignupPage />);
        fireEvent.click(screen.getByRole("button", { name: /create account/i }));
        await screen.findByText("First name is required");
        expect(screen.getByText("Last name is required")).toBeInTheDocument();
        expect(screen.getByText("Email is required")).toBeInTheDocument();
        expect(mockMutate).not.toHaveBeenCalled();
    });

    it("does not show a phone validation error when phone is left empty", async () => {
        render(<SignupPage />);
        fireEvent.click(screen.getByRole("button", { name: /create account/i }));
        await screen.findByText("First name is required");
        expect(screen.queryByText(/phone.*required/i)).not.toBeInTheDocument();
    });

    it("shows the password mismatch error", async () => {
        render(<SignupPage />);
        fireEvent.change(screen.getByLabelText("First name"), { target: { value: "John" } });
        fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Smith" } });
        fireEvent.change(screen.getByLabelText("Email address"), {
            target: { value: "j@example.com" },
        });
        fireEvent.change(screen.getByLabelText("Password"), {
            target: { value: "password123" },
        });
        fireEvent.change(screen.getByLabelText("Confirm password"), {
            target: { value: "different" },
        });
        fireEvent.click(screen.getByRole("button", { name: /create account/i }));
        await screen.findByText("Passwords do not match");
        expect(mockMutate).not.toHaveBeenCalled();
    });

    it("calls mutate with form values on valid submission", async () => {
        render(<SignupPage />);
        fillValidForm();
        fireEvent.click(screen.getByRole("button", { name: /create account/i }));
        await waitFor(() =>
            expect(mockMutate).toHaveBeenCalledWith(
                expect.objectContaining({
                    firstName: "John",
                    lastName: "Smith",
                    email: "john@example.com",
                    password: "password123",
                    confirm: "password123",
                }),
            ),
        );
    });

    it("renders the mutation error message when isError is true", () => {
        mockIsError = true;
        mockError = new Error("Registration is not yet implemented.");
        render(<SignupPage />);
        expect(screen.getByRole("alert")).toHaveTextContent(
            "Registration is not yet implemented.",
        );
    });

    it("renders the tenant self-signup note", () => {
        render(<SignupPage />);
        expect(screen.getByText(/no self-signup for tenants/i)).toBeInTheDocument();
    });

    it("the 'Log in' link points to /login", () => {
        render(<SignupPage />);
        const link = screen.getByRole("link", { name: /log in/i });
        expect(link).toHaveAttribute("href", "/login");
    });
});
