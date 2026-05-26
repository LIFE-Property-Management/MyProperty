import { useMutation } from "@tanstack/react-query";
import type { SignupFormValues } from "@/lib/schemas/auth/signup";

// TODO(auth): landlord registration path is not yet decided.
// Backend has no public registration endpoint (CLAUDE.md: "Tenants cannot
// self-register"; landlord path TBD). Two likely options:
//   1. Add POST /api/v1/auth/register-landlord that provisions a Keycloak user
//      via the admin client + creates the User entity + assigns the Landlord role.
//   2. Redirect to Keycloak's own registration page and rely on a post-login
//      sync hook to create the User entity on first /me call.
// Tenants are NEVER allowed here — that flow lives in /invite/[token].
async function signupStub(): Promise<void> {
    await new Promise((r) => setTimeout(r, 1200));
    throw new Error("Registration is not yet implemented.");
}

export function useSignupMutation() {
    return useMutation<void, Error, SignupFormValues>({
        mutationFn: signupStub,
    });
}
