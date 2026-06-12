import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateInviteForm from "../CreateInviteForm";

// Mock the mutation hook — the form calls mutate(values, { onSuccess }). isError/
// isPending are read via closures so individual tests can flip them.
const mutate = jest.fn();
let isError = false;
let isPending = false;
jest.mock("@/lib/hooks/useCreateInvite", () => ({
  useCreateInvite: () => ({ mutate, isError, isPending }),
}));

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const PROPERTY_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  mutate.mockReset();
  push.mockReset();
  isError = false;
  isPending = false;
});

describe("<CreateInviteForm />", () => {
  it("shows a guidance notice and no form when no propertyId is provided", () => {
    render(<CreateInviteForm />);
    expect(screen.queryByLabelText(/tenant email/i)).not.toBeInTheDocument();
    expect(screen.getByText(/specific property/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to properties/i })).toBeInTheDocument();
  });

  it("renders all invite fields when a propertyId is provided", () => {
    render(<CreateInviteForm propertyId={PROPERTY_ID} />);
    expect(screen.getByLabelText(/tenant email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lease start/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lease end/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/monthly rent/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
  });

  it("blocks submission and surfaces a validation error when fields are empty", async () => {
    render(<CreateInviteForm propertyId={PROPERTY_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("submits the invite (uppercasing currency) and redirects on success", async () => {
    mutate.mockImplementationOnce((_values, opts) => opts?.onSuccess?.());
    render(<CreateInviteForm propertyId={PROPERTY_ID} />);

    fireEvent.change(screen.getByLabelText(/tenant email/i), {
      target: { value: "tenant@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Tess" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Tenant" } });
    fireEvent.change(screen.getByLabelText(/lease start/i), { target: { value: "2030-01-01" } });
    fireEvent.change(screen.getByLabelText(/lease end/i), { target: { value: "2031-01-01" } });
    fireEvent.change(screen.getByLabelText(/monthly rent/i), { target: { value: "1200" } });
    fireEvent.change(screen.getByLabelText(/currency/i), { target: { value: "eur" } });

    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate).toHaveBeenCalledWith(
      {
        propertyId: PROPERTY_ID,
        email: "tenant@example.com",
        firstName: "Tess",
        lastName: "Tenant",
        proposedStartDate: "2030-01-01",
        proposedEndDate: "2031-01-01",
        proposedMonthlyRent: 1200,
        currency: "EUR",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/invites"));
  });

  it("does not redirect when the mutation does not succeed", async () => {
    mutate.mockImplementationOnce(() => {});
    render(<CreateInviteForm propertyId={PROPERTY_ID} />);

    fireEvent.change(screen.getByLabelText(/tenant email/i), {
      target: { value: "tenant@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Tess" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Tenant" } });
    fireEvent.change(screen.getByLabelText(/lease start/i), { target: { value: "2030-01-01" } });
    fireEvent.change(screen.getByLabelText(/lease end/i), { target: { value: "2031-01-01" } });
    fireEvent.change(screen.getByLabelText(/monthly rent/i), { target: { value: "1200" } });
    fireEvent.change(screen.getByLabelText(/currency/i), { target: { value: "EUR" } });

    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
  });
});
