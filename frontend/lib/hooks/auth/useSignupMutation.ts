import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
import type { SignupFormValues } from "@/lib/schemas/auth/signup";

export function useSignupMutation() {
    const router = useRouter();
    return useMutation({
        mutationFn: async (data: SignupFormValues) => {
            await apiClient.post(ENDPOINTS.registerLandlord, {
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone || null,
                password: data.password,
            });
        },
        onSuccess: () => {
            // Landlord activation funnel — step 2.
            capture(ANALYTICS_EVENTS.signupCompleted, { method: "email" });
            router.push("/login?registered=1");
        },
    });
}
