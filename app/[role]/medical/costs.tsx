import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Chips, Field, NativeInput, Panel, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { isRole } from "@/features/auth/roles";
import { medicalService } from "@/services/medical.service";
import { clubDateTimeParts, isUuid, isValidDateOnly } from "@/features/medical/medical-validation";
import { stableService } from "@/services/stable.service";

export default function MedicalCostReport() {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const { token } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const today = clubDateTimeParts().date;
  const initialFrom = `${today.slice(0, 7)}-01`;
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(today);
  const [barnId, setBarnId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [query, setQuery] = useState({ from: initialFrom, to: today, barnId: "", ownerId: "" });
  const load = useCallback(
    () =>
      medicalService.getCostReport(token!, {
        from: query.from,
        to: query.to,
        ...(query.barnId ? { barnId: query.barnId } : {}),
        ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      }),
    [query, token],
  );
  const resource = useApiResource(load, Boolean(token && role === "manager"));
  useRefreshOnFocus(resource.revalidate);
  const loadBarns = useCallback(() => stableService.listBarns(token!), [token]);
  const barnsResource = useApiResource(loadBarns, Boolean(token && role === "manager"));
  const barns = barnsResource.data ?? [];

  if (!role) return <Redirect href="/" />;
  if (role !== "manager") return <Redirect href={`/${role}` as Href} />;

  const applyFilters = () => {
    if (!isValidDateOnly(from) || !isValidDateOnly(to) || from > to) {
      Alert.alert(
        "Invalid date range",
        "Enter valid dates and make sure the start is not after the end.",
      );
      return;
    }
    if (ownerId.trim() && !isUuid(ownerId.trim())) {
      Alert.alert("Invalid owner", "Enter a valid owner UUID or leave the filter empty.");
      return;
    }
    setQuery({ from, to, barnId, ownerId: ownerId.trim() });
  };

  return (
    <Screen
      role="manager"
      title="Medical cost report"
      subtitle="Closed cases by closing date"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      <View style={uiStyles.section}>
        <SectionTitle>Report filters</SectionTitle>
        <AsyncStateView
          isLoading={barnsResource.isLoading}
          error={barnsResource.error}
          onRetry={() => void barnsResource.retry()}
        />
        <Field label="From date (YYYY-MM-DD)">
          <NativeInput value={from} onChangeText={setFrom} />
        </Field>
        <Field label="To date (YYYY-MM-DD)">
          <NativeInput value={to} onChangeText={setTo} />
        </Field>
        <Chips
          options={["All barns", ...barns.map((barn) => barn.name)]}
          value={
            barnId ? (barns.find((barn) => barn.id === barnId)?.name ?? "All barns") : "All barns"
          }
          onChange={(value) => setBarnId(barns.find((barn) => barn.name === value)?.id ?? "")}
        />
        <Field label="Owner ID (optional)">
          <NativeInput value={ownerId} onChangeText={setOwnerId} placeholder="Owner UUID" />
        </Field>
        <SecondaryButton label="Apply filters" onPress={applyFilters} />
      </View>
      {resource.data ? (
        <>
          <View style={uiStyles.metricGrid}>
            <Panel>
              <Text style={uiStyles.label}>Closed cases</Text>
              <Text style={uiStyles.value}>{resource.data.caseCount}</Text>
            </Panel>
            <Panel>
              <Text style={uiStyles.label}>Total medical cost</Text>
              <Text style={uiStyles.value}>{resource.data.totalCost.toLocaleString()} VND</Text>
            </Panel>
          </View>
          <View style={uiStyles.section}>
            <SectionTitle>Cost by horse</SectionTitle>
            {resource.data.items.map((item) => (
              <Pressable
                key={item.horseId}
                onPress={() => router.push(`/manager/horse/${item.horseId}` as Href)}
              >
                <Panel>
                  <View style={uiStyles.row}>
                    <Text style={[uiStyles.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                      {item.horseName}
                    </Text>
                    <Text style={[uiStyles.value, { flexShrink: 0 }]}>
                      {item.totalCost.toLocaleString()} VND
                    </Text>
                  </View>
                  <Text style={uiStyles.muted}>
                    {item.caseCount} closed {item.caseCount === 1 ? "case" : "cases"}
                  </Text>
                </Panel>
              </Pressable>
            ))}
            {!resource.data.items.length ? (
              <Text style={uiStyles.muted}>No closed cases match this report range.</Text>
            ) : null}
          </View>
        </>
      ) : null}
      <Panel>
        <Text style={uiStyles.muted}>
          Totals come from the Manager-only Backend report endpoint; the mobile client does not
          recalculate case costs.
        </Text>
      </Panel>
    </Screen>
  );
}
