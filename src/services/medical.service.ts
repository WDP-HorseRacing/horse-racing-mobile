import type {
  CareScheduleDto,
  ExamRequestDto,
  InjuryTimelineItemDto,
  MedicalCaseClosePreviewDto,
  MedicalCaseDto,
  MedicalCaseSummaryDto,
  MedicalCostReportDto,
  MedicalDashboardDto,
  MedicalRecordDto,
  PageDto,
  TrainingLockDto,
} from "@/adapters/medical.adapter";
import { apiRequest } from "@/services/api-client";
import type {
  InjuryBodyRegion,
  InjuryRecoveryStatus,
  InjuryType,
} from "@/features/medical/injury-mapper/injury-mapper.types";

export type HealthStatusDto = "ELIGIBLE" | "UNDER_OBSERVATION" | "INJURED" | "QUARANTINED";
export type MeasurementTypeDto = "WEIGHT" | "HEIGHT" | "BODY_CONDITION" | "TEMPERATURE";
export type VisitKindDto = "ROUTINE" | "REQUEST" | "FOLLOW_UP";
export type VisitConclusionDto = "NORMAL" | "ISSUE";
export type CareTaskTypeDto = "VACCINATION" | "DEWORMING" | "FARRIER";

export type VisitInputDto = {
  requestIds?: string[];
  diagnosis?: string;
  healthStatus?: HealthStatusDto;
  healthReason?: string;
  careInstructions?: string;
  nextVisitAt?: string;
  measurements?: { type: MeasurementTypeDto; value: number }[];
  confirmAbnormal?: boolean;
  prescriptions?: {
    medicine: string;
    dosage: string;
    frequency: string;
    startDate: string;
    endDate?: string;
  }[];
  injuryUpdates?: {
    injuryId: string;
    recoveryStatus: InjuryRecoveryStatus;
    notes?: string;
  }[];
  newInjuries?: {
    bodyRegion: InjuryBodyRegion;
    position: { x: number; y: number; z: number };
    injuryType: InjuryType;
    recoveryStatus: InjuryRecoveryStatus;
    notes?: string;
  }[];
  replacesRecordId?: string;
};

export type MedicalRecordEditInputDto = {
  reason: string;
  diagnosis?: string | null;
  careInstructions?: string | null;
  nextVisitAt?: string | null;
  healthStatus?: HealthStatusDto;
  measurements?: { type: MeasurementTypeDto; value: number }[];
  confirmAbnormal?: boolean;
  prescriptions?: {
    medicine: string;
    dosage?: string;
    frequency?: string;
    startDate: string;
    endDate?: string;
  }[];
  injuries?: {
    injuryId: string;
    recoveryStatus?: InjuryRecoveryStatus;
    notes?: string | null;
    bodyRegion?: InjuryBodyRegion;
    injuryType?: InjuryType;
    position?: { x: number; y: number; z: number };
  }[];
  removedInjuryIds?: string[];
  kind?: "ROUTINE" | "REQUEST";
  requestIds?: string[];
  conclusion?: VisitConclusionDto;
  initialDiagnosis?: string;
};

export type StandaloneVisitInputDto = VisitInputDto & {
  kind: "ROUTINE" | "REQUEST";
  conclusion: VisitConclusionDto;
  initialDiagnosis?: string;
};

export type CaseCloseInputDto = {
  finalConclusion: string;
  lockDecision?: "RELEASE" | "KEEP";
  lockExpectedEnd?: string;
  deceased?: boolean;
};

export type MedicalDashboardFilters = {
  barnId?: string;
  healthStatus?: HealthStatusDto;
  careAssignee?: "me";
  mine?: boolean;
};
export type ExamRequestFilters = {
  page?: number;
  limit?: number;
  status?: "PENDING" | "EXAMINED" | "DISMISSED";
  urgent?: boolean;
};

export const medicalService = {
  getDashboard(token: string, filters: MedicalDashboardFilters = {}) {
    const query = new URLSearchParams();
    if (filters.barnId) query.set("barnId", filters.barnId);
    if (filters.healthStatus) query.set("healthStatus", filters.healthStatus);
    if (filters.careAssignee) query.set("careAssignee", filters.careAssignee);
    if (filters.mine !== undefined) query.set("mine", String(filters.mine));
    const suffix = query.size ? `?${query.toString()}` : "";
    return apiRequest<MedicalDashboardDto>(`/medical/dashboard${suffix}`, { token });
  },

  listCheckups(token: string, filters: { barnId?: string; status?: "DUE_SOON" | "OVERDUE" } = {}) {
    const query = new URLSearchParams();
    if (filters.barnId) query.set("barnId", filters.barnId);
    if (filters.status) query.set("status", filters.status);
    const suffix = query.size ? `?${query.toString()}` : "";
    return apiRequest<MedicalDashboardDto["checkups"]>(`/medical/checkups${suffix}`, { token });
  },

  setCheckupAppointment(
    token: string,
    horseId: string,
    input: { scheduledAt: string; reason?: string },
  ) {
    return apiRequest<{ id: string; horseId: string; scheduledAt: string }>(
      `/horses/${encodeURIComponent(horseId)}/checkup-appointment`,
      { method: "PUT", token, body: input },
    );
  },

  cancelCheckupAppointment(token: string, horseId: string, reason: string) {
    return apiRequest<void>(
      `/horses/${encodeURIComponent(horseId)}/checkup-appointment`,
      { method: "DELETE", token, body: { reason } },
    );
  },

  getCase(token: string, caseId: string) {
    return apiRequest<MedicalCaseDto>(`/medical-cases/${encodeURIComponent(caseId)}`, { token });
  },

  listAllCases(token: string, status?: "OPEN" | "CLOSED") {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest<MedicalCaseSummaryDto[]>(`/medical-cases${query}`, { token });
  },

  listHorseCases(token: string, horseId: string) {
    return apiRequest<{ items: MedicalCaseSummaryDto[]; totalCost?: number }>(
      `/horses/${encodeURIComponent(horseId)}/medical-cases`,
      { token },
    );
  },

  listHorseRecords(token: string, horseId: string) {
    return apiRequest<MedicalRecordDto[]>(
      `/horses/${encodeURIComponent(horseId)}/medical-records`,
      { token },
    );
  },

  getRecord(token: string, recordId: string) {
    return apiRequest<MedicalRecordDto>(`/medical-records/${encodeURIComponent(recordId)}`, {
      token,
    });
  },

  createStandaloneVisit(token: string, horseId: string, input: StandaloneVisitInputDto) {
    return apiRequest<MedicalRecordDto>(`/horses/${encodeURIComponent(horseId)}/medical-records`, {
      method: "POST",
      token,
      body: input,
    });
  },

  createFollowUpVisit(token: string, caseId: string, input: VisitInputDto) {
    return apiRequest<MedicalRecordDto>(`/medical-cases/${encodeURIComponent(caseId)}/visits`, {
      method: "POST",
      token,
      body: input,
    });
  },

  voidRecord(token: string, recordId: string, reason: string) {
    return apiRequest<MedicalRecordDto>(`/medical-records/${encodeURIComponent(recordId)}/void`, {
      method: "POST",
      token,
      body: { reason },
    });
  },

  editRecord(token: string, recordId: string, input: MedicalRecordEditInputDto) {
    return apiRequest<MedicalRecordDto>(`/medical-records/${encodeURIComponent(recordId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },

  listExamRequests(token: string, filters: ExamRequestFilters = {}) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const status = filters.status ? `&status=${encodeURIComponent(filters.status)}` : "";
    const urgent = filters.urgent === undefined ? "" : `&urgent=${filters.urgent}`;
    return apiRequest<PageDto<ExamRequestDto>>(
      `/exam-requests?page=${page}&limit=${limit}${status}${urgent}`,
      { token },
    );
  },

  listHorseExamRequests(token: string, horseId: string) {
    return apiRequest<ExamRequestDto[]>(`/horses/${encodeURIComponent(horseId)}/exam-requests`, {
      token,
    });
  },

  createExamRequest(
    token: string,
    horseId: string,
    input: { description: string; urgent?: boolean },
  ) {
    return apiRequest<ExamRequestDto>(`/horses/${encodeURIComponent(horseId)}/exam-requests`, {
      method: "POST",
      token,
      body: input,
    });
  },

  changeExamRequestUrgency(
    token: string,
    requestId: string,
    input: { urgent: boolean; reason: string },
  ) {
    return apiRequest<ExamRequestDto>(`/exam-requests/${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },

  dismissExamRequest(token: string, requestId: string, reason: string) {
    return apiRequest<ExamRequestDto>(`/exam-requests/${encodeURIComponent(requestId)}/dismiss`, {
      method: "POST",
      token,
      body: { reason },
    });
  },

  updateHealthStatus(
    token: string,
    horseId: string,
    input: { healthStatus: HealthStatusDto; reason: string },
  ) {
    return apiRequest<{
      horseId: string;
      from: HealthStatusDto;
      to: HealthStatusDto;
      changed: boolean;
    }>(`/horses/${encodeURIComponent(horseId)}/health-status`, {
      method: "PATCH",
      token,
      body: input,
    });
  },

  listHealthHistory(token: string, horseId: string) {
    return apiRequest<
      {
        changedAt: string;
        from: string | null;
        to: string;
        reason: string | null;
        feature: string | null;
        actorId: string | null;
      }[]
    >(`/horses/${encodeURIComponent(horseId)}/health-history`, { token });
  },

  getCareInstructions(token: string, horseId: string) {
    return apiRequest<{
      horseId: string;
      current: { careInstructions: string; examDate: string; medicalRecordId: string } | null;
    }>(`/horses/${encodeURIComponent(horseId)}/care-instructions`, { token });
  },

  listTrainingLocks(token: string, horseId: string) {
    return apiRequest<TrainingLockDto[]>(`/horses/${encodeURIComponent(horseId)}/training-locks`, {
      token,
    });
  },

  createTrainingLock(token: string, horseId: string, input: { reason: string; lockEnd?: string }) {
    return apiRequest<TrainingLockDto>(`/horses/${encodeURIComponent(horseId)}/training-locks`, {
      method: "POST",
      token,
      body: input,
    });
  },

  releaseTrainingLock(token: string, lockId: string, conclusion: string) {
    return apiRequest<TrainingLockDto>(`/training-locks/${encodeURIComponent(lockId)}/release`, {
      method: "POST",
      token,
      body: { conclusion },
    });
  },

  listInjuries(token: string, horseId: string) {
    return apiRequest<InjuryTimelineItemDto[]>(`/horses/${encodeURIComponent(horseId)}/injuries`, {
      token,
    });
  },

  getClosePreview(token: string, caseId: string) {
    return apiRequest<MedicalCaseClosePreviewDto>(
      `/medical-cases/${encodeURIComponent(caseId)}/close-preview`,
      { token },
    );
  },

  closeCase(token: string, caseId: string, input: CaseCloseInputDto) {
    return apiRequest<MedicalCaseSummaryDto>(`/medical-cases/${encodeURIComponent(caseId)}/close`, {
      method: "POST",
      token,
      body: input,
    });
  },

  correctCaseConclusion(
    token: string,
    caseId: string,
    input: { finalConclusion: string; reason: string },
  ) {
    return apiRequest<MedicalCaseSummaryDto>(
      `/medical-cases/${encodeURIComponent(caseId)}/conclusion`,
      { method: "PATCH", token, body: input },
    );
  },

  adjustVisitCost(token: string, recordId: string, input: { cost: number; reason: string }) {
    return apiRequest<MedicalRecordDto>(`/medical-records/${encodeURIComponent(recordId)}/cost`, {
      method: "PATCH",
      token,
      body: input,
    });
  },

  getCostReport(
    token: string,
    query: { from: string; to: string; barnId?: string; ownerId?: string },
  ) {
    const params = new URLSearchParams({ from: query.from, to: query.to });
    if (query.barnId) params.set("barnId", query.barnId);
    if (query.ownerId) params.set("ownerId", query.ownerId);
    return apiRequest<MedicalCostReportDto>(`/medical/cost-report?${params.toString()}`, { token });
  },

  listCareSchedules(token: string, horseId: string) {
    return apiRequest<CareScheduleDto[]>(`/horses/${encodeURIComponent(horseId)}/care-schedules`, {
      token,
    });
  },

  createCareSchedule(
    token: string,
    horseId: string,
    input: {
      type: CareTaskTypeDto;
      dueAt: string;
      assigneeType?: "GROOM" | "VET";
      assignedTo?: string;
      notes?: string;
    },
  ) {
    const body: Record<string, any> = {
      type: input.type,
      dueAt: input.dueAt,
    };
    if (input.assigneeType) body.assigneeType = input.assigneeType;
    if (input.assignedTo) body.assignedTo = input.assignedTo;
    if (input.notes) body.notes = input.notes;
    return apiRequest<CareScheduleDto>(`/horses/${encodeURIComponent(horseId)}/care-schedules`, {
      method: "POST",
      token,
      body,
    });
  },

  updateCareSchedule(
    token: string,
    scheduleId: string,
    input: {
      dueAt?: string;
      assigneeType?: "GROOM" | "VET" | null;
      assignedTo?: string | null;
      notes?: string;
      reason?: string;
    },
  ) {
    const body: Record<string, any> = {};
    if (input.dueAt !== undefined) body.dueAt = input.dueAt;
    if (input.assigneeType !== undefined) body.assigneeType = input.assigneeType;
    if (input.assignedTo !== undefined) body.assignedTo = input.assignedTo;
    if (input.notes !== undefined) body.notes = input.notes;
    if (input.reason !== undefined) body.reason = input.reason;
    return apiRequest<CareScheduleDto>(`/care-schedules/${encodeURIComponent(scheduleId)}`, {
      method: "PATCH",
      token,
      body,
    });
  },

  completeCareSchedule(token: string, scheduleId: string, nextDueAt?: string) {
    return apiRequest<{ completed: CareScheduleDto; next: CareScheduleDto | null }>(
      `/care-schedules/${encodeURIComponent(scheduleId)}/complete`,
      {
        method: "POST",
        token,
        body: nextDueAt ? { nextDueAt } : {},
      },
    );
  },

  cancelCareSchedule(token: string, scheduleId: string, reason: string) {
    return apiRequest<CareScheduleDto>(`/care-schedules/${encodeURIComponent(scheduleId)}/cancel`, {
      method: "POST",
      token,
      body: { reason },
    });
  },

  reopenCareSchedule(token: string, scheduleId: string, reason: string) {
    return apiRequest<CareScheduleDto>(`/care-schedules/${encodeURIComponent(scheduleId)}/reopen`, {
      method: "POST",
      token,
      body: { reason },
    });
  },
};

export type {
  TrainingLockDto,
  InjuryTimelineItemDto,
  MedicalCaseSummaryDto,
  MedicalCaseDto,
  MedicalRecordDto,
  CareScheduleDto,
  ExamRequestDto,
} from "@/adapters/medical.adapter";
