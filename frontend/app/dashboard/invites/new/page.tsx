import { z } from "zod";
import CreateInviteForm from "./_components/CreateInviteForm";

// Create-invite entry point. Property-scoped: the launching property's id arrives
// as ?propertyId= (set on the "Add lease" action in the property list/detail).
// Read server-side and handed to the client form; when absent the form renders a
// guidance notice instead (invites are always for a specific property).
//
// We validate the id's SHAPE here, not just its presence: a malformed ?propertyId=
// (not a UUID) would otherwise render the full form, only for the hidden
// propertyId field to fail z.uuid() on submit with no visible error — a dead
// form. Treat a malformed id like an absent one → the guidance card.
const propertyIdSchema = z.uuid();

export default async function NewInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const validPropertyId = propertyIdSchema.safeParse(propertyId).success ? propertyId : undefined;
  return <CreateInviteForm propertyId={validPropertyId} />;
}
