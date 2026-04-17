import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Input } from "../Input";

describe("<Input /> (shared)", () => {
  it("associates the label with the input via generated id", () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toBeInTheDocument();
  });

  it("uses the provided id when supplied", () => {
    render(<Input id="my-input" label="Name" />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("id", "my-input");
  });

  it("shows the hint message when no error", () => {
    render(<Input label="City" hint="Where you live" />);
    expect(screen.getByText("Where you live")).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("hint"),
    );
  });

  it("shows the error message and aria-invalid='true' when error is present", () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("prefers the error message over the hint when both are supplied", () => {
    render(<Input label="Amount" hint="in EUR" error="Too low" />);
    expect(screen.getByText("Too low")).toBeInTheDocument();
    expect(screen.queryByText("in EUR")).not.toBeInTheDocument();
  });

  it("forwards refs to the input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="Ref test" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("accepts user input", async () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText("Email");
    await userEvent.type(input, "ada@example.com");
    expect(input).toHaveValue("ada@example.com");
  });
});
