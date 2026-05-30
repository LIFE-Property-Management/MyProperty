import axios from "axios";
import { getToken } from "@/lib/auth/keycloak";
import { requirePublicEnv } from "@/lib/utils/env";

// NEXT_PUBLIC_API_BASE_URL is baked into the bundle at build time.
// In dev it's intentionally unset so axios uses relative URLs and MSW can intercept.
// In production builds, requirePublicEnv throws if it's missing.
const base = requirePublicEnv("NEXT_PUBLIC_API_BASE_URL");
// Backend controllers are versioned under /api/v1. Endpoints in endpoints.ts are
// intentionally prefix-less so MSW can intercept relative paths in dev (base is unset).
// For real deploys, prepend the version segment once here.
const baseURL = base ? `${base}/api/v1` : base;

const apiClient = axios.create({
    baseURL,
});

apiClient.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
});

export default apiClient;
