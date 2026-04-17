import { render, screen, within } from "@testing-library/react";
import { DataTable, type Column } from "../DataTable";

interface Row {
  id: string;
  name: string;
  amount: number;
}

const columns: Column<Row>[] = [
  { header: "Name", cell: (r) => r.name },
  { header: "Amount", cell: (r) => `€${r.amount}` },
];

const rows: Row[] = [
  { id: "1", name: "Rent", amount: 400 },
  { id: "2", name: "Deposit", amount: 800 },
];

describe("<DataTable /> (shared)", () => {
  it("renders column headers with scope='col'", () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    headers.forEach((h) => expect(h).toHaveAttribute("scope", "col"));
  });

  it("renders one row per entry", () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    const dataRows = screen.getAllByRole("row").slice(1); // skip the header row
    expect(dataRows).toHaveLength(2);
    expect(within(dataRows[0]).getByText("Rent")).toBeInTheDocument();
    expect(within(dataRows[1]).getByText("€800")).toBeInTheDocument();
  });

  it("shows the default empty message when rows=[]", () => {
    render(<DataTable columns={columns} rows={[]} getRowKey={(r) => r.id} />);
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  it("shows a custom empty message", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(r) => r.id}
        empty="No payments yet"
      />,
    );
    expect(screen.getByText("No payments yet")).toBeInTheDocument();
  });

  it("uses getRowKey for react keys (indirectly: renders without warnings)", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
