import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import {
  groomTasks,
  horses as initialHorses,
  raceRegistrations as initialRaceRegistrations,
  trainingPlans as initialTrainingPlans,
  type Horse,
  type RaceRegistration,
  type Task,
  type TrainingPlan,
  type TrainingSession,
} from "@/lib/raceos-data";

export type Incident = {
  id: string;
  horse: string;
  kind: string;
  severity: string;
  note: string;
  hasPhoto: boolean;
};

export type Examination = {
  horseId: string;
  symptoms: string[];
  diagnosis: string;
  treatment: string;
  medication: string;
  notes: string;
};

type RaceOSState = {
  horses: Horse[];
  tasks: Task[];
  plans: TrainingPlan[];
  raceRegistrations: RaceRegistration[];
  incidents: Incident[];
  examinations: Record<string, Examination>;
  lockedHorseIds: string[];
  createHorse: (horse: Horse) => void;
  updateHorse: (id: string, changes: Partial<Horse>) => void;
  completeTask: (id: string) => void;
  saveTrainingPlan: (plan: TrainingPlan) => void;
  saveTrainingSession: (planId: string, phaseId: string, session: TrainingSession) => void;
  registerRace: (registration: RaceRegistration) => void;
  reportIncident: (incident: Omit<Incident, "id">) => void;
  saveExamination: (exam: Examination) => void;
  lockHorse: (horseId: string) => void;
};

const RaceOSContext = createContext<RaceOSState | null>(null);

export function RaceOSProvider({ children }: PropsWithChildren) {
  const [horses, setHorses] = useState(initialHorses);
  const [tasks, setTasks] = useState(groomTasks);
  const [plans, setPlans] = useState<TrainingPlan[]>(initialTrainingPlans);
  const [raceRegistrations, setRaceRegistrations] =
    useState<RaceRegistration[]>(initialRaceRegistrations);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [examinations, setExaminations] = useState<Record<string, Examination>>({});
  const [lockedHorseIds, setLockedHorseIds] = useState(["thunder-king"]);

  const value = useMemo<RaceOSState>(
    () => ({
      horses,
      tasks,
      plans,
      raceRegistrations,
      incidents,
      examinations,
      lockedHorseIds,
      createHorse: (horse) => setHorses((current) => [...current, horse]),
      updateHorse: (id, changes) =>
        setHorses((current) =>
          current.map((horse) => (horse.id === id ? { ...horse, ...changes } : horse)),
        ),
      completeTask: (id) =>
        setTasks((current) =>
          current.map((task) => (task.id === id ? { ...task, done: true } : task)),
        ),
      saveTrainingPlan: (plan) =>
        setPlans((current) =>
          current.some((item) => item.id === plan.id)
            ? current.map((item) => (item.id === plan.id ? plan : item))
            : [...current, plan],
        ),
      saveTrainingSession: (planId, phaseId, session) =>
        setPlans((current) =>
          current.map((plan) =>
            plan.id !== planId
              ? plan
              : {
                  ...plan,
                  phases: plan.phases.map((phase) =>
                    phase.id !== phaseId
                      ? phase
                      : {
                          ...phase,
                          sessions: phase.sessions.some((item) => item.id === session.id)
                            ? phase.sessions.map((item) =>
                                item.id === session.id ? session : item,
                              )
                            : [...phase.sessions, session],
                        },
                  ),
                },
          ),
        ),
      registerRace: (registration) =>
        setRaceRegistrations((current) =>
          current.some(
            (item) => item.horseId === registration.horseId && item.raceId === registration.raceId,
          )
            ? current
            : [...current, registration],
        ),
      reportIncident: (incident) =>
        setIncidents((current) => [{ ...incident, id: `incident-${Date.now()}` }, ...current]),
      saveExamination: (exam) =>
        setExaminations((current) => ({ ...current, [exam.horseId]: exam })),
      lockHorse: (horseId) =>
        setLockedHorseIds((current) =>
          current.includes(horseId) ? current : [...current, horseId],
        ),
    }),
    [horses, tasks, plans, raceRegistrations, incidents, examinations, lockedHorseIds],
  );

  return <RaceOSContext.Provider value={value}>{children}</RaceOSContext.Provider>;
}

export function useRaceOS() {
  const value = useContext(RaceOSContext);
  if (!value) throw new Error("useRaceOS must be used within RaceOSProvider");
  return value;
}
