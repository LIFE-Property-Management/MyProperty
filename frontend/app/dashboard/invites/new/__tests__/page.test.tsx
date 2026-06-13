import { render, screen } from "@testing-library/react";
import NewInvitePage from "../page";

// The page's job is to validate the ?propertyId= SHAPE before handing it to the
// form: a valid UUID passes through; an absent OR malformed id becomes undefined
// so the form shows its guidance card instead of a dead, un-submittable form.
// CreateInviteForm is stubbed to echo the prop it receives.
jest.mock("../_components/CreateInviteForm", () => {
  const Stub = ({ propertyId }: { propertyId?: string }) => (
    <div data-testid="form">propertyId={propertyId ?? "undefined"}</div>
  );
  Stub.displayName = "CreateInviteFormStub";
  return Stub;
});

const VALID = "02900000-0000-7000-8000-000000000001";

async function renderPage(searchParams: { propertyId?: string }) {
  render(await NewInvitePage({ searchParams: Promise.resolve(searchParams) }));
}

describe("NewInvitePage propertyId boundary", () => {
  it("passes a valid UUID through to the form", async () => {
    await renderPage({ propertyId: VALID });
    expect(screen.getByTestId("form")).toHaveTextContent(`propertyId=${VALID}`);
  });

  it("drops a malformed propertyId to undefined", async () => {
    await renderPage({ propertyId: "not-a-uuid" });
    expect(screen.getByTestId("form")).toHaveTextContent("propertyId=undefined");
  });

  it("passes undefined when propertyId is absent", async () => {
    await renderPage({});
    expect(screen.getByTestId("form")).toHaveTextContent("propertyId=undefined");
  });
});
