import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface SuccessStepProps {
  email: string;
}

export function SuccessStep({ email }: SuccessStepProps) {
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-light">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6 fill-none stroke-primary"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l4 4L19 7" />
        </svg>
      </div>
      <h2 className="font-heading text-xl text-primary-text">You&apos;re all set</h2>
      <p className="text-sm text-muted-text">
        Your lease is accepted and your account is ready. We&apos;ve sent a confirmation to{" "}
        <strong className="text-primary-text">{email}</strong>. Sign in to your tenant portal to
        manage your tenancy.
      </p>
      <Link href="/">
        <Button variant="primary">Back to home</Button>
      </Link>
    </div>
  );
}
