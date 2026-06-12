"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useCreateInvite } from "@/lib/hooks/useCreateInvite";
import {
  createInviteInputSchema,
  type CreateInviteInput,
} from "@/lib/types/landlord/invite";

interface CreateInviteFormProps {
  // Undefined when the page is reached without a ?propertyId= (invites are
  // property-scoped, so the form shows a guidance notice in that case).
  propertyId?: string;
}

const BACK_LINK_CLASSES =
  "text-sm text-muted-text hover:text-primary-text transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:underline";

const SECONDARY_LINK_CLASSES =
  "inline-flex items-center h-10 px-4 rounded-md border border-border text-sm font-medium " +
  "text-primary-text hover:bg-background focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-primary transition-colors duration-150";

export default function CreateInviteForm({ propertyId }: CreateInviteFormProps) {
  const router = useRouter();
  const mutation = useCreateInvite();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateInviteInput>({
    resolver: zodResolver(createInviteInputSchema),
    defaultValues: {
      propertyId: propertyId ?? "",
      email: "",
      firstName: "",
      lastName: "",
      proposedStartDate: "",
      proposedEndDate: "",
      currency: "EUR",
    },
  });

  function onValid(values: CreateInviteInput): void {
    // Navigate only on success; the hook's own onSuccess (analytics + cache
    // invalidation) still runs. Failures surface via mutation.isError below —
    // no await/try-catch, so a rejected request never escapes unhandled.
    mutation.mutate(values, {
      onSuccess: () => router.push("/dashboard/invites"),
    });
  }

  if (!propertyId) {
    return (
      <div className="flex flex-col gap-6">
        <Link href="/dashboard/invites" className={BACK_LINK_CLASSES}>
          ← Invites
        </Link>
        <Card as="section">
          <h1 className="text-xl font-semibold text-primary-text">Invite a tenant</h1>
          <p className="text-sm text-muted-text mt-2 max-w-prose">
            Invitations are sent for a specific property. Open one of your properties
            and choose <span className="font-medium text-primary-text">Add lease</span>{" "}
            to invite a tenant.
          </p>
          <div className="mt-4">
            <Link href="/dashboard/properties" className={SECONDARY_LINK_CLASSES}>
              Go to Properties
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/invites" className={BACK_LINK_CLASSES}>
        ← Invites
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-primary-text">Invite a tenant</h1>
        <p className="text-sm text-muted-text mt-1 max-w-prose">
          Send a lease invitation. The tenant gets an email to review the proposed
          terms and accept — their account and lease are created only when they accept.
        </p>
      </div>

      <Card as="section">
        <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-5" noValidate>
          <input type="hidden" {...register("propertyId")} />

          <Input
            label="Tenant email"
            type="email"
            autoComplete="off"
            placeholder="tenant@example.com"
            error={errors.email?.message}
            {...register("email")}
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="First name"
              error={errors.firstName?.message}
              {...register("firstName")}
            />
            <Input
              label="Last name"
              error={errors.lastName?.message}
              {...register("lastName")}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Lease start"
              type="date"
              error={errors.proposedStartDate?.message}
              {...register("proposedStartDate")}
            />
            <Input
              label="Lease end"
              type="date"
              error={errors.proposedEndDate?.message}
              {...register("proposedEndDate")}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="Monthly rent"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="1200"
              error={errors.proposedMonthlyRent?.message}
              {...register("proposedMonthlyRent", { valueAsNumber: true })}
            />
            <Input
              label="Currency"
              maxLength={3}
              className="uppercase"
              hint="3-letter ISO code, e.g. EUR"
              error={errors.currency?.message}
              {...register("currency", {
                setValueAs: (v) => (typeof v === "string" ? v.toUpperCase() : v),
              })}
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-danger" role="alert">
              Could not send the invitation. Please try again.
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={mutation.isPending}>
              Send invitation
            </Button>
            <Link href="/dashboard/invites" className={SECONDARY_LINK_CLASSES}>
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
