import { InviteFlow } from "./_components/InviteFlow";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  // Next.js 16: route params are async. The token is the only thing the server
  // needs — the live preview + auth state are fetched client-side in InviteFlow
  // (the by-token endpoint is anonymous/per-visitor rate-limited, and the
  // three-case branching needs the browser-held Keycloak token).
  const { token } = await params;

  return (
    <main className="min-h-screen bg-background px-4 py-10 md:px-6 md:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <p className="text-sm text-muted-text">MyProperty</p>
          <h1 className="font-heading text-2xl text-primary-text md:text-3xl">Accept your invite</h1>
        </header>
        <InviteFlow token={token} />
      </div>
    </main>
  );
}
