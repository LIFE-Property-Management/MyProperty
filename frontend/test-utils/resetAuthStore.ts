import useAuthStore from "@/lib/store/auth/useAuthStore"

export function resetAuthStore() {
  useAuthStore.setState({ user: null })
}
