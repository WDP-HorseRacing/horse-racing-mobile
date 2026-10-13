import { formatDateTime } from "@/utils/formatters";

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
  prescriptions: unknown[];
  injuries: unknown[];
};

export type MedicalCaseDto = {
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
  visits?: MedicalRecordDto[];
};

export type MedicalDashboardDto = {
  herd: { horses: Array<{ horseId: string; horseName: string }> };
  checkups: Array<{
    horseId: string;
    horseName: string;
    healthStatus: string;
    dueDate: string;
    daysLeft: number;
    dueStatus: string;
    appointment: { scheduledAt: string } | null;
  }>;
  careSchedules: Array<{
    scheduleId: string;
    horseId: string;
    horseName: string;
    type: string;
    dueDate: string;
    assignedTo: string | null;
  }>;
  openCases: Array<{
    caseId: string;
    horseId: string;
    horseName: string;
    initialDiagnosis: string;
    openedAt: string;
    lastVisitAt: string | null;
    nextVisitAt: string | null;
  }>;
  pendingRequests: Array<{
    id: string;
    horseId: string;
    horseName: string;
    urgent: boolean;
    description: string;
    createdAt: string;
  }>;
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
  visits: Array<{
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
  }>;
};

export function mapMedicalDashboardCases(
  dashboard: MedicalDashboardDto,
): MedicalCaseListItem[] {
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
