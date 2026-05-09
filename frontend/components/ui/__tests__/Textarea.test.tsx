import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { Textarea } from "../Textarea";

describe("<Textarea />", () => {
  it("renders label associated with textarea via generated id", () => {
    render(<Textarea label="Notes" />);
    const textarea = screen.getByLabelText("Notes");
    expect(textarea).toBeInTheDocument();
    expect(textarea.id).toBeTruthy();
  });

  it("uses the provided id when supplied and the label's htmlFor matches", () => {
    render(<Textarea id="my-ta" label="Notes" />);
    const textarea = screen.getByLabelText("Notes");
    expect(textarea).toHaveAttribute("id", "my-ta");
  });

  it("renders helperText when provided and no error", () => {
    render(<Textarea label="Notes" helperText="Up to 500 chars" />);
    const textarea = screen.getByLabelText("Notes");
    expect(screen.getByText("Up to 500 chars")).toBeInTheDocument();
    expect(textarea).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("description"),
    );
    expect(textarea).not.toHaveAttribute("aria-invalid", "true");
  });

  it("renders error and sets aria-invalid when error is present", () => {
    render(<Textarea label="Notes" error="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toHaveAttribute("aria-invalid", "true");
  });

  it("prefers the error over helperText when both are provided", () => {
    render(<Textarea label="Notes" helperText="Up to 500 chars" error="Too short" />);
    expect(screen.getByText("Too short")).toBeInTheDocument();
    expect(screen.queryByText("Up to 500 chars")).not.toBeInTheDocument();
  });

  it("points aria-describedby at the description span", () => {
    render(<Textarea label="Notes" helperText="hint" />);
    const textarea = screen.getByLabelText("Notes");
    const describedBy = textarea.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("hint");
  });

  it("forwards refs to the textarea element", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea label="N" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("forwards native textarea props", () => {
    render(
      <Textarea
        label="Notes"
        rows={7}
        placeholder="Type here"
        disabled
      />,
    );
    const textarea = screen.getByLabelText("Notes");
    expect(textarea).toHaveAttribute("rows", "7");
    expect(textarea).toHaveAttribute("placeholder", "Type here");
    expect(textarea).toBeDisabled();
  });
});
