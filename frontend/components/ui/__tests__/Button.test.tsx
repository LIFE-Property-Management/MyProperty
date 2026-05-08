import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Button } from "../Button";

describe("<Button />", () => {
  it("renders its children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("defaults to type='button' to prevent accidental form submission", () => {
    render(<Button>Next</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("passes through type='submit' when explicitly provided", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it.each(["primary", "secondary", "ghost", "danger"] as const)(
      "applies variant=%s with a background class",
      (variant) => {
        render(
            <Button variant={variant} data-testid="btn">
              X
            </Button>,
        );
        expect(screen.getByTestId("btn").className).toMatch(/bg-/);
      },
  );

  it.each([
    ["sm", "h-8"],
    ["md", "h-10"],
    ["lg", "h-12"],
  ] as const)("applies size=%s height class %s", (size, clazz) => {
    render(
        <Button size={size} data-testid="btn">
          X
        </Button>,
    );
    expect(screen.getByTestId("btn")).toHaveClass(clazz);
  });

  it("forwards refs to the DOM element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>X</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("disables interaction when disabled is set", async () => {
    const onClick = jest.fn();
    render(
        <Button disabled onClick={onClick}>
          Off
        </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("invokes onClick when not disabled", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("marks aria-busy='true' while isLoading", () => {
    render(<Button isLoading>Working</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("disables the button while isLoading", () => {
    render(<Button isLoading>Working</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders the spinner while isLoading", () => {
    render(<Button isLoading>Working</Button>);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders leftIcon when not loading", () => {
    render(<Button leftIcon={<span data-testid="icon">i</span>}>Go</Button>);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("hides rightIcon while loading", () => {
    render(
        <Button isLoading rightIcon={<span data-testid="right">→</span>}>
          X
        </Button>,
    );
    expect(screen.queryByTestId("right")).not.toBeInTheDocument();
  });

  it("applies the w-full class when fullWidth is set", () => {
    render(
        <Button fullWidth data-testid="btn">
          X
        </Button>,
    );
    expect(screen.getByTestId("btn")).toHaveClass("w-full");
  });

  it("wraps children in an invisible container while isLoading (overlay pattern)", () => {
    render(
        <Button isLoading>
          <span data-testid="label">Working</span>
        </Button>,
    );
    const label = screen.getByTestId("label");
    expect(label.parentElement?.className).toContain("invisible");
  });
});
