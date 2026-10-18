import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { reportsService } from "@/services/reports.service";
import { isDateOnly } from "@/features/stable-care/stable-care-validation";
import { clubDate } from "@/utils/horse-validation";

export default function ManagerReports() {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const { token } = useAuth();
  const today = todayDate();
  const initialFrom = today.slice(0, 7) + "-01";
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(today);
  const [range, setRange] = useState({ from: initialFrom, to: today });
  const load = useCallback(
    () => reportsService.getClubFinance(token!, range.from, range.to),
    [range.from, range.to, token],
  );
  const resource = useApiResource(load, Boolean(token));
  const updateRange = () => {
    if (!isDateOnly(from) || !isDateOnly(to) || from > to) {
      Alert.alert("Check report dates", "Enter valid dates and make sure From is not after To.");
      return;
    }
    setRange({ from, to });
  };
  const report = resource.data;

  return (
    <Screen
      role="manager"
      title="Club reports"
      subtitle={report ? report.from + " – " + report.to : "Financial summary by date range"}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <Field label="From · YYYY-MM-DD">
        <NativeInput value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
      </Field>
      <Field label="To · YYYY-MM-DD">
        <NativeInput value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />
      </Field>
      <SecondaryButton label="Load report" onPress={updateRange} />
      <PrimaryButton
        label="Review unapplied surcharges"
        icon="cash-outline"
        onPress={() => router.push("/manager/surcharges")}
      />
      <SecondaryButton
        label="Manage daily boarding fees"
        onPress={() => router.push("/manager/daily-fees")}
      />
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {report ? (
        <>
          <View style={ui.section}>
            <SectionTitle>Owner charges · VND</SectionTitle>
            <Panel>
              <Row label="Daily boarding fees" value={money(report.ownerCharges.dailyFee)} />
              <Row label="Medical costs" value={money(report.ownerCharges.medicalCost)} />
              <Row label="Care surcharges" value={money(report.ownerCharges.surcharge)} />
              <Row label="Total" value={money(report.ownerCharges.total)} strong />
            </Panel>
          </View>
          <View style={ui.section}>
            <SectionTitle>Supply costs · VND</SectionTitle>
            <Panel>
              <Row label="Purchased" value={money(report.supplies.purchased)} />
              <Row label="Used" value={money(report.supplies.used)} />
            </Panel>
          </View>
          <View style={ui.section}>
            <SectionTitle>By horse owner</SectionTitle>
            {report.owners.length ? (
              report.owners.map((owner) => (
                <Panel key={owner.ownerId}>
                  <Text style={ui.value}>{owner.ownerName}</Text>
                  <Row label="Daily fees" value={money(owner.dailyFee)} />
                  <Row label="Medical" value={money(owner.medicalCost)} />
                  <Row label="Surcharges" value={money(owner.surcharge)} />
                  <Row label="Total" value={money(owner.total)} strong />
                </Panel>
              ))
            ) : (
              <Text style={ui.muted}>No owner charges were recorded for this period.</Text>
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  return (
    <View style={ui.row}>
      <Text style={strong ? ui.value : ui.muted}>{label}</Text>
      <Text style={ui.value}>{value}</Text>
    </View>
  );
}
function money(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value) + " ₫";
}
function todayDate(): string {
  return clubDate();
}
