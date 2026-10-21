import { formatDateTime } from "@/utils/formatters";
import type { HorseLifecyclePreviewDto } from "@/services/horse.service";

export type MedicalRecordDto = {
  id: string;
  horseId: string;
  kind: string;
  caseId: string | null;
  conclusion: string | null;
  examDate: string;
  diagnosis: string | null;
  resultingStatus: string;
  careInstructions: string | null;
  nextVisitAt: string | null;
  vetId: string;
  voidedAt: string | null;
  voidReason: string | null;
  replacesRecordId: string | null;
  prescriptions: PrescriptionDto[];
  injuries: InjuryDto[];
};

export type PrescriptionDto = {
  id: string;
  medicine: string;
  dosage?: string;
  frequency?: string;
  startDate: string;
  endDate: string | null;
};

export type InjuryDto = {
  id: string;
  medicalRecordId: string;
  injuryId: string;
  bodyRegion: string;
  position: { x: number; y: number; z: number };
  injuryType: string;
  recoveryStatus: string;
  notes: string | null;
};

export type MedicalCaseSummaryDto = {
  id: string;
  horseId: string;
  status: "OPEN" | "CLOSED" | "CANCELLED" | string;
  openedAt: string;
  openedBy: string;
  initialDiagnosis: string;
  closedAt: string | null;
  finalConclusion: string | null;
  totalCost?: number | null;
  costHidden?: boolean;
};

export type MedicalCaseDto = MedicalCaseSummaryDto & { visits: MedicalRecordDto[] };

export type MedicalDashboardDto = {
  herd: {
    counts: Record<"QUARANTINED" | "INJURED" | "UNDER_OBSERVATION" | "ELIGIBLE", number>;
    horses: {
      horseId: string;
      horseName: string;
      barnId: string | null;
      stallId: string | null;
      stallCode: string | null;
      healthStatus: "ELIGIBLE" | "UNDER_OBSERVATION" | "INJURED" | "QUARANTINED";
    }[];
  };
  checkups: {
    horseId: string;
    horseName: string;
    barnId: string | null;
    healthStatus: string;
    lastVisitDate: string | null;
    dueDate: string;
    daysLeft: number;
    dueStatus: string;
    appointment: { id: string; horseId: string; scheduledAt: string } | null;
  }[];
  careSchedules: {
    scheduleId: string;
    horseId: string;
    horseName: string;
    type: string;
    dueDate: string;
    assignedTo: string | null;
  }[];
  openCases: {
    caseId: string;
    horseId: string;
    horseName: string;
    initialDiagnosis: string;
    openedAt: string;
    lastVisitAt: string | null;
    nextVisitAt: string | null;
  }[];
  pendingRequests: {
    id: string;
    horseId: string;
    horseName: string;
    urgent: boolean;
    description: string;
    createdAt: string;
    status?: string;
    source?: string;
    requestedBy?: string | null;
    requestedBySystem?: boolean;
    dismissReason?: string | null;
    handledAt?: string | null;
    medicalRecordId?: string | null;
  }[];
};

export type MedicalCaseClosePreviewDto = {
  activeLock: { id: string; reason: string; lockEnd: string | null } | null;
  healthStatus: string;
  healthWarning: boolean;
  pendingRequestCount: number;
  deathImpact?: HorseLifecyclePreviewDto;
};

export type CareScheduleDto = {
  id: string;
  horseId: string;
  type: string;
  dueAt: string;
  assignedTo: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | string;
  completedAt: string | null;
  completedBy: string | null;
  cancelReason: string | null;
  notes: string | null;
};

export type ExamRequestDto = MedicalDashboardDto["pendingRequests"][number] & {
  requestedBy: string | null;
  requestedBySystem: boolean;
  source: string;
  status: "PENDING" | "EXAMINED" | "DISMISSED" | string;
  dismissReason: string | null;
  handledBy: string | null;
  handledBySystem: boolean;
  handledAt: string | null;
  medicalRecordId: string | null;
  alertType: string | null;
  incidentId: string | null;
};

export type PageDto<T> = {
  items: T[];
  meta: { page?: number; limit?: number; total?: number; totalPages?: number };
};

export type MedicalCostReportDto = {
  from: string;
  to: string;
  caseCount: number;
  totalCost: number;
  items: { horseId: string; horseName: string; caseCount: number; totalCost: number }[];
};

export type TrainingLockDto = {
  id: string;
  horseId: string;
  caseId: string | null;
  reason: string;
  lockStart: string;
  lockEnd: string | null;
  status: string;
  lockedBy: string;
  releasedBy?: string | null;
  releasedAt: string | null;
  releaseConclusion?: string | null;
};

export type InjuryTimelineItemDto = {
  id: string;
  horseId: string;
  bodyRegion: string;
  injuryType: string;
  position: { x: number; y: number; z: number };
  firstMedicalRecordId: string;
  firstExamDate: string;
  currentRecoveryStatus: string;
  history: {
    medicalRecordId: string;
    examDate: string;
    caseId: string | null;
    recoveryStatus: string;
    notes: string | null;
  }[];
};

export type MedicalCaseListItem = {
  id: string;
  horseId: string;
  horseName: string;
  diagnosis: string;
  status: string;
  openedAt: string;
  openedAtLabel: string;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
};

export type MedicalCaseView = MedicalCaseListItem & {
  closedAt: string | null;
  finalConclusion: string | null;
  totalCost: number | null;
  costHidden: boolean;
  visits: {
    id: string;
    kind: string;
    conclusion: string | null;
    examDate: string;
    examDateLabel: string;
    diagnosis: string;
    resultingStatus: string;
    careInstructions: string | null;
    nextVisitAt: string | null;
    isVoided: boolean;
    voidReason: string | null;
  }[];
};

export function mapMedicalDashboardCases(dashboard: MedicalDashboardDto): MedicalCaseListItem[] {
  return dashboard.openCases.map((item) => ({
    id: item.caseId,
    horseId: item.horseId,
    horseName: item.horseName,
    diagnosis: item.initialDiagnosis,
    status: "OPEN",
    openedAt: item.openedAt,
    openedAtLabel: formatDateTime(item.openedAt),
    lastVisitAt: item.lastVisitAt,
    nextVisitAt: item.nextVisitAt,
  }));
}

export function mapMedicalCase(
  medicalCase: MedicalCaseDto,
  horseName = medicalCase.horseId,
): MedicalCaseView {
  const visits = medicalCase.visits ?? [];
  return {
    id: medicalCase.id,
    horseId: medicalCase.horseId,
    horseName,
    diagnosis: medicalCase.initialDiagnosis,
    status: medicalCase.status,
    openedAt: medicalCase.openedAt,
    openedAtLabel: formatDateTime(medicalCase.openedAt),
    lastVisitAt: visits.length ? visits[0].examDate : null,
    nextVisitAt: visits.find((visit) => !visit.voidedAt)?.nextVisitAt ?? null,
    closedAt: medicalCase.closedAt,
    finalConclusion: medicalCase.finalConclusion,
    totalCost: medicalCase.totalCost ?? null,
    costHidden: Boolean(medicalCase.costHidden),
    visits: visits.map((visit) => ({
      id: visit.id,
      kind: visit.kind,
      conclusion: visit.conclusion,
      examDate: visit.examDate,
      examDateLabel: formatDateTime(visit.examDate),
      diagnosis: visit.diagnosis ?? "Chưa ghi chẩn đoán",
      resultingStatus: visit.resultingStatus,
      careInstructions: visit.careInstructions,
      nextVisitAt: visit.nextVisitAt,
      isVoided: Boolean(visit.voidedAt),
      voidReason: visit.voidReason,
    })),
  };
}
