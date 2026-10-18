import { apiRequest } from "@/services/api-client";

export type OwnerCostHorseDto = {
  horseId: string;
  horseName: string;
  billedDays: number;
  dailyFee: number;
  caseCount: number;
  medicalCost: number;
  surcharge: number;
  total: number;
};
export type OwnerCostReportDto = {
  ownerId: string;
  ownerName: string;
  from: string;
  to: string;
  dailyFee: number;
  medicalCost: number;
  surcharge: number;
  total: number;
  prizeMoney: number;
  horses: OwnerCostHorseDto[];
};
export type ClubFinanceReportDto = {
  from: string;
  to: string;
  ownerCharges: { dailyFee: number; medicalCost: number; surcharge: number; total: number };
  supplies: { purchased: number; used: number };
  prizeMoney: number;
  owners: {
    ownerId: string;
    ownerName: string;
    dailyFee: number;
    medicalCost: number;
    surcharge: number;
    total: number;
  }[];
};

export const reportsService = {
  getClubFinance(token: string, from?: string, to?: string) {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const encodedQuery = query.toString();
    const suffix = encodedQuery ? `?${encodedQuery}` : "";
    return apiRequest<ClubFinanceReportDto>(`/reports/club/finance${suffix}`, { token });
  },
  getOwnerCosts(token: string, from?: string, to?: string, ownerId?: string) {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (ownerId) query.set("ownerId", ownerId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<OwnerCostReportDto>(`/reports/owner/costs${suffix}`, { token });
  },
};
