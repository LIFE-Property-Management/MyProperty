"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import {
  landlordDashboardSchema,
  type LandlordDashboard,
} from "@/lib/types/landlord/dashboard";

export function useLandlordDashboard() {
  return useQuery<LandlordDashboard>({
    queryKey: queryKeys.landlord.dashboard(),
    queryFn: () =>
      apiClient
        .get(ENDPOINTS.landlordDashboard)
        .then((r) => landlordDashboardSchema.parse(r.data)),
  });
}
