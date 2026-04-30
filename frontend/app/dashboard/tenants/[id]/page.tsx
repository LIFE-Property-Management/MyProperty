interface Props {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div>
      <h1>Tenant Detail (TODO M3)</h1>
      <p>id: {id}</p>
    </div>
  );
}
