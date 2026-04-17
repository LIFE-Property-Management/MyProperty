describe("jest wiring", () => {
  it("runs a trivial assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("has jest-dom matchers loaded", () => {
    const node = document.createElement("div");
    node.textContent = "hello";
    expect(node).toHaveTextContent("hello");
  });

  it("resolves @/ path alias", async () => {
    const mod = await import("@/lib/types/enums");
    expect(mod.paymentStatusSchema.parse("Outstanding")).toBe("Outstanding");
  });
});
