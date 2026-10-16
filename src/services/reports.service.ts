import { apiRequest } from "@/services/api-client";

export const reportsService = {
  getClubFinance(token: string, from?: string, to?: string) {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const encodedQuery = query.toString();
    const suffix = encodedQuery ? `?${encodedQuery}` : "";
    return apiRequest<unknown>(`/reports/club/finance${suffix}`, { token });
  },
};
