import { useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/common";
import { Chips } from "@/components/ui";
import { isRole } from "@/features/auth/roles";
import { FeedingPlansTab } from "../components/tabs/FeedingPlansTab";
import { HorseCareTasksTab } from "../components/tabs/HorseCareTasksTab";
import { DailyChecklistTab } from "../components/tabs/DailyChecklistTab";
import { HorseSurchargesTab } from "../components/tabs/HorseSurchargesTab";

export default function HorseStableCareScreen() {
  const {
    role: roleParam,
    id: horseIdParam,
    tab: tabParam,
  } = useLocalSearchParams<{
    role: string;
    id: string;
    tab?: string;
  }>();
  const role = isRole(roleParam) ? roleParam : "trainer";
  const horseId = Array.isArray(horseIdParam) ? horseIdParam[0] : horseIdParam;
  const initialTab = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const options = useMemo(() => {
    const tabs: string[] = [];
    if (["trainer", "manager", "vet", "groom"].includes(role)) tabs.push("Feeding plan");
    if (["trainer", "manager", "vet", "groom"].includes(role)) tabs.push("Care tasks");
    if (["manager", "trainer", "groom"].includes(role)) tabs.push("Daily checklist");
    if (["manager", "trainer", "owner"].includes(role)) tabs.push("Surcharges");
    return tabs;
  }, [role]);
  const [tab, setTab] = useState(() =>
    initialTab && options.includes(initialTab) ? initialTab : (options[0] ?? "Feeding plan"),
  );

  const visibleTab = options.includes(tab) ? tab : (options[0] ?? "Feeding plan");
  const title = "Stable care";

  return (
    <Screen
      role={role}
      title={title}
      subtitle="Feeding, scheduled care, daily checklists and surcharges"
      back
      fallbackHref={(horseId ? `/${role}/horse/${horseId}` : `/${role}/horses`) as any}
    >
      <Chips options={options} value={visibleTab} onChange={setTab} />
      {visibleTab === "Feeding plan" ? (
        <FeedingPlansTab role={role} horseId={horseId ?? ""} />
      ) : null}
      {visibleTab === "Care tasks" ? (
        <HorseCareTasksTab role={role} horseId={horseId ?? ""} />
      ) : null}
      {visibleTab === "Daily checklist" ? (
        <DailyChecklistTab role={role} horseId={horseId ?? ""} />
      ) : null}
      {visibleTab === "Surcharges" ? (
        <HorseSurchargesTab role={role} horseId={horseId ?? ""} />
      ) : null}
    </Screen>
  );
}

export { CareTaskTypesScreen } from "./CareTaskTypesScreen";
export { UnappliedSurchargesScreen } from "./UnappliedSurchargesScreen";
