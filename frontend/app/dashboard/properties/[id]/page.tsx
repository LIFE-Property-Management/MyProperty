import PropertyDetailView from "./_components/PropertyDetailView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params;
  return <PropertyDetailView propertyId={id} />;
}
