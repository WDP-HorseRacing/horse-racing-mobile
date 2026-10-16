import { apiRequest } from "@/services/api-client";

export type BarnListItemDto = {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  status: string;
  headTrainerId: string | null;
  headTrainerFullName: string | null;
  hasActiveHeadTrainer: boolean;
  availableStallCount: number;
  pendingStallHorseCount: number;
};

export type StallDto = {
  id: string;
  barnId: string;
  code: string;
  type: string;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | string;
  description: string | null;
  hasCamera: boolean;
};

export type GroomWorkloadDto = {
  groomId: string;
  fullName: string;
  activeHorseCount: number;
};

export const stableService = {
  listBarns(token: string) {
    return apiRequest<BarnListItemDto[]>("/barns", { token });
  },

  listStalls(token: string) {
    return apiRequest<StallDto[]>("/stalls", { token });
  },

  listBarnStalls(token: string, barnId: string) {
    const query = new URLSearchParams({ barnId });
    return apiRequest<StallDto[]>(`/stalls?${query.toString()}`, { token });
  },

  listGroomWorkload(token: string) {
    return apiRequest<GroomWorkloadDto[]>("/grooms/workload", { token });
  },
};
