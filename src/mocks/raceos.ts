import fixtureJson from "./raceos.json";
import { parseRaceOSFixture } from "./parse-raceos";

// This is the single boundary between raw JSON/API payloads and the typed UI model.
// Replace fixtureJson with an API response later; the exported contract remains unchanged.
const fixture = parseRaceOSFixture(fixtureJson);

export const horses = fixture.horses;
export const fitnessTrend = fixture.fitnessTrend;
export const speedTrend = fixture.speedTrend;
export const recoveryTrend = fixture.recoveryTrend;
export const groomTasks = fixture.groomTasks;
export const alerts = fixture.alerts;
export const liveSeries = fixture.liveSeries;
export const inventory = fixture.inventory;
export const staff = fixture.staff;
export const auditLog = fixture.auditLog;
export const races = fixture.races;
export const raceRegistrations = fixture.raceRegistrations;
export const raceResults = fixture.raceResults;
export const clubFinance = fixture.clubFinance;
export const flowSteps = fixture.flowSteps;
export const trainingWeek = fixture.trainingWeek;
export const incidentKinds = fixture.incidentKinds;
export const examSymptoms = fixture.examSymptoms;
export const trainingLockReasons = fixture.trainingLockReasons;
export const trainingPlans = fixture.trainingPlans;
export const trials = fixture.trials;
export const trainerRemarks = fixture.trainerRemarks;

export const getHorse = (id: string) => horses.find((horse) => horse.id === id) ?? horses[0];
