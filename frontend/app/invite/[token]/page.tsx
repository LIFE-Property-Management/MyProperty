import { InviteWizard } from "./_components/InviteWizard";
import { mockInvitePreview } from "./_lib/invite";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const invite = mockInvitePreview(token);

  return (
    <main className="min-h-screen bg-background px-4 py-10 md:px-6 md:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <p className="text-sm text-muted-text">MyProperty</p>
          <h1 className="font-heading text-2xl text-primary-text md:text-3xl">Accept your invite</h1>
        </header>
        <InviteWizard invite={invite} />
      </div>
    </main>
  );
}
