import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { horseService } from "@/services/horse.service";
import { space } from "@/config/theme";

export default function HorseOwners() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const loadHorse = useCallback(() => horseService.get(token!, id), [id, token]);
  const resource = useApiResource(loadHorse, Boolean(token && id));
  const horse = resource.data;

  return (
    <Screen
      role="manager"
      title="Horse owner"
      subtitle={horse?.name ?? "Ownership record"}
      back
      fallbackHref="/manager/horses"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {horse ? (
        <>
          <View style={uiStyles.section}>
            <SectionTitle>Current ownership</SectionTitle>
            <Panel style={{ gap: space.md }}>
              <View>
                <Text style={uiStyles.label}>Horse</Text>
                <Text style={uiStyles.value}>{horse.name}</Text>
              </View>
              <View>
                <Text style={uiStyles.label}>Owner</Text>
                <Text style={uiStyles.value}>{horse.owner?.fullName ?? "Unassigned"}</Text>
              </View>
              <View>
                <Text style={uiStyles.label}>Ownership model</Text>
                <Text style={uiStyles.value}>One owner account</Text>
              </View>
            </Panel>
          </View>
          <Panel style={{ gap: space.sm }}>
            <Text style={uiStyles.value}>Ownership shares are not supported by the backend.</Text>
            <Text style={uiStyles.muted}>
              Horse records expose a single ownerId. This screen reads the current owner from the
              horse API and does not save unsupported percentage allocations.
            </Text>
          </Panel>
        </>
      ) : null}
    </Screen>
  );
}
