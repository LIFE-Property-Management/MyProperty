"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { useCreateProperty } from "@/lib/hooks/useCreateProperty";
import type { PropertyType } from "@/lib/types/landlord/property";

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
    { value: "House", label: "House" },
    { value: "Apartment", label: "Apartment" },
    { value: "Commercial", label: "Commercial" },
    { value: "Other", label: "Other" },
];

export default function NewPropertyPage() {
    const router = useRouter();
    const mutation = useCreateProperty();

    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [unitNumber, setUnitNumber] = useState("");
    const [propertyType, setPropertyType] = useState<PropertyType>("Apartment");
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const e: Record<string, string> = {};
        if (!name.trim()) e.name = "Property name is required.";
        else if (name.length > 256) e.name = "Max 256 characters.";
        if (!address.trim()) e.address = "Address is required.";
        else if (address.length > 512) e.address = "Max 512 characters.";
        if (unitNumber && unitNumber.length > 32) e.unitNumber = "Max 32 characters.";
        return e;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }
        setErrors({});

        const result = await mutation.mutateAsync({
            name: name.trim(),
            address: address.trim(),
            unitNumber: unitNumber.trim() || undefined,
            propertyType,
        });

        router.push(`/dashboard/properties/${result.id}`);
    };

    const inputClass = (field: string) =>
        `w-full px-3 py-2 rounded-lg border text-sm text-primary-text bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-150 ${
            errors[field] ? "border-danger" : "border-border"
        }`;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
                <Link
                    href="/dashboard/properties"
                    className="text-sm text-muted-text hover:text-primary-text transition-colors duration-150 focus-visible:outline-none focus-visible:underline"
                >
                    ← Properties
                </Link>
            </div>

            <div>
                <h1 className="text-xl font-semibold text-primary-text">Add Property</h1>
                <p className="text-sm text-muted-text mt-1">Fill in the details to add a new property.</p>
            </div>

            <Card as="section">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {/* Property Name */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-primary-text">
                            Property Name <span className="text-danger">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Maple Apartments 12"
                            className={inputClass("name")}
                        />
                        {errors.name && <p className="text-xs text-danger">{errors.name}</p>}
                    </div>

                    {/* Property Type */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-primary-text">Property Type</label>
                        <div className="flex gap-2 flex-wrap">
                            {PROPERTY_TYPES.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setPropertyType(t.value)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                        propertyType === t.value
                                            ? "bg-primary text-white border-primary"
                                            : "bg-surface text-primary-text border-border hover:bg-neutral-light"
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Address */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-primary-text">
                            Address <span className="text-danger">*</span>
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="e.g. Maple Street 12, Pristina"
                            className={inputClass("address")}
                        />
                        {errors.address && <p className="text-xs text-danger">{errors.address}</p>}
                    </div>

                    {/* Unit Number */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-primary-text">
                            Unit Number <span className="text-muted-text text-xs">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={unitNumber}
                            onChange={(e) => setUnitNumber(e.target.value)}
                            placeholder="e.g. A1, 3B"
                            className={inputClass("unitNumber")}
                        />
                        {errors.unitNumber && <p className="text-xs text-danger">{errors.unitNumber}</p>}
                    </div>

                    {/* Error from server */}
                    {mutation.isError && (
                        <p className="text-sm text-danger">
                            Failed to create property. Please try again.
                        </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-150 disabled:opacity-60"
                        >
                            {mutation.isPending ? "Adding…" : "Add Property"}
                        </button>
                        <Link
                            href="/dashboard/properties"
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
