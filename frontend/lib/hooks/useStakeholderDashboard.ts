"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import {
  stakeholderDashboardSchema,
  type StakeholderDashboard,
} from "@/lib/types/admin/dashboard";

const EMPTY_DASHBOARD: StakeholderDashboard = {
  growth: {
    totalUsers: 0,
    landlords: 0,
    tenants: 0,
    newUsersThisMonth: 0,
    userGrowthTrend: [],
  },
  adoption: {
    totalProperties: 0,
    activeLeases: 0,
    occupancyRate: 0,
    leasesExpiringSoon: 0,
    newLeasesThisMonth: 0,
    leaseGrowthTrend: [],
  },
  inviteFunnel: {
    sent: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    pending: 0,
    acceptanceRate: 0,
    trend: [],
  },
  financial: {
    byCurrency: [],
    confirmationRate: 0,
    avgHoursToConfirm: 0,
    revenueTrend: [],
  },
  systemHealth: {
    failedEmailsTotal: 0,
    failedEmailsThisMonth: 0,
  },
  generatedAt: new Date().toISOString(),
};

export function useStakeholderDashboard() {
  return useQuery<StakeholderDashboard>({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: async () => {
      try {
        const r = await apiClient.get(ENDPOINTS.adminDashboard);
        const result = stakeholderDashboardSchema.safeParse(r.data);
        if (result.success) return result.data;
        console.warn("Stakeholder dashboard schema mismatch:", result.error);
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
