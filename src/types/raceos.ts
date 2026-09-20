export type HorseStatus = "FIT" | "MONITOR" | "INJURED" | "LOCKED" | "TRAINING" | "RACE READY";
export type RoleId = "trainer" | "groom" | "vet" | "owner" | "manager";
export type Readiness = "Low" | "Moderate" | "High";
export type RaceAptitude = "SPRINTER" | "MILER" | "STAYER";

export type Horse = {
  id: string;
  name: string;
  age: number;
  breed: string;
  sex: string;
  weight: number;
  stall: string;
  status: HorseStatus;
  fitness: number;
  readiness: Readiness;
  raceAptitude: RaceAptitude;
  phase: string;
  lastSession: string;
  owner: string;
  alerts: number;
  hr: number;
  color: string;
  sire: string;
  dam: string;
  nextRace?: string;
  recovery?: number;
  note?: string;
};

export type DietaryRation = {
  feedingTime: string;
  items: {
    name: string;
    quantity: number;
    unit: string;
  }[];
};

export type Task = {
  id: string;
  time: string;
  horse: string;
  horseId: string;
  title: string;
  detail: string;
  kind: "Feeding" | "Training" | "Grooming" | "Recovery" | "Cleaning" | "Bathing";
  done: boolean;
  priority?: boolean;
  dietaryRation?: DietaryRation;
};

export type AlertItem = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  horse: string;
  horseId: string;
  detail: string;
  time: string;
};

export type FitnessPoint = { d: string; v: number; load: number };
export type SpeedPoint = { d: string; speed: number; hr: number };
export type RecoveryPoint = { d: string; v: number };
export type LivePoint = { t: number; hr: number; speed: number };
export type InventoryItem = {
  name: string;
  category: string;
  stock: number;
  unit: string;
  low: boolean;
};
export type StaffMember = { name: string; role: string; status: string; scope: string };

export type PermissionCategory = "Horses" | "Training" | "Health" | "Staff" | "Inventory" | "Racing" | "Reports" | "Operations";

export type ActionPermission = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve?: boolean;
  lock?: boolean;
};

export type RoleAccessScope = "Entire Club" | "Assigned Stable" | "Assigned Horses" | "Assigned Area";

export type RoleAccess = {
  id: RoleId;
  name: string;
  description: string;
  scope: RoleAccessScope;
  permissions: Record<string, ActionPermission>;
  userCount: number;
};

export type AuditEntry = {
  who: string;
  action: string;
  object: string;
  time: string;
  result: string;
};
export type Race = {
  id: string;
  name: string;
  date: string;
  track: string;
  venue: string;
  distanceM: number;
  entries: number;
  purse: string;
};
export type RaceRegistration = {
  id: string;
  horseId: string;
  raceId: string;
  submittedByRole: RoleId;
  status: "submitted" | "approved" | "rejected";
  createdAt: string;
};
export type RaceResult = {
  name: string;
  date: string;
  horse: string;
  place: string;
  prize: string;
};
export type FinancePoint = { m: string; cost: number; revenue: number };
export type FlowStep = { role: string; action: string; detail: string; critical?: boolean };
export type TrainingDay = { day: string; count: number };
export type SessionStatus = "planned" | "scheduled" | "in_progress" | "completed" | "cancelled";
export type PlanStatus = "draft" | "active" | "completed" | "suspended";
export type TrainingSession = {
  id: string;
  date: string;
  time: string;
  title: string;
  type: string;
  objective: string;
  distanceM: number;
  durationMin: number;
  intensity: "Light" | "Moderate" | "High";
  workloadPercent: number;
  surface: "Soft" | "Turf" | "Dirt" | "Synthetic" | "Sand";
  status: SessionStatus;
  assignedGroom: string;
  note: string;
  energyMcal: number;
  concentratePercent: number;
};
export type TrainingPhase = {
  id: string;
  name: string;
  objective: string;
  order: number;
  startDate: string;
  endDate: string;
  sessions: TrainingSession[];
};
export type TrainingPlan = {
  id: string;
  horseId: string;
  name: string;
  objective: string;
  status: PlanStatus;
  startDate: string;
  endDate: string;
  targetEvent: string;
  note: string;
  phases: TrainingPhase[];
  publishedAt: string;
};

export type Trial = {
  id: string;
  horseId: string;
  date: string;
  type: string;
  distanceM: number;
  surface: string;
  status: string;
  duration: string;
  result: string;
  videoUrl?: string;
};

export type TrainerRemark = {
  id: string;
  horseId: string;
  date: string;
  sessionId?: string;
  trialId?: string;
  sessionTitle?: string;
  trainerName: string;
  context: string;
  performanceSummary: string;
  observation: string;
  recommendation?: string;
};

export type RaceOSFixture = {
  horses: Horse[];
  fitnessTrend: FitnessPoint[];
  speedTrend: SpeedPoint[];
  recoveryTrend: RecoveryPoint[];
  groomTasks: Task[];
  alerts: AlertItem[];
  liveSeries: LivePoint[];
  inventory: InventoryItem[];
  staff: StaffMember[];
  auditLog: AuditEntry[];
  races: Race[];
  raceRegistrations: RaceRegistration[];
  raceResults: RaceResult[];
  clubFinance: FinancePoint[];
  flowSteps: FlowStep[];
  trainingWeek: TrainingDay[];
  incidentKinds: string[];
  examSymptoms: string[];
  trainingLockReasons: string[];
  trainingPlans: TrainingPlan[];
  trials: Trial[];
  trainerRemarks: TrainerRemark[];
};
