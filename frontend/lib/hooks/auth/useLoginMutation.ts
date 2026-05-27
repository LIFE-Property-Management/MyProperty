import { useMutation } from "@tanstack/react-query";
import type { LoginFormValues } from "@/lib/schemas/auth/login";

// TODO(auth): wire to Keycloak login or backend /api/v1/auth/login.
// Currently no public endpoint exists. When ready:
//   - Call the backend, exchange for Keycloak token, or redirect to Keycloak.
//   - Decode JWT and call useAuthStore.getState().setAuth(payload).
//   - Redirect to /dashboard (landlord) or /tenant/dashboard (tenant) based on role.
async function loginStub(): Promise<void> {
    await new Promise((r) => setTimeout(r, 1200));
    throw new Error("Authentication is not yet implemented.");
}

export function useLoginMutation() {
    return useMutation<void, Error, LoginFormValues>({
        mutationFn: loginStub,
    });
}
