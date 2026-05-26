import axios from "axios";
import { getToken } from "@/lib/auth/keycloak";
import { requirePublicEnv } from "@/lib/utils/env";

// NEXT_PUBLIC_API_BASE_URL is baked into the bundle at build time.
// In dev it's intentionally unset so axios uses relative URLs and MSW can intercept.
// In production builds, requirePublicEnv throws if it's missing.
const baseURL = requirePublicEnv("NEXT_PUBLIC_API_BASE_URL");

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
