"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import { propertyDetailSchema, type PropertyDetail } from "@/lib/types/landlord/property";

export function useLandlordPropertyDetail(id: string) {
  return useQuery<PropertyDetail>({
    queryKey: queryKeys.landlord.property.detail(id),
    queryFn: () =>
      apiClient
        .get(ENDPOINTS.propertyById(id))
        .then((r) => propertyDetailSchema.parse(r.data)),
    enabled: !!id,
  });
}
