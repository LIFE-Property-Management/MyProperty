import CreateInviteForm from "./_components/CreateInviteForm";

// Create-invite entry point. Property-scoped: the launching property's id arrives
// as ?propertyId= (set on the "Add lease" action in the property list/detail).
// Read server-side and handed to the client form; when absent the form renders a
// guidance notice instead (invites are always for a specific property).
export default async function NewInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  return <CreateInviteForm propertyId={propertyId} />;
}
