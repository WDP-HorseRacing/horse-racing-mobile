import { type Href, Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { isRole } from "@/features/auth/roles";
import { useAuth } from "@/context/AuthContext";
import { Panel, getUiStyles } from "@/components/ui";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { useTheme } from "@/hooks/useTheme";

export default function Pedigree() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { role, id } = useLocalSearchParams<{ role: string; id: string }>();
  const horseId = Array.isArray(id) ? id[0] : id;
  const { token } = useAuth();
  const loadPedigree = useCallback(
    () => horseService.getPedigree(token!, horseId),
    [token, horseId],
  );
  const resource = useApiResource(loadPedigree, Boolean(token && horseId));
  if (!isRole(role)) return <Redirect href="/" />;

  return (
    <Screen
      role={role}
      title={`${resource.data?.horseName ?? "Horse"} pedigree`}
      subtitle="Two generations of ancestors"
      back
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {resource.data ? (
        <>
          <View style={uiStyles.section}>
            <SectionTitle>Horse</SectionTitle>
            <LineageCard title={resource.data.horseName} detail="Current horse" />
          </View>
          {[1, 2].map((generation) => {
            const ancestors = resource.data!.ancestors.filter(
              (item) => item.generation === generation,
            );
            return (
              <View key={generation} style={uiStyles.section}>
                <SectionTitle>{generation === 1 ? "Parents" : "Grandparents"}</SectionTitle>
                {ancestors.length ? (
                  ancestors.map((ancestor) => (
                    <Pressable
                      key={`${ancestor.id}-${ancestor.childId}-${ancestor.parentRole}`}
                      onPress={() =>
                        ancestor.canOpen && router.push(`/${role}/pedigree/${ancestor.id}` as Href)
                      }
                      disabled={!ancestor.canOpen}
                    >
                      <Panel>
                        <LineageCard
                          title={ancestor.name}
                          detail={`${ancestor.parentRole} · ${ancestor.breed ?? "Breed unknown"}${ancestor.color ? ` · ${ancestor.color}` : ""}`}
                          muted={!ancestor.canOpen}
                        />
                      </Panel>
                    </Pressable>
                  ))
                ) : (
                  <Panel>
                    <Text style={uiStyles.muted}>No ancestor records available.</Text>
                  </Panel>
                )}
              </View>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}

function LineageCard({
  title,
  detail,
  muted = false,
}: {
  title: string;
  detail: string;
  muted?: boolean;
}) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  return (
    <View style={{ gap: 4 }}>
      <Text style={[uiStyles.value, muted && { color: colors.mutedForeground }]}>{title}</Text>
      <Text style={uiStyles.muted}>{detail}</Text>
    </View>
  );
}
