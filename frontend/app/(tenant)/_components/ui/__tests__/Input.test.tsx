import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Input } from "../Input";

describe("<Input /> (tenant)", () => {
  it("associates label and id", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows helperText when no error", () => {
    render(<Input label="Amount" helperText="in EUR" />);
    expect(screen.getByText("in EUR")).toBeInTheDocument();
  });

  it("swaps helperText for the error message when error is set", () => {
    render(<Input label="Amount" helperText="in EUR" error="Too low" />);
    expect(screen.getByText("Too low")).toBeInTheDocument();
    expect(screen.queryByText("in EUR")).not.toBeInTheDocument();
  });

  it("sets aria-invalid='true' and describedby the error id when in error state", () => {
    render(<Input label="Amount" error="Too low" />);
    const input = screen.getByLabelText("Amount");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", expect.stringContaining("description"));
  });

  it("renders left and right addons when provided", () => {
    render(
      <Input
        label="Amount"
        leftAddon={<span data-testid="left">€</span>}
        rightAddon={<span data-testid="right">/mo</span>}
      />,
    );
    expect(screen.getByTestId("left")).toBeInTheDocument();
    expect(screen.getByTestId("right")).toBeInTheDocument();
  });

  it("forwards refs so React Hook Form can register()", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="X" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("accepts typed input", async () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText("Email");
    await userEvent.type(input, "ada@example.com");
    expect(input).toHaveValue("ada@example.com");
  });
});
