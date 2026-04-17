"use client";

import { useEffect } from "react";
import { initKeycloak } from "@/lib/auth/keycloak";

export default function KeycloakInit() {
  useEffect(() => {
    initKeycloak();
  }, []);

  return null;
}
