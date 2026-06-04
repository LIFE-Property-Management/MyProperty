"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { useCreateInvite } from "@/lib/hooks/useCreateInvite";

interface Props {
    params: Promise<{ id: string }>;
}

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "ALL"];
const TODAY = new Date().toISOString().split("T")[0];

export default function InviteTenantPage({ params }: Props) {
    const { id: propertyId } = use(params);
    const router = useRouter();
    const mutation = useCreateInvite();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [monthlyRent, setMonthlyRent] = useState("");
    const [currency, setCurrency] = useState("EUR");
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const e: Record<string, string> = {};
        if (!firstName.trim()) e.firstName = "First name is required.";
        if (!lastName.trim()) e.lastName = "Last name is required.";
        if (!email.trim()) e.email = "Email is required.";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email.";
        if (!startDate) e.startDate = "Start date is required.";
        else if (startDate < TODAY) e.startDate = "Start date cannot be in the past.";
        if (!endDate) e.endDate = "End date is required.";
        else if (endDate <= startDate) e.endDate = "End date must be after start date.";
        if (!monthlyRent) e.monthlyRent = "Monthly rent is required.";
        else if (isNaN(Number(monthlyRent)) || Number(monthlyRent) <= 0) e.monthlyRent = "Enter a valid amount.";
        return e;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }
        setErrors({});

        await mutation.mutateAsync({
            propertyId,
            email: email.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            proposedStartDate: startDate,
            proposedEndDate: endDate,
            proposedMonthlyRent: Number(monthlyRent),
            currency,
        });

        router.push(`/dashboard/properties/${propertyId}`);
    };

    const inputClass = (field: string) =>
        `w-full px-3 py-2 rounded-lg border text-sm text-primary-text bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-150 ${
            errors[field] ? "border-danger" : "border-border"
        }`;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Link
                    href={`/dashboard/properties/${propertyId}`}
                    className="text-sm text-muted-text hover:text-primary-text transition-colors duration-150 focus-visible:outline-none focus-visible:underline"
                >
                    ← Property
                </Link>
            </div>

            <div>
                <h1 className="text-xl font-semibold text-primary-text">Invite Tenant</h1>
                <p className="text-sm text-muted-text mt-1">
                    Send an invite email to your tenant. They will receive a link to create their account and accept the lease.
                </p>
            </div>

            <Card as="section">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {/* Tenant Info */}
                    <div>
                        <h2 className="text-sm font-medium text-muted-text mb-3">Tenant details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-primary-text">First Name <span className="text-danger">*</span></label>
                                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className={inputClass("firstName")} />
                                {errors.firstName && <p className="text-xs text-danger">{errors.firstName}</p>}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-primary-text">Last Name <span className="text-danger">*</span></label>
                                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" className={inputClass("lastName")} />
                                {errors.lastName && <p className="text-xs text-danger">{errors.lastName}</p>}
                            </div>
                            <div className="flex flex-col gap-1.5 md:col-span-2">
                                <label className="text-sm font-medium text-primary-text">Email Address <span className="text-danger">*</span></label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john.smith@example.com" className={inputClass("email")} />
                                {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Lease Terms */}
                    <div>
                        <h2 className="text-sm font-medium text-muted-text mb-3">Proposed lease terms</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-primary-text">Start Date <span className="text-danger">*</span></label>
                                <input type="date" value={startDate} min={TODAY} onChange={(e) => setStartDate(e.target.value)} className={inputClass("startDate")} />
                                {errors.startDate && <p className="text-xs text-danger">{errors.startDate}</p>}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-primary-text">End Date <span className="text-danger">*</span></label>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass("endDate")} />
                                {errors.endDate && <p className="text-xs text-danger">{errors.endDate}</p>}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-primary-text">Monthly Rent <span className="text-danger">*</span></label>
                                <input type="number" min="0" step="0.01" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} placeholder="500" className={inputClass("monthlyRent")} />
                                {errors.monthlyRent && <p className="text-xs text-danger">{errors.monthlyRent}</p>}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-primary-text">Currency</label>
                                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass("currency")}>
                                    {CURRENCIES.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {mutation.isError && (
                        <p className="text-sm text-danger">Failed to send invite. Please try again.</p>
                    )}

                    {mutation.isSuccess && (
                        <p className="text-sm text-primary">Invite sent successfully! Redirecting…</p>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-150 disabled:opacity-60"
                        >
                            {mutation.isPending ? "Sending…" : "Send Invite"}
                        </button>
                        <Link
                            href={`/dashboard/properties/${propertyId}`}
                            className="px-6 py-2 rounded-lg border border-border text-sm font-medium text-primary-text hover:bg-neutral-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-150"
                        >
                            Cancel
                        </Link>
                    </div>
                </form>
            </Card>
        </div>
    );
}
