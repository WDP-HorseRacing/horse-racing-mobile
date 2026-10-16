import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { Metric, Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { reportsService } from "@/services/reports.service";
import { formatDate } from "@/utils/formatters";

export default function ManagerReports() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const from = `${today.getFullYear()}-${month}-01`;
  const to = `${today.getFullYear()}-${month}-${String(today.getDate()).padStart(2, "0")}`;
  const loadFinance = useCallback(() => reportsService.getClubFinance(token!, from, to), [token, from, to]);
  const resource = useApiResource(loadFinance, Boolean(token));
  const rows = useMemo(() => flattenFinance(resource.data), [resource.data]);

  return (
    <Screen
      role="manager"
      title="Club reports"
      subtitle={`${formatDate(from)} – ${formatDate(to)}`}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView isLoading={resource.isLoading} error={resource.error} onRetry={() => void resource.retry()} />
      {resource.error ? (
        <Panel>
          <Text style={uiStyles.value}>Finance data is not available yet</Text>
          <Text style={uiStyles.muted}>The mobile app requests GET /reports/club/finance. The current backend source returns 501 until that report service is implemented.</Text>
        </Panel>
      ) : null}
      {resource.data !== null ? (
        <View style={uiStyles.section}>
          <SectionTitle>Finance summary</SectionTitle>
          {rows.length ? rows.map((row) => (
            <Panel key={row.label}>
              <View style={uiStyles.row}>
                <Text style={uiStyles.muted}>{row.label}</Text>
                <Text style={uiStyles.value}>{row.value}</Text>
              </View>
            </Panel>
          )) : (
            <Metric label="Finance report" value="No summary values" hint="The API returned no scalar fields" />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function flattenFinance(value: unknown, prefix = ""): Array<{ label: string; value: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenFinance(item, prefix ? `${prefix} ${index + 1}` : `Item ${index + 1}`)).slice(0, 50);
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      flattenFinance(item, prefix ? `${prefix} · ${humanize(key)}` : humanize(key)),
    ).slice(0, 50);
  }
  if (value === null || value === undefined) return [];
  return [{ label: prefix || "Value", value: typeof value === "number" ? new Intl.NumberFormat("vi-VN").format(value) : String(value) }];
}

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
