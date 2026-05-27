"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import {
  propertiesResponseSchema,
  type PropertiesResponse,
} from "@/lib/types/landlord/property";

export function useLandlordProperties(page: number, pageSize: number) {
  return useQuery<PropertiesResponse>({
    queryKey: queryKeys.landlord.property.list(page, pageSize),
    queryFn: () =>
      apiClient
        .get(ENDPOINTS.landlordProperties, { params: { page, pageSize } })
        .then((r) => propertiesResponseSchema.parse(r.data)),
    placeholderData: (prev) => prev,
  });
}
