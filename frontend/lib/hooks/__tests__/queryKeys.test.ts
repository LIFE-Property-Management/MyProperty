import { queryKeys } from "../queryKeys";

describe("queryKeys", () => {
  it("tenant.all is a single-segment root key", () => {
    expect(queryKeys.tenant.all).toEqual(["tenant"]);
  });

  it("nests account under tenant", () => {
    expect(queryKeys.tenant.account()).toEqual(["tenant", "account"]);
  });

  it("nests lease under tenant", () => {
    expect(queryKeys.tenant.lease()).toEqual(["tenant", "lease"]);
  });

  it("payment.all sits under tenant", () => {
    expect(queryKeys.tenant.payment.all()).toEqual(["tenant", "payment"]);
  });

  it("payment.current is a leaf under payment.all", () => {
    expect(queryKeys.tenant.payment.current()).toEqual(["tenant", "payment", "current"]);
  });

  it("payment.history includes page + pageSize as the final scope object", () => {
    expect(queryKeys.tenant.payment.history(2, 10)).toEqual([
      "tenant",
      "payment",
      "history",
      { page: 2, pageSize: 10 },
    ]);
  });

  it("invalidating payment.all would match both current and history (shared prefix)", () => {
    const all = queryKeys.tenant.payment.all();
    const current = queryKeys.tenant.payment.current();
    const history = queryKeys.tenant.payment.history(1, 10);
    // React Query matches on prefix — simulate that with slice equality.
    expect(current.slice(0, all.length)).toEqual([...all]);
    expect(history.slice(0, all.length)).toEqual([...all]);
  });
});
