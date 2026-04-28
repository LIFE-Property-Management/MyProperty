import useTenantStore from "@/lib/store/useTenantStore";
import { resetTenantStore } from "@/test-utils/resetTenantStore";

beforeEach(() => {
  resetTenantStore();
});

describe("UiSlice", () => {
  it("has no active modal by default", () => {
    const state = useTenantStore.getState();
    expect(state.activeModal).toBeNull();
    expect(state.activePaymentId).toBeNull();
  });

  it("openModal sets both modal and paymentId atomically", () => {
    useTenantStore.getState().openModal("receiptUpload", "pay-123");
    const state = useTenantStore.getState();
    expect(state.activeModal).toBe("receiptUpload");
    expect(state.activePaymentId).toBe("pay-123");
  });

  it("openModal overwrites a previously open modal", () => {
    const { openModal } = useTenantStore.getState();
    openModal("receiptUpload", "pay-1");
    openModal("manualRequest", "pay-2");
    const state = useTenantStore.getState();
    expect(state.activeModal).toBe("manualRequest");
    expect(state.activePaymentId).toBe("pay-2");
  });

  it("closeModal clears both fields", () => {
    useTenantStore.getState().openModal("receiptUpload", "pay-123");
    useTenantStore.getState().closeModal();
    const state = useTenantStore.getState();
    expect(state.activeModal).toBeNull();
    expect(state.activePaymentId).toBeNull();
  });
});

describe("NotificationSlice", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("has an empty notifications queue by default", () => {
    expect(useTenantStore.getState().notifications).toEqual([]);
  });

  it("addNotification appends to the queue with a generated id", () => {
    useTenantStore.getState().addNotification({
      type: "success",
      message: "Saved",
      duration: 3000,
    });
    const notifications = useTenantStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "success",
      message: "Saved",
      duration: 3000,
    });
    expect(typeof notifications[0].id).toBe("string");
    expect(notifications[0].id.length).toBeGreaterThan(0);
  });

  it("addNotification produces unique ids across calls", () => {
    const { addNotification } = useTenantStore.getState();
    addNotification({ type: "info", message: "A", duration: 1000 });
    addNotification({ type: "info", message: "B", duration: 1000 });
    const ids = useTenantStore.getState().notifications.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("dismissNotification removes the matching id", () => {
    const { addNotification } = useTenantStore.getState();
    addNotification({ type: "info", message: "A", duration: 10_000 });
    addNotification({ type: "info", message: "B", duration: 10_000 });
    const [first, second] = useTenantStore.getState().notifications;
    useTenantStore.getState().dismissNotification(first.id);
    const remaining = useTenantStore.getState().notifications;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it("dismissNotification is idempotent (no throw on unknown id)", () => {
    expect(() =>
      useTenantStore.getState().dismissNotification("does-not-exist"),
    ).not.toThrow();
  });

  it("auto-dismisses a notification after its duration", () => {
    useTenantStore.getState().addNotification({
      type: "success",
      message: "Saved",
      duration: 2000,
    });
    expect(useTenantStore.getState().notifications).toHaveLength(1);
    jest.advanceTimersByTime(1999);
    expect(useTenantStore.getState().notifications).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(useTenantStore.getState().notifications).toHaveLength(0);
  });

  it("manual dismiss before timeout does not cause a second dismiss to error", () => {
    useTenantStore.getState().addNotification({
      type: "info",
      message: "A",
      duration: 2000,
    });
    const [item] = useTenantStore.getState().notifications;
    useTenantStore.getState().dismissNotification(item.id);
    // Timeout still fires later; must be idempotent.
    expect(() => jest.advanceTimersByTime(2000)).not.toThrow();
    expect(useTenantStore.getState().notifications).toHaveLength(0);
  });
});
