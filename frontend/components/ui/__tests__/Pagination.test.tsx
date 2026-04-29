import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination } from "../Pagination";

describe("Pagination", () => {
  it("returns null when totalCount <= pageSize", () => {
    const { container } = render(
      <Pagination page={1} totalCount={5} pageSize={10} onPageChange={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "Showing 1–10 of 18" for page=1, pageSize=10, totalCount=18', () => {
    render(
      <Pagination page={1} totalCount={18} pageSize={10} onPageChange={jest.fn()} />,
    );
    expect(screen.getByText("Showing 1–10 of 18")).toBeInTheDocument();
  });

  it('renders "Showing 11–18 of 18" for page=2, pageSize=10, totalCount=18', () => {
    render(
      <Pagination page={2} totalCount={18} pageSize={10} onPageChange={jest.fn()} />,
    );
    expect(screen.getByText("Showing 11–18 of 18")).toBeInTheDocument();
  });

  it("calls onPageChange(2) when page-2 button is clicked and current page is 1", () => {
    const onPageChange = jest.fn();
    render(
      <Pagination page={1} totalCount={18} pageSize={10} onPageChange={onPageChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("does not call onPageChange when the active page button is clicked", () => {
    const onPageChange = jest.fn();
    render(
      <Pagination page={1} totalCount={18} pageSize={10} onPageChange={onPageChange} />,
    );
    const activeButton = screen.getByRole("button", { name: "Page 1" });
    expect(activeButton).toBeDisabled();
    fireEvent.click(activeButton);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("renders at least one ellipsis when totalPages > 7", () => {
    render(
      <Pagination page={10} totalCount={200} pageSize={10} onPageChange={jest.fn()} />,
    );
    expect(screen.getAllByText("…").length).toBeGreaterThanOrEqual(1);
  });

  it("renders no ellipsis when totalPages <= 7", () => {
    render(
      <Pagination page={1} totalCount={70} pageSize={10} onPageChange={jest.fn()} />,
    );
    expect(screen.queryByText("…")).toBeNull();
  });
});
