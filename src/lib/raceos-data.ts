export type HorseStatus = "FIT" | "MONITOR" | "INJURED" | "LOCKED" | "TRAINING" | "RACE READY";

export type RoleId = "trainer" | "groom" | "vet" | "owner" | "manager";

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
  readiness: "Low" | "Moderate" | "High";
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

export const horses: Horse[] = [
  {
    id: "thunder-king",
    name: "Thunder King",
    age: 5,
    breed: "Thoroughbred",
    sex: "Colt",
    weight: 498,
    stall: "A01",
    status: "LOCKED",
    fitness: 74,
    readiness: "Low",
    phase: "Recovery",
    lastSession: "1,600 m · Moderate · today 06:20",
    owner: "Marlow Bloodstock",
    alerts: 2,
    hr: 168,
    color: "Bay",
    sire: "Northern Gale",
    dam: "Silk Verdict",
    nextRace: "Sep 28 · Autumn Sprint",
    recovery: 65,
    note: "Training locked by veterinarian — abnormal heart-rate response.",
  },
  {
    id: "silver-arrow",
    name: "Silver Arrow",
    age: 4,
    breed: "Thoroughbred",
    sex: "Filly",
    weight: 471,
    stall: "A02",
    status: "MONITOR",
    fitness: 68,
    readiness: "Moderate",
    phase: "Base Conditioning",
    lastSession: "1,200 m · Light · today 07:10",
    owner: "Kestrel Racing",
    alerts: 1,
    hr: 96,
    color: "Grey",
    sire: "Arrowline",
    dam: "Pale Comet",
    recovery: 82,
  },
  {
    id: "red-storm",
    name: "Red Storm",
    age: 6,
    breed: "Thoroughbred",
    sex: "Gelding",
    weight: 512,
    stall: "A03",
    status: "INJURED",
    fitness: 41,
    readiness: "Low",
    phase: "Rehabilitation",
    lastSession: "Hand-walk only · yesterday",
    owner: "Marlow Bloodstock",
    alerts: 1,
    hr: 88,
    color: "Chestnut",
    sire: "Storm Ledger",
    dam: "Red Angelica",
    recovery: 38,
  },
  {
    id: "night-quartz",
    name: "Night Quartz",
    age: 4,
    breed: "Thoroughbred",
    sex: "Colt",
    weight: 489,
    stall: "A04",
    status: "TRAINING",
    fitness: 86,
    readiness: "High",
    phase: "Speed Work",
    lastSession: "Live now · 1.2 km",
    owner: "Ardent Stud",
    alerts: 0,
    hr: 154,
    color: "Black",
    sire: "Quartz Hall",
    dam: "Nightfold",
    nextRace: "Oct 05 · Club Mile",
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    age: 5,
    breed: "Thoroughbred",
    sex: "Filly",
    weight: 480,
    stall: "B01",
    status: "RACE READY",
    fitness: 92,
    readiness: "High",
    phase: "Peak / Taper",
    lastSession: "1,400 m · High · today 06:00",
    owner: "Kestrel Racing",
    alerts: 0,
    hr: 92,
    color: "Palomino",
    sire: "Hour of Gold",
    dam: "Lantern Bay",
    nextRace: "Sep 28 · Autumn Sprint",
  },
  {
    id: "iron-verdict",
    name: "Iron Verdict",
    age: 7,
    breed: "Thoroughbred",
    sex: "Gelding",
    weight: 523,
    stall: "B02",
    status: "FIT",
    fitness: 81,
    readiness: "Moderate",
    phase: "Base Conditioning",
    lastSession: "1,600 m · Moderate · today 06:40",
    owner: "Ardent Stud",
    alerts: 0,
    hr: 90,
    color: "Dark bay",
    sire: "Verdict Line",
    dam: "Iron Lace",
  },
  {
    id: "pale-comet",
    name: "Pale Comet",
    age: 3,
    breed: "Thoroughbred",
    sex: "Filly",
    weight: 452,
    stall: "B03",
    status: "FIT",
    fitness: 77,
    readiness: "Moderate",
    phase: "Foundation",
    lastSession: "1,000 m · Light · today 07:30",
    owner: "Marlow Bloodstock",
    alerts: 0,
    hr: 87,
    color: "Grey",
    sire: "Cometfall",
    dam: "Pale Ridge",
  },
  {
    id: "brave-ledger",
    name: "Brave Ledger",
    age: 5,
    breed: "Thoroughbred",
    sex: "Colt",
    weight: 494,
    stall: "B04",
    status: "RACE READY",
    fitness: 89,
    readiness: "High",
    phase: "Peak / Taper",
    lastSession: "1,200 m · High · today 06:10",
    owner: "Kestrel Racing",
    alerts: 0,
    hr: 89,
    color: "Bay",
    sire: "Ledger Hall",
    dam: "Brave Season",
    nextRace: "Sep 28 · Autumn Sprint",
  },
];

export const getHorse = (id: string) => horses.find((h) => h.id === id) ?? horses[0];

export const fitnessTrend = [
  { d: "Mon", v: 71, load: 42 },
  { d: "Tue", v: 73, load: 58 },
  { d: "Wed", v: 76, load: 66 },
  { d: "Thu", v: 75, load: 51 },
  { d: "Fri", v: 78, load: 72 },
  { d: "Sat", v: 80, load: 63 },
  { d: "Sun", v: 78, load: 38 },
];

export const speedTrend = [
  { d: "W1", speed: 48, hr: 154 },
  { d: "W2", speed: 51, hr: 158 },
  { d: "W3", speed: 53, hr: 161 },
  { d: "W4", speed: 55, hr: 166 },
  { d: "W5", speed: 54, hr: 172 },
  { d: "W6", speed: 56, hr: 168 },
];

export const recoveryTrend = [
  { d: "D1", v: 22 },
  { d: "D4", v: 34 },
  { d: "D7", v: 45 },
  { d: "D10", v: 52 },
  { d: "D13", v: 61 },
  { d: "D16", v: 65 },
];

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
};

export const groomTasks: Task[] = [
  {
    id: "t1",
    time: "05:30",
    horse: "All stalls A wing",
    horseId: "",
    title: "Morning feed",
    detail: "Hard feed · 3.2 kg per horse",
    kind: "Feeding",
    done: true,
  },
  {
    id: "t2",
    time: "06:00",
    horse: "Thunder King",
    horseId: "thunder-king",
    title: "Training preparation",
    detail: "1,600 m · Moderate",
    kind: "Training",
    done: false,
    priority: true,
  },
  {
    id: "t3",
    time: "06:40",
    horse: "Night Quartz",
    horseId: "night-quartz",
    title: "Tack up for speed work",
    detail: "Dirt track · sensor vest fitted",
    kind: "Training",
    done: false,
  },
  {
    id: "t4",
    time: "08:15",
    horse: "Red Storm",
    horseId: "red-storm",
    title: "Ice bath — left fore",
    detail: "15 min · vet instruction",
    kind: "Recovery",
    done: false,
  },
  {
    id: "t5",
    time: "09:00",
    horse: "Silver Arrow",
    horseId: "silver-arrow",
    title: "Grooming & hoof check",
    detail: "Report anything unusual",
    kind: "Grooming",
    done: false,
  },
  {
    id: "t6",
    time: "10:30",
    horse: "Stall A01–A04",
    horseId: "",
    title: "Muck out & bedding",
    detail: "Fresh shavings",
    kind: "Cleaning",
    done: false,
  },
  {
    id: "t7",
    time: "15:00",
    horse: "Golden Hour",
    horseId: "golden-hour",
    title: "Bathing after work",
    detail: "Warm rinse · liniment",
    kind: "Bathing",
    done: false,
  },
];

export type AlertItem = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  horse: string;
  horseId: string;
  detail: string;
  time: string;
};

export const alerts: AlertItem[] = [
  {
    id: "a1",
    severity: "critical",
    title: "Training locked by veterinarian",
    horse: "Thunder King",
    horseId: "thunder-king",
    detail: "Abnormal heart-rate response during 1,600 m work.",
    time: "10:24",
  },
  {
    id: "a2",
    severity: "critical",
    title: "Heart rate above safety threshold",
    horse: "Thunder King",
    horseId: "thunder-king",
    detail: "188 bpm sustained 42 s · normal range 60–180 bpm.",
    time: "10:06",
  },
  {
    id: "a3",
    severity: "warning",
    title: "Refused morning feed",
    horse: "Silver Arrow",
    horseId: "silver-arrow",
    detail: "Reported by groom Mai T. · appetite 40%.",
    time: "06:12",
  },
  {
    id: "a4",
    severity: "info",
    title: "Vaccination due in 3 days",
    horse: "Pale Comet",
    horseId: "pale-comet",
    detail: "Equine influenza booster.",
    time: "Yesterday",
  },
];

export const liveSeries = Array.from({ length: 40 }, (_, i) => ({
  t: i,
  hr: Math.round(120 + 40 * Math.sin(i / 5) + (i > 28 ? (i - 28) * 2.2 : 0)),
  speed: Math.round(30 + 22 * Math.sin(i / 6 + 1)),
}));

export const inventory = [
  { name: "Oats & hard feed", category: "Feed", stock: 82, unit: "sacks", low: false },
  { name: "Timothy hay", category: "Feed", stock: 14, unit: "bales", low: true },
  { name: "Electrolyte paste", category: "Medical", stock: 36, unit: "tubes", low: false },
  { name: "Bandage wraps", category: "Medical", stock: 9, unit: "packs", low: true },
  { name: "Sensor vests", category: "Equipment", stock: 22, unit: "units", low: false },
  { name: "Exercise saddles", category: "Equipment", stock: 18, unit: "units", low: false },
];

export const staff = [
  { name: "Elena Marsh", role: "Head Trainer", status: "On duty", scope: "24 horses" },
  { name: "Dr. Sanjay Rao", role: "Veterinarian", status: "On call", scope: "Medical authority" },
  { name: "Mai Tran", role: "Groom", status: "On duty", scope: "A wing · 8 horses" },
  { name: "Peter Osei", role: "Groom", status: "Off shift", scope: "B wing · 8 horses" },
  { name: "Clara Novak", role: "Club Manager", status: "On duty", scope: "Operations & finance" },
];

export const auditLog = [
  {
    who: "Veterinarian · S. Rao",
    action: "Locked training",
    object: "Thunder King",
    time: "10:24",
    result: "Critical health alert",
  },
  {
    who: "System · IoT engine",
    action: "Raised HR threshold alert",
    object: "Thunder King",
    time: "10:06",
    result: "Escalated to vet",
  },
  {
    who: "Head Trainer · E. Marsh",
    action: "Updated training plan",
    object: "Thunder King",
    time: "10:41",
    result: "Recovery plan published",
  },
  {
    who: "Groom · M. Tran",
    action: "Completed task",
    object: "Silver Arrow — grooming",
    time: "09:22",
    result: "Success",
  },
  {
    who: "Manager · C. Novak",
    action: "Granted permission",
    object: "Role: Groom → incident.create",
    time: "Yesterday",
    result: "Success",
  },
];

export const races = [
  { name: "Autumn Sprint", date: "Sep 28", track: "Meadowline · 1,200 m", entries: 3, purse: "$48,000" },
  { name: "Club Mile", date: "Oct 05", track: "Meadowline · 1,600 m", entries: 2, purse: "$72,000" },
  { name: "Harvest Cup", date: "Oct 19", track: "Ridgemont · 2,000 m", entries: 1, purse: "$120,000" },
];

export const raceResults = [
  { name: "Summer Dash", date: "Aug 24", horse: "Golden Hour", place: "1st", prize: "$24,000" },
  { name: "Evening Plate", date: "Aug 10", horse: "Brave Ledger", place: "3rd", prize: "$6,500" },
  { name: "Coastal Mile", date: "Jul 27", horse: "Night Quartz", place: "2nd", prize: "$11,000" },
];

export const clubFinance = [
  { m: "Apr", cost: 82, revenue: 61 },
  { m: "May", cost: 79, revenue: 74 },
  { m: "Jun", cost: 86, revenue: 92 },
  { m: "Jul", cost: 88, revenue: 78 },
  { m: "Aug", cost: 84, revenue: 118 },
  { m: "Sep", cost: 90, revenue: 104 },
];

export const flowSteps = [
  { role: "Head Trainer", action: "Creates training plan", detail: "1,600 m · 80% workload · dirt" },
  { role: "Groom", action: "Receives daily schedule", detail: "Task queue at 06:00" },
  { role: "Groom", action: "Executes training prep", detail: "Sensor vest fitted, horse on track" },
  { role: "IoT sensors", action: "Stream realtime telemetry", detail: "HR · speed · GPS · temperature" },
  { role: "System", action: "Analyses heart rate & speed", detail: "Thresholds per horse profile" },
  { role: "Alert", action: "Abnormal condition detected", detail: "188 bpm sustained 42 s", critical: true },
  { role: "Veterinarian", action: "Receives critical alert", detail: "Escalation within 8 s" },
  { role: "Veterinarian", action: "Examines horse", detail: "Vitals, gait, injury mapping" },
  { role: "Veterinarian", action: "Locks training", detail: "Status → LOCKED", critical: true },
  { role: "System", action: "Notifies trainer + groom", detail: "Plan and tasks invalidated" },
  { role: "Head Trainer", action: "Adjusts training plan", detail: "Recovery: 800 m · 50% · light" },
  { role: "Groom", action: "Receives new schedule", detail: "Tomorrow 06:00 updated" },
  { role: "Veterinarian", action: "Tracks recovery", detail: "Recovery 65% · monitoring" },
  { role: "Horse Owner", action: "Views health & readiness", detail: "Transparent, calm summary" },
];
