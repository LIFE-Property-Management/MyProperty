import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Button } from "../Button";

describe("<Button /> (tenant)", () => {
  it("renders children", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button", { name: "Click" })).toBeInTheDocument();
  });

  it("defaults to type='button' (not form submit)", () => {
    render(<Button>X</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("renders as a submit button when type='submit'", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("disables and marks aria-busy=true while isLoading", () => {
    render(<Button isLoading>Working</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("shows a spinner in the leftIcon slot while isLoading", () => {
    render(<Button isLoading>Working</Button>);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders leftIcon when not loading", () => {
    render(
      <Button leftIcon={<span data-testid="icon">i</span>}>Go</Button>,
    );
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

  it("applies fullWidth when set", () => {
    render(
      <Button fullWidth data-testid="btn">
        X
      </Button>,
    );
    expect(screen.getByTestId("btn")).toHaveClass("w-full");
  });

  it.each(["primary", "secondary", "ghost", "danger"] as const)(
    "applies variant=%s distinct styling",
    (variant) => {
      render(
        <Button variant={variant} data-testid="btn">
          X
        </Button>,
      );
      // We don't assert exact hex chains (brittle); just confirm there's
      // a visible background class of some kind.
      const btn = screen.getByTestId("btn");
      expect(btn.className).toMatch(/bg-/);
    },
  );

  it("forwards refs", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>X</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("fires onClick when enabled", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        Off
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
