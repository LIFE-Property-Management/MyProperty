import TenantDetailView from "./_components/TenantDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({ params }: Props) {
  const { id } = await params;
  return <TenantDetailView tenantId={id} />;
}
