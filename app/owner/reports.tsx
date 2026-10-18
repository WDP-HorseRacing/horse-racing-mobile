import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Field, NativeInput, Panel, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { reportsService } from "@/services/reports.service";
import { isDateOnly } from "@/features/stable-care/stable-care-validation";
import { clubDate } from "@/utils/horse-validation";

export default function OwnerReports() {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const { token } = useAuth();
  const today = todayDate();
  const initialFrom = today.slice(0, 7) + "-01";
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(today);
  const [range, setRange] = useState({ from: initialFrom, to: today });
  const load = useCallback(
    () => reportsService.getOwnerCosts(token!, range.from, range.to),
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
      role="owner"
      title="Owner costs"
      subtitle={report ? report.from + " – " + report.to : "Monthly costs for your horses"}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <Field label="From · YYYY-MM-DD">
        <NativeInput value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
      </Field>
      <Field label="To · YYYY-MM-DD">
        <NativeInput value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />
      </Field>
      <SecondaryButton label="Load cost report" onPress={updateRange} />
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {report ? (
        <>
          <View style={ui.section}>
            <SectionTitle>Account summary · {report.ownerName}</SectionTitle>
            <Panel>
              <Row label="Daily boarding fees" value={money(report.dailyFee)} />
              <Row label="Medical costs" value={money(report.medicalCost)} />
              <Row label="Care surcharges" value={money(report.surcharge)} />
              <Row label="Total" value={money(report.total)} strong />
            </Panel>
          </View>
          <View style={ui.section}>
            <SectionTitle>Costs by horse</SectionTitle>
            {report.horses.length ? (
              report.horses.map((horse) => (
                <Panel key={horse.horseId}>
                  <Text style={ui.value}>{horse.horseName}</Text>
                  <Text style={ui.muted}>
                    {horse.billedDays} billed days · {horse.caseCount} medical cases
                  </Text>
                  <Row label="Daily fees" value={money(horse.dailyFee)} />
                  <Row label="Medical" value={money(horse.medicalCost)} />
                  <Row label="Surcharges" value={money(horse.surcharge)} />
                  <Row label="Total" value={money(horse.total)} strong />
                </Panel>
              ))
            ) : (
              <Text style={ui.muted}>No horse costs were recorded for this period.</Text>
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
