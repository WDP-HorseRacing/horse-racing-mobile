import type { MedicalCaseDto, MedicalDashboardDto } from "@/adapters/medical.adapter";
import { apiRequest } from "@/services/api-client";

export const medicalService = {
  getDashboard(token: string) {
    return apiRequest<MedicalDashboardDto>("/medical/dashboard", { token });
  },

  getCase(token: string, caseId: string) {
    return apiRequest<MedicalCaseDto>(`/medical-cases/${encodeURIComponent(caseId)}`, { token });
  },
};
