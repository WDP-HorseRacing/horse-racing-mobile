import { apiRequest } from "@/services/api-client";

type Page<T> = { items: T[]; meta?: { totalPages?: number } };

export type FeedingMealName = "EARLY_MORNING" | "NOON" | "AFTERNOON" | "EVENING";
export type FeedingPlanStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type FeedingPlanLineInput = {
  meal: FeedingMealName;
  supplyItemId: string;
  quantity: number;
  note?: string;
};
export type FeedingPlanLine = {
  supplyItemId: string;
  name: string;
  category: "FEED" | "SUPPLEMENT";
  unit: string;
  quantity: number;
  note: string | null;
};
export type FeedingMeal = { meal: FeedingMealName; items: FeedingPlanLine[] };
export type FeedingPlanDto = {
  id: string;
  horseId: string;
  horseName: string;
  status: FeedingPlanStatus;
  note: string | null;
  creator: { id: string; fullName: string };
  approver: { id: string; fullName: string } | null;
  approvedAt: string | null;
  archivedAt: string | null;
  meals: FeedingMeal[];
  createdAt: string;
  updatedAt: string;
};
export type CreateFeedingPlansInput = {
  horseIds: string[];
  items?: FeedingPlanLineInput[];
  copyFromPlanId?: string;
  note?: string;
};
export type CareTaskTypeDto = {
  id: string;
  name: string;
  appliesToAll: boolean;
  active: boolean;
};
export type HorseCareTaskMode = "EXTRA" | "EXEMPT";
export type HorseCareTaskDto = {
  id: string;
  horseId: string;
  taskType: CareTaskTypeDto;
  mode: HorseCareTaskMode;
  fromDate: string;
  toDate: string;
  note: string | null;
  creator: { id: string; fullName: string };
  createdAt: string;
};
export type ChecklistStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "INCOMPLETE"
  | "CANCELLED";
export type ChecklistItemDto = {
  id: string;
  taskTypeId: string;
  name: string;
  done: boolean;
  doneAt: string | null;
  doer: { id: string; fullName: string } | null;
  note: string | null;
};
export type DailyChecklistDto = {
  id: string;
  horseId: string;
  horseName: string;
  checklistDate: string;
  status: ChecklistStatus;
  groom: { id: string; fullName: string };
  completedAt: string | null;
  items: ChecklistItemDto[];
};
export type IncidentStatus = "OPEN" | "RESOLVED";
export type IncidentResolutionSource = "HEAD_TRAINER" | "EXAM" | "LIFECYCLE";
export type IncidentExamRequestDto = {
  id: string;
  status: string;
  urgent: boolean;
  handledAt: string | null;
  dismissReason: string | null;
};
export type IncidentDto = {
  id: string;
  horseId: string;
  horseName: string;
  description: string;
  urgent: boolean;
  status: IncidentStatus;
  photoUrl: string | null;
  reporter: { id: string; fullName: string };
  resolution: string | null;
  resolver: { id: string; fullName: string } | null;
  resolvedBySystem: boolean;
  resolutionSource?: IncidentResolutionSource | null;
  resolvedAt: string | null;
  examRequest: IncidentExamRequestDto | null;
  createdAt: string;
};
export type HorseSurchargeDto = {
  id: string;
  horseId: string;
  description: string;
  dailyAmount: number;
  startDate: string;
  endDate: string;
  createdBy: string;
  createdAt: string;
  appliedBy: string | null;
  appliedByName: string | null;
  appliedAt: string | null;
};
export type UnappliedSurchargeDto = HorseSurchargeDto & {
  horseName: string;
  barnName: string | null;
  headTrainerName: string | null;
};
export type IncidentQuery = {
  status?: IncidentStatus;
  horseId?: string;
  barnId?: string;
};

export type RegenerateChecklistsResponseDto = {
  date: string;
  generated: number;
  failures: { horseId: string; horseName: string; message: string }[];
};

const MEAL_ORDER: FeedingMealName[] = ["EARLY_MORNING", "NOON", "AFTERNOON", "EVENING"];

export function orderedMeals(meals: FeedingMeal[]): FeedingMeal[] {
  return [...meals].sort((a, b) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal));
}

export const stableCareService = {
  listFeedingPlans(token: string, horseId: string, status?: FeedingPlanStatus) {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest<FeedingPlanDto[]>(
      `/horses/${encodeURIComponent(horseId)}/feeding-plans${suffix}`,
      { token },
    );
  },
  getFeedingPlan(token: string, planId: string) {
    return apiRequest<FeedingPlanDto>(`/feeding-plans/${encodeURIComponent(planId)}`, { token });
  },
  createFeedingPlans(token: string, input: CreateFeedingPlansInput) {
    return apiRequest<FeedingPlanDto[]>("/feeding-plans", { method: "POST", token, body: input });
  },
  replaceFeedingPlan(
    token: string,
    planId: string,
    input: { items: FeedingPlanLineInput[]; note?: string | null },
  ) {
    return apiRequest<FeedingPlanDto>(`/feeding-plans/${encodeURIComponent(planId)}`, {
      method: "PUT",
      token,
      body: input,
    });
  },
  deleteFeedingPlan(token: string, planId: string) {
    return apiRequest<void>(`/feeding-plans/${encodeURIComponent(planId)}`, {
      method: "DELETE",
      token,
    });
  },
  approveFeedingPlan(token: string, planId: string) {
    return apiRequest<FeedingPlanDto>(`/feeding-plans/${encodeURIComponent(planId)}/approve`, {
      method: "POST",
      token,
    });
  },
  listTaskTypes(token: string) {
    return apiRequest<CareTaskTypeDto[]>("/care-task-types", { token });
  },
  createTaskType(token: string, input: { name: string; appliesToAll: boolean }) {
    return apiRequest<CareTaskTypeDto>("/care-task-types", { method: "POST", token, body: input });
  },
  updateTaskType(
    token: string,
    typeId: string,
    input: { name?: string; appliesToAll?: boolean; active?: boolean },
  ) {
    return apiRequest<CareTaskTypeDto>(`/care-task-types/${encodeURIComponent(typeId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },
  listHorseCareTasks(token: string, horseId: string) {
    return apiRequest<HorseCareTaskDto[]>(`/horses/${encodeURIComponent(horseId)}/care-tasks`, {
      token,
    });
  },
  createHorseCareTask(
    token: string,
    horseId: string,
    input: {
      taskTypeId: string;
      mode?: HorseCareTaskMode;
      fromDate: string;
      toDate: string;
      note?: string;
    },
  ) {
    return apiRequest<HorseCareTaskDto>(`/horses/${encodeURIComponent(horseId)}/care-tasks`, {
      method: "POST",
      token,
      body: input,
    });
  },
  removeHorseCareTask(token: string, taskId: string) {
    return apiRequest<void>(`/horse-care-tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
      token,
    });
  },
  listChecklists(token: string, horseId: string, from: string, to = from) {
    const query = new URLSearchParams({ from, to });
    return apiRequest<DailyChecklistDto[]>(
      `/horses/${encodeURIComponent(horseId)}/checklists?${query.toString()}`,
      { token },
    );
  },
  regenerateChecklistsToday(token: string) {
    return apiRequest<RegenerateChecklistsResponseDto>(
      "/daily-checklists/regenerate-today",
      {
        method: "POST",
        token,
      },
    );
  },
  tickChecklistItem(token: string, itemId: string, input: { done: boolean; note?: string | null }) {
    return apiRequest<DailyChecklistDto>(`/checklist-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },
  async listIncidents(token: string, filter: IncidentQuery = {}) {
    return listPages<IncidentDto>(token, "/incidents", filter);
  },
  getIncident(token: string, incidentId: string) {
    return apiRequest<IncidentDto>(`/incidents/${encodeURIComponent(incidentId)}`, { token });
  },
  reportIncident(
    token: string,
    input: { horseId: string; description: string; urgent?: boolean; photoMediaId?: string },
  ) {
    return apiRequest<IncidentDto>("/incidents", { method: "POST", token, body: input });
  },
  referIncident(token: string, incidentId: string, urgent = false) {
    return apiRequest<IncidentDto>(`/incidents/${encodeURIComponent(incidentId)}/refer`, {
      method: "POST",
      token,
      body: { urgent },
    });
  },
  resolveIncident(token: string, incidentId: string, resolution: string) {
    return apiRequest<IncidentDto>(`/incidents/${encodeURIComponent(incidentId)}/resolve`, {
      method: "POST",
      token,
      body: { resolution },
    });
  },
  listSurcharges(token: string, horseId: string) {
    return apiRequest<HorseSurchargeDto[]>(`/horses/${encodeURIComponent(horseId)}/surcharges`, {
      token,
    });
  },
  createSurcharge(
    token: string,
    horseId: string,
    input: { description: string; dailyAmount: number; startDate: string; endDate: string },
  ) {
    return apiRequest<HorseSurchargeDto>(`/horses/${encodeURIComponent(horseId)}/surcharges`, {
      method: "POST",
      token,
      body: input,
    });
  },
  listUnappliedSurcharges(token: string) {
    return apiRequest<UnappliedSurchargeDto[]>("/horse-surcharges/unapplied", { token });
  },
  applySurcharge(token: string, surchargeId: string) {
    return apiRequest<HorseSurchargeDto>(
      `/horse-surcharges/${encodeURIComponent(surchargeId)}/apply`,
      {
        method: "POST",
        token,
      },
    );
  },
  endSurcharge(token: string, surchargeId: string) {
    return apiRequest<HorseSurchargeDto>(
      `/horse-surcharges/${encodeURIComponent(surchargeId)}/end`,
      {
        method: "POST",
        token,
      },
    );
  },
  deleteSurcharge(token: string, surchargeId: string) {
    return apiRequest<void>(`/horse-surcharges/${encodeURIComponent(surchargeId)}`, {
      method: "DELETE",
      token,
    });
  },
};

async function listPages<T>(
  token: string,
  path: string,
  filters: Record<string, string | undefined>,
): Promise<T[]> {
  const items: T[] = [];
  let pageNumber = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({
      page: String(pageNumber),
      limit: "100",
      ...Object.fromEntries(
        Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
      ),
    });
    const page = await apiRequest<Page<T>>(`${path}?${query.toString()}`, { token });
    items.push(...(page.items ?? []));
    totalPages = page.meta?.totalPages ?? pageNumber;
    pageNumber += 1;
  } while (pageNumber <= totalPages);
  return items;
}
