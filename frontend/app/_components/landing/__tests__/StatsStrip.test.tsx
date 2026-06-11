import { render, screen } from "@testing-library/react";
import StatsStrip from "../StatsStrip";

// StatsStrip is an async Server Component that fetches the public stats. We mock
// global.fetch and the backend env var, await the component, then render the
// returned element.
const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://backend.test";
});

afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    process.env.NEXT_PUBLIC_API_BASE_URL = ORIGINAL_BASE_URL;
    jest.clearAllMocks();
});

describe("<StatsStrip /> (server component)", () => {
    it("renders formatted stats from the backend response", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                rentCollected: 1500,
                currency: "EUR",
                propertiesManaged: 3,
                landlordsOnboarded: 2,
            }),
        }) as unknown as typeof fetch;

        render(await StatsStrip());

        expect(screen.getByTestId("stat-rent")).toHaveTextContent("€1.5K");
        expect(screen.getByTestId("stat-properties")).toHaveTextContent("3");
        expect(screen.getByTestId("stat-landlords")).toHaveTextContent("2");
    });

    it("falls back to zeros when the response is not ok", async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

        render(await StatsStrip());

        expect(screen.getByTestId("stat-rent")).toHaveTextContent("0");
        expect(screen.getByTestId("stat-properties")).toHaveTextContent("0");
        expect(screen.getByTestId("stat-landlords")).toHaveTextContent("0");
    });

    it("falls back to zeros when the fetch throws", async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

        render(await StatsStrip());

        expect(screen.getByTestId("stat-rent")).toHaveTextContent("0");
    });

    it("falls back to zeros when the payload fails schema validation", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ rentCollected: "not-a-number", currency: 42 }),
        }) as unknown as typeof fetch;

        render(await StatsStrip());

        expect(screen.getByTestId("stat-rent")).toHaveTextContent("0");
        expect(screen.getByTestId("stat-properties")).toHaveTextContent("0");
    });
});
