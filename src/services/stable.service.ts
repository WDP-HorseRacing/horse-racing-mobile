import { apiRequest } from "@/services/api-client";

export type BarnResponseDto = {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  status: string;
  headTrainerId: string | null;
};

export type BarnListItemDto = BarnResponseDto & {
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

export type CreateBarnInput = {
  name: string;
  description?: string;
  capacity?: number;
  status?: string;
};

export type UpdateBarnInput = {
  name?: string;
  description?: string;
  capacity?: number;
  headTrainerId?: string | null;
  status?: string;
};

export type CreateStallInput = {
  barnId: string;
  code: string;
  type?: string;
  description?: string;
  hasCamera?: boolean;
};

export type UpdateStallInput = {
  code?: string;
  type?: string;
  description?: string;
  hasCamera?: boolean;
  status?: string;
};

export const stableService = {
  listBarns(token: string) {
    return apiRequest<BarnListItemDto[]>("/barns", { token });
  },

  createBarn(token: string, input: CreateBarnInput) {
    return apiRequest<BarnResponseDto>("/barns", {
      method: "POST",
      token,
      body: input,
    });
  },

  updateBarn(token: string, barnId: string, input: UpdateBarnInput) {
    return apiRequest<BarnResponseDto>(`/barns/${encodeURIComponent(barnId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },

  deleteBarn(token: string, barnId: string) {
    return apiRequest<void>(`/barns/${encodeURIComponent(barnId)}`, {
      method: "DELETE",
      token,
    });
  },

  listStalls(token: string) {
    return apiRequest<StallDto[]>("/stalls", { token });
  },

  listBarnStalls(token: string, barnId: string) {
    const query = new URLSearchParams({ barnId });
    return apiRequest<StallDto[]>(`/stalls?${query.toString()}`, { token });
  },

  createStall(token: string, input: CreateStallInput) {
    return apiRequest<StallDto>("/stalls", {
      method: "POST",
      token,
      body: input,
    });
  },

  updateStall(token: string, stallId: string, input: UpdateStallInput) {
    return apiRequest<StallDto>(`/stalls/${encodeURIComponent(stallId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },

  deleteStall(token: string, stallId: string) {
    return apiRequest<void>(`/stalls/${encodeURIComponent(stallId)}`, {
      method: "DELETE",
      token,
    });
  },

  listGroomWorkload(token: string) {
    return apiRequest<GroomWorkloadDto[]>("/grooms/workload", { token });
  },
};
