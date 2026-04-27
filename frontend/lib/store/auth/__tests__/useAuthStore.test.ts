import useAuthStore from "@/lib/store/auth/useAuthStore"
import { resetAuthStore } from "@/test-utils/resetAuthStore"

beforeEach(() => {
  resetAuthStore()
})

describe("AuthStore", () => {
  it("has null user by default", () => {
    expect(useAuthStore.getState().user).toBeNull()
  })

  it("setAuth with tenant payload sets portal, sub, email", () => {
    useAuthStore.getState().setAuth({ portal: "tenant", sub: "sub-1", email: "tenant@dev.local" })
    const { user } = useAuthStore.getState()
    expect(user?.portal).toBe("tenant")
    expect(user?.sub).toBe("sub-1")
    expect(user?.email).toBe("tenant@dev.local")
  })

  it("setAuth with landlord payload sets portal to landlord", () => {
    useAuthStore.getState().setAuth({ portal: "landlord", sub: "sub-2", email: "landlord@dev.local" })
    expect(useAuthStore.getState().user?.portal).toBe("landlord")
  })

  it("setAuth with admin payload sets portal to admin", () => {
    useAuthStore.getState().setAuth({ portal: "admin", sub: "sub-3", email: "admin@dev.local" })
    expect(useAuthStore.getState().user?.portal).toBe("admin")
  })

  it("clearAuth sets user to null", () => {
    useAuthStore.getState().setAuth({ portal: "tenant", sub: "sub-1", email: "tenant@dev.local" })
    useAuthStore.getState().clearAuth()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it("clearAuth after setAuth is idempotent", () => {
    useAuthStore.getState().setAuth({ portal: "tenant", sub: "sub-1", email: "tenant@dev.local" })
    expect(() => {
      useAuthStore.getState().clearAuth()
      useAuthStore.getState().clearAuth()
    }).not.toThrow()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
