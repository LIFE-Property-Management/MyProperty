'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useLease, useAuth } from '@/lib/hooks';
import type { LeaseStatus } from '@/lib/types';

// Resolved once at module scope; 'en-US' fallback covers SSR/test environments.
const locale =
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string): string {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}

const STATUS_CLASSES: Record<LeaseStatus, string> = {
    Active: 'text-[#275D2C] dark:text-[#3fb950] font-medium',
    Expired: 'text-[#6b7280] dark:text-[#8b949e] font-medium',
    Terminated: 'text-[#931F1D] dark:text-[#f85149] font-medium',
};

export function LeaseSummaryCard() {
    const { isReadOnly, isMeLoading } = useAuth();
    const { data: lease, isLoading, isError } = useLease();

    if (isLoading || isMeLoading) {
        return (
            <Card padding="lg">
                <div className="min-h-[180px] flex items-center justify-center">
                    <Spinner size="md" />
                </div>
            </Card>
        );
    }

    // !lease after isLoading=false should not happen, but TS narrowing requires the branch.
    if (isError || !lease) {
        return (
            <Card padding="lg">
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] dark:text-[#f0f6fc]">
                    Lease
                </h2>
                <p className="mt-2 text-[#931F1D] dark:text-[#f85149] font-sans text-sm">
                    Could not load lease details. Please refresh the page.
                </p>
            </Card>
        );
    }

    const address = lease.unitNumber
        ? `${lease.propertyAddress}, Unit ${lease.unitNumber}`
        : lease.propertyAddress;

    const fields: { label: string; value: ReactNode }[] = [
        { label: 'Property Address', value: address },
        { label: 'Landlord', value: lease.landlordName },
        { label: 'Lease Start', value: formatDate(lease.startDate) },
        { label: 'Lease End', value: formatDate(lease.endDate) },
        { label: 'Monthly Rent', value: formatCurrency(lease.monthlyRent, lease.currency) },
        {
            label: 'Status',
            value: <span className={STATUS_CLASSES[lease.status]}>{lease.status}</span>,
        },
    ];

    return (
        <Card padding="lg">
            {isReadOnly && (
                <div
                    role="status"
                    aria-live="polite"
                    className="mb-4 rounded-md bg-[#fef3c7] dark:bg-[#78350f] px-4 py-3 text-sm text-[#92400e] dark:text-[#fef3c7] font-sans"
                >
                    Your account is in read-only mode. Your lease has ended.
                </div>
            )}

            <div>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] dark:text-[#f0f6fc]">
                    Lease Summary
                </h2>
                <p className="mt-1 font-sans text-sm text-[#6b7280] dark:text-[#8b949e]">
                    {lease.propertyName}
                </p>
            </div>

            <dl className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {fields.map((field) => (
                    <div key={field.label}>
                        <dt className="font-sans text-xs uppercase tracking-wide text-[#6b7280] dark:text-[#8b949e]">
                            {field.label}
                        </dt>
                        <dd className="mt-1 font-sans text-base text-[#111111] dark:text-[#f0f6fc]">
                            {field.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </Card>
    );
}
