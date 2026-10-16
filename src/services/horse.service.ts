import type {
  CreateHorseInput,
  HorseDetailDto,
  HorseListItemDto,
  HorsePedigreeDto,
  HorseProfileResponseDto,
  HorseGenderDto,
  UpdateHorseInput,
} from "@/adapters/horse.adapter";
import { apiRequest } from "@/services/api-client";

type Page<T> = { items: T[]; meta: { totalPages: number } };

export type HorseListFilters = {
  healthStatus?: HorseHealthStatusDto;
  lifecycleStatus?: HorseLifecycleStatusDto;
  gender?: HorseGenderDto;
  raceAptitude?: HorseRaceAptitudeDto;
  barnId?: string;
  placementStatus?: HorsePlacementStatusDto;
  myBarns?: boolean;
  myHorses?: boolean;
  includeDeleted?: boolean;
};

export type HorseHealthStatusDto = "ELIGIBLE" | "UNDER_OBSERVATION" | "INJURED" | "QUARANTINED";
export type HorseLifecycleStatusDto = "ACTIVE" | "RETIRED" | "TRANSFERRED" | "DECEASED";
export type HorsePlacementStatusDto =
  "PENDING_BARN" | "PENDING_STALL" | "PLACED" | "NOT_APPLICABLE";
export type HorseRaceAptitudeDto = "SPRINTER" | "MILER" | "STAYER";

export type HorsePermissionsDto = {
  horseId: string;
  canEditProfile: boolean;
  canEditRaceAptitude: boolean;
  canAssignBarn: boolean;
  canAssignStallAndGroom: boolean;
  canChangeLifecycle: boolean;
  canDelete: boolean;
  canRestore: boolean;
  canChangeHealth: boolean;
  canRecordMeasurement: boolean;
  canDeleteMeasurement: boolean;
  canViewMedicalTab: boolean;
  canViewTrainingTab: boolean;
  canViewPerformanceTab: boolean;
};

export type HorseMeasurementDto = {
  id: string;
  horseId: string;
  type: "WEIGHT" | "HEIGHT" | "BODY_CONDITION" | "TEMPERATURE";
  value: number;
  unit: string;
  measuredAt: string;
  measuredBy: string;
  measuredByName: string;
  source: "MANUAL" | "MEDICAL_EXAM";
  isAbnormal: boolean;
};

export type HorseOwnershipDto = {
  id: string;
  owner: { id: string; fullName: string };
  startedAt: string;
  endedAt: string | null;
  reason: string | null;
  recordedBy: { id: string; fullName: string } | null;
};

export type HorseLifecyclePreviewDto = {
  horseId: string;
  from: HorseLifecycleStatusDto;
  to: HorseLifecycleStatusDto;
  allowed: boolean;
  blockedReason: string | null;
  classesWithdrawn: number;
  raceRegistrationsWithdrawn: number;
  stallReleased: string | null;
  groomEnded: string | null;
  barnCleared: string | null;
  trainingLockReleased: boolean;
  examRequestsDismissed: number;
  careSchedulesCancelled: number;
  incidentsClosed: number;
  healthResetTo: HorseHealthStatusDto | null;
  pendingBarnAfter: boolean;
  ownerCleared: string | null;
  summary: string | null;
};

export type HorseBarnPreviewDto = {
  horseId: string;
  allowed: boolean;
  blockedReason: string | null;
  fromBarnName: string | null;
  toBarnName: string;
  newHeadTrainerName: string | null;
  stallReleased: string | null;
  classesWithdrawn: number;
  groomKept: string | null;
  summary: string | null;
};

export type HorseDeletePreviewDto = {
  horseId: string;
  allowed: boolean;
  transferred: boolean;
  deceased: boolean;
  businessData: string[];
  isParent: boolean;
};

export type HorseRestorePreviewDto = {
  horseId: string;
  barnCleared: string | null;
  ownerCleared: string | null;
  summary: string;
};

export const horseService = {
  async list(
    token: string,
    search = "",
    filters: HorseListFilters = {},
  ): Promise<HorseListItemDto[]> {
    const horses: HorseListItemDto[] = [];
    let pageNumber = 1;
    let totalPages = 1;
    do {
      const query = new URLSearchParams({ page: String(pageNumber), limit: "100" });
      if (search.trim()) query.set("search", search.trim());
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== "") query.set(key, String(value));
      }
      const page = await apiRequest<Page<HorseListItemDto>>(`/horses?${query.toString()}`, {
        token,
      });
      horses.push(...(page.items ?? []));
      totalPages = page.meta?.totalPages ?? pageNumber;
      pageNumber += 1;
    } while (pageNumber <= totalPages);
    return horses;
  },

  get(token: string, horseId: string) {
    return apiRequest<HorseDetailDto>(`/horses/${encodeURIComponent(horseId)}`, { token });
  },

  getPermissions(token: string, horseId: string) {
    return apiRequest<HorsePermissionsDto>(`/horses/${encodeURIComponent(horseId)}/permissions`, {
      token,
    });
  },

  getPhotoUrl(token: string, horseId: string) {
    return apiRequest<{ url: string }>(`/horses/${encodeURIComponent(horseId)}/photo-url`, {
      token,
    });
  },

  create(token: string, input: CreateHorseInput) {
    return apiRequest<HorseProfileResponseDto>("/horses", { method: "POST", token, body: input });
  },

  update(token: string, horseId: string, input: UpdateHorseInput) {
    return apiRequest<HorseProfileResponseDto>(`/horses/${encodeURIComponent(horseId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },

  getPedigree(token: string, horseId: string) {
    return apiRequest<HorsePedigreeDto>(`/horses/${encodeURIComponent(horseId)}/pedigree`, {
      token,
    });
  },

  async listMeasurements(token: string, horseId: string): Promise<HorseMeasurementDto[]> {
    const rows: HorseMeasurementDto[] = [];
    let pageNumber = 1;
    let totalPages = 1;
    do {
      const query = new URLSearchParams({ page: String(pageNumber), limit: "500" });
      const page = await apiRequest<Page<HorseMeasurementDto>>(
        `/horses/${encodeURIComponent(horseId)}/measurements?${query.toString()}`,
        { token },
      );
      rows.push(...(page.items ?? []));
      totalPages = page.meta?.totalPages ?? pageNumber;
      pageNumber += 1;
    } while (pageNumber <= totalPages);
    return rows;
  },

  addMeasurements(
    token: string,
    horseId: string,
    input: {
      values: { type: HorseMeasurementDto["type"]; value: number }[];
      measuredAt?: string;
      confirmAbnormal?: boolean;
    },
  ) {
    return apiRequest<(HorseMeasurementDto & { alerts: { alert: string; severity: string }[] })[]>(
      `/horses/${encodeURIComponent(horseId)}/measurements`,
      { method: "POST", token, body: input },
    );
  },

  deleteMeasurement(token: string, horseId: string, measurementId: string, reason: string) {
    return apiRequest<void>(
      `/horses/${encodeURIComponent(horseId)}/measurements/${encodeURIComponent(measurementId)}`,
      { method: "DELETE", token, body: { reason } },
    );
  },

  listOwnerships(token: string, horseId: string) {
    return apiRequest<HorseOwnershipDto[]>(`/horses/${encodeURIComponent(horseId)}/ownerships`, {
      token,
    });
  },

  transferOwnership(
    token: string,
    horseId: string,
    input: { newOwnerId: string; reason: string; version: number },
  ) {
    return apiRequest<HorseProfileResponseDto>(
      `/horses/${encodeURIComponent(horseId)}/ownership-transfers`,
      { method: "POST", token, body: input },
    );
  },

  previewBarn(token: string, horseId: string, barnId: string) {
    const query = new URLSearchParams({ barnId });
    return apiRequest<HorseBarnPreviewDto>(
      `/horses/${encodeURIComponent(horseId)}/barn-preview?${query.toString()}`,
      { token },
    );
  },

  assignBarn(token: string, horseId: string, barnId: string, reason?: string) {
    return apiRequest<HorseProfileResponseDto>(`/horses/${encodeURIComponent(horseId)}/barn`, {
      method: "PUT",
      token,
      body: { barnId, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
    });
  },

  placeHorse(token: string, horseId: string, input: { stallId: string; groomId: string }) {
    return apiRequest<unknown>(`/horses/${encodeURIComponent(horseId)}/placement`, {
      method: "PUT",
      token,
      body: input,
    });
  },

  previewLifecycle(token: string, horseId: string, lifecycleStatus: HorseLifecycleStatusDto) {
    const query = new URLSearchParams({ lifecycleStatus });
    return apiRequest<HorseLifecyclePreviewDto>(
      `/horses/${encodeURIComponent(horseId)}/lifecycle-status/preview?${query.toString()}`,
      { token },
    );
  },

  changeLifecycle(
    token: string,
    horseId: string,
    input: {
      lifecycleStatus: HorseLifecycleStatusDto;
      reason: string;
      dateOfDeath?: string;
    },
  ) {
    return apiRequest<HorseProfileResponseDto>(
      `/horses/${encodeURIComponent(horseId)}/lifecycle-status`,
      {
        method: "PATCH",
        token,
        body: input,
      },
    );
  },

  previewDeletion(token: string, horseId: string) {
    return apiRequest<HorseDeletePreviewDto>(
      `/horses/${encodeURIComponent(horseId)}/deletion-preview`,
      { token },
    );
  },

  deleteHorse(token: string, horseId: string, reason: string) {
    return apiRequest<void>(`/horses/${encodeURIComponent(horseId)}`, {
      method: "DELETE",
      token,
      body: { reason },
    });
  },

  previewRestore(token: string, horseId: string) {
    return apiRequest<HorseRestorePreviewDto>(
      `/horses/${encodeURIComponent(horseId)}/restore-preview`,
      { token },
    );
  },

  restoreHorse(token: string, horseId: string, reason: string) {
    return apiRequest<HorseProfileResponseDto>(`/horses/${encodeURIComponent(horseId)}/restore`, {
      method: "POST",
      token,
      body: { reason },
    });
  },
};
