import type { RaceOSFixture, Trial, TrainerRemark } from "@/types/raceos";

const arrayKeys: (keyof RaceOSFixture)[] = [
  "horses",
  "fitnessTrend",
  "speedTrend",
  "recoveryTrend",
  "groomTasks",
  "alerts",
  "liveSeries",
  "inventory",
  "staff",
  "auditLog",
  "races",
  "raceRegistrations",
  "raceResults",
  "clubFinance",
  "flowSteps",
  "trainingWeek",
  "incidentKinds",
  "examSymptoms",
  "trainingLockReasons",
  "trainingPlans",
  "trials",
  "trainerRemarks",
];

export function parseRaceOSFixture(value: unknown): RaceOSFixture {
  if (!value || typeof value !== "object")
    throw new Error("Invalid RaceOS payload: object expected");
  const record = value as Record<string, unknown>;
  // temporarily ignore strict array check for trials and trainerRemarks as they are mock injected below
  for (const key of arrayKeys) {
    if (key !== "trials" && key !== "trainerRemarks" && !Array.isArray(record[key]))
      throw new Error(`Invalid RaceOS payload: ${key} must be an array`);
  }
  for (const horse of record.horses as Record<string, unknown>[]) {
    if (!horse || typeof horse.id !== "string" || typeof horse.name !== "string") {
      throw new Error("Invalid RaceOS payload: every horse requires string id and name");
    }
  }
  const parsed = value as RaceOSFixture;
  
  // Inject mock dietaryRation for feeding tasks
  parsed.groomTasks = parsed.groomTasks.map((task) => {
    if (task.kind === "Feeding") {
      return {
        ...task,
        dietaryRation: {
          feedingTime: task.time,
          items: [
            { name: "Grain", quantity: 2.5, unit: "kg" },
            { name: "Hay", quantity: 5, unit: "kg" },
            { name: "Vitamin Supplement", quantity: 20, unit: "g" },
          ],
        },
      };
    }
    return task;
  });

  // Inject mock Trials
  parsed.trials = [
    {
      id: "trial-1",
      horseId: "thunder-king",
      date: "2026-09-20",
      type: "Practice Race",
      distanceM: 1200,
      surface: "Turf",
      status: "completed",
      duration: "01:14.5",
      result: "1st of 4",
      videoUrl: "https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4",
    },
    {
      id: "trial-2",
      horseId: "red-storm",
      date: "2026-09-18",
      type: "Speed Test",
      distanceM: 800,
      surface: "Dirt",
      status: "completed",
      duration: "00:48.2",
      result: "Target met",
      videoUrl: "https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4",
    }
  ];

  // Inject mock Trainer Remarks
  parsed.trainerRemarks = [
    {
      id: "remark-1",
      horseId: "thunder-king",
      date: "2026-09-20",
      trialId: "trial-1",
      sessionTitle: "Practice Race",
      trainerName: "Elena Marsh",
      context: "Pre-season Trial",
      performanceSummary: "Excellent form and stamina",
      observation: "Strong pace control throughout the session. Thunder King showed no signs of fatigue during the final 200m. The new track surface seems to suit his stride perfectly.",
      recommendation: "Keep current workload. Monitor left hind leg just in case.",
    },
    {
      id: "remark-2",
      horseId: "red-storm",
      date: "2026-09-19",
      sessionId: "session-2",
      sessionTitle: "Speed Work",
      trainerName: "Elena Marsh",
      context: "Phase 2 Speed Training",
      performanceSummary: "Target speed achieved",
      observation: "Good acceleration in the final section. She was a bit restless in the gates but settled down quickly once running.",
    }
  ];

  return parsed;
}
