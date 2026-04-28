import { create } from "zustand"
import { devtools } from "zustand/middleware"

export type DecodedPayload =
  | { portal: "tenant"; sub: string; email: string }
  | { portal: "landlord"; sub: string; email: string }
  | { portal: "admin"; sub: string; email: string }

interface AuthState {
  user: DecodedPayload | null
}

interface AuthActions {
  setAuth: (payload: DecodedPayload) => void
  clearAuth: () => void
}

export type AuthStore = AuthState & AuthActions

const useAuthStore = create<AuthStore>()(
  devtools(
    (set) => ({
      user: null,

      setAuth: (payload) => set({ user: payload }),

      clearAuth: () => set({ user: null }),
    }),
    { name: "AuthStore" },
  ),
)

export default useAuthStore
