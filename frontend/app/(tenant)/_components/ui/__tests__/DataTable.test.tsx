import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable, type Column } from "../DataTable";

interface Row {
  id: string;
  name: string;
  amount: number;
}

const columns: Column<Row>[] = [
  { key: "name", header: "Name", accessor: (r) => r.name },
  { key: "amount", header: "Amount", accessor: (r) => `€${r.amount}`, align: "right" },
];

const rows: Row[] = [
  { id: "1", name: "Rent", amount: 400 },
  { id: "2", name: "Deposit", amount: 800 },
];

describe("<DataTable /> (tenant)", () => {
  it("renders columns with scope='col'", () => {
    render(<DataTable columns={columns} data={rows} getRowKey={(r) => r.id} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    headers.forEach((h) => expect(h).toHaveAttribute("scope", "col"));
  });

  it("renders rows and cells", () => {
    render(<DataTable columns={columns} data={rows} getRowKey={(r) => r.id} />);
    const body = screen.getAllByRole("row").slice(1);
    expect(body).toHaveLength(2);
    expect(within(body[0]).getByText("Rent")).toBeInTheDocument();
    expect(within(body[1]).getByText("€800")).toBeInTheDocument();
  });

  it("shows a loading spinner when isLoading", () => {
    render(<DataTable columns={columns} data={[]} isLoading getRowKey={(r) => r.id} />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders the default empty message when data=[]", () => {
    render(<DataTable columns={columns} data={[]} getRowKey={(r) => r.id} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders a custom emptyMessage", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        getRowKey={(r) => r.id}
        emptyMessage="No payments yet."
      />,
    );
    expect(screen.getByText("No payments yet.")).toBeInTheDocument();
  });

  it("rows become role='button' and are keyboard-activatable when onRowClick is provided", async () => {
    const onRowClick = jest.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    const clickableRows = screen.getAllByRole("button");
    expect(clickableRows).toHaveLength(rows.length);
    expect(clickableRows[0]).toHaveAttribute("tabindex", "0");

    await userEvent.click(clickableRows[0]);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);

    clickableRows[1].focus();
    await userEvent.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);

    clickableRows[0].focus();
    await userEvent.keyboard(" ");
    expect(onRowClick).toHaveBeenCalledTimes(3);
  });

  it("rows are NOT keyboard-activatable when onRowClick is omitted", () => {
    render(<DataTable columns={columns} data={rows} getRowKey={(r) => r.id} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders a caption in sr-only class for a11y", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(r) => r.id}
        caption="Payment history"
      />,
    );
    const caption = container.querySelector("caption");
    expect(caption).toBeTruthy();
    expect(caption).toHaveClass("sr-only");
    expect(caption).toHaveTextContent("Payment history");
  });
});
