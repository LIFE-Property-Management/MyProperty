import axios from "axios";
import { getToken } from "@/lib/auth/keycloak";

// NEXT_PUBLIC_API_BASE_URL is read at build time; missing value is tolerated for scaffold-only dev.
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

export default apiClient;
