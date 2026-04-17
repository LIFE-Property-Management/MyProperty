import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Textarea } from "../Textarea";

describe("<Textarea /> (tenant)", () => {
  it("associates label with textarea via generated id", () => {
    render(<Textarea label="Notes" />);
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
  });

  it("shows helperText under the textarea when no error", () => {
    render(<Textarea label="Notes" helperText="Up to 500 chars" />);
    const textarea = screen.getByLabelText("Notes");
    expect(screen.getByText("Up to 500 chars")).toBeInTheDocument();
    expect(textarea).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("description"),
    );
    expect(textarea).not.toHaveAttribute("aria-invalid", "true");
  });

  it("shows the error and sets aria-invalid='true' when error is present", () => {
    render(<Textarea label="Notes" error="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toHaveAttribute("aria-invalid", "true");
  });

  it("hides helperText when error is present (error takes priority)", () => {
    render(<Textarea label="Notes" helperText="Up to 500 chars" error="Too short" />);
    expect(screen.getByText("Too short")).toBeInTheDocument();
    expect(screen.queryByText("Up to 500 chars")).not.toBeInTheDocument();
  });

  it("forwards refs", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea label="N" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("accepts user input", async () => {
    render(<Textarea label="Notes" />);
    const input = screen.getByLabelText("Notes");
    await userEvent.type(input, "cash, Friday 11am");
    expect(input).toHaveValue("cash, Friday 11am");
  });
});
