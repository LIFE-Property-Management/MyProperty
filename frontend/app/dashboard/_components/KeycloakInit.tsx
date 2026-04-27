"use client"

import { useEffect } from "react"
import { initKeycloak } from "@/lib/auth/keycloak"

// Landlord-portal KeycloakInit. Kept separate from the tenant version
// (app/(tenant)/_components/KeycloakInit.tsx) so each portal can diverge
// independently when real Keycloak roles are wired per Decision 5 (Batch K).
export default function KeycloakInit() {
  useEffect(() => {
    initKeycloak()
  }, [])
  return null
}
