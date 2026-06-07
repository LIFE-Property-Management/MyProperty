"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import {
  landlordDashboardSchema,
  type LandlordDashboard,
} from "@/lib/types/landlord/dashboard";

const EMPTY_DASHBOARD: LandlordDashboard = {
  totalProperties: 0,
  activeLeases: 0,
  activeTenants: 0,
  pendingPayments: 0,
  overduePayments: 0,
  generatedAt: new Date().toISOString(),
};

export function useLandlordDashboard() {
  return useQuery<LandlordDashboard>({
    queryKey: queryKeys.landlord.dashboard(),
    queryFn: async () => {
      try {
        const r = await apiClient.get(ENDPOINTS.landlordDashboard);
        const result = landlordDashboardSchema.safeParse(r.data);
        if (result.success) return result.data;
        console.warn("Dashboard schema mismatch:", result.error);
        return EMPTY_DASHBOARD;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return EMPTY_DASHBOARD;
        }
        throw error;
      }
    },
  });
}
