import { NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function GET() {
    const empty = { rentCollected: 0, propertiesManaged: 0, landlordsOnboarded: 0 };
    try {
        const res = await fetch(`${BACKEND}/api/v1/stats/public`, {
            next: { revalidate: 300 },
        });
        if (!res.ok) return NextResponse.json(empty);
        return NextResponse.json(await res.json());
    } catch {
        return NextResponse.json(empty);
    }
}
