import { apiRequest } from "@/services/api-client";

export type DailyFeeDto = {
  id: string;
  effectiveFrom: string;
  dailyFee: number;
  createdBy: string;
  createdAt: string;
};

export const billingService = {
  listDailyFees(token: string) {
    return apiRequest<DailyFeeDto[]>("/daily-fees", { token });
  },

  createDailyFee(token: string, input: { effectiveFrom: string; dailyFee: number }) {
    return apiRequest<DailyFeeDto>("/daily-fees", { method: "POST", token, body: input });
  },

  updateDailyFee(token: string, id: string, input: { dailyFee: number; reason: string }) {
    return apiRequest<DailyFeeDto>(`/daily-fees/${encodeURIComponent(id)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },

  deleteDailyFee(token: string, id: string) {
    return apiRequest<void>(`/daily-fees/${encodeURIComponent(id)}`, { method: "DELETE", token });
  },
};
