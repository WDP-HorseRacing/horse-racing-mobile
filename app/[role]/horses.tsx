import { Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { isRole } from "@/features/auth/roles";
import { Chips, getUiStyles, SecondaryButton } from "@/components/ui";
import { Screen } from "@/components/common";
import { HorseRow } from "@/features/horses/components/HorseRow";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { horseService, type HorseListFilters } from "@/services/horse.service";
import { mapHorseSummary, mapHorseSummaryToPrototype } from "@/adapters/horse.adapter";
import { stableService } from "@/services/stable.service";
import { filterHorsesBySearch } from "@/utils/horse-validation";

const HEALTH_FILTERS = ["All", "ELIGIBLE", "UNDER_OBSERVATION", "INJURED", "QUARANTINED"] as const;
const LIFECYCLE_FILTERS = ["All", "ACTIVE", "RETIRED", "TRANSFERRED", "DECEASED"] as const;
const GENDER_FILTERS = ["All", "MALE", "FEMALE", "GELDING"] as const;
const APTITUDE_FILTERS = ["All", "SPRINTER", "MILER", "STAYER"] as const;
const PLACEMENT_FILTERS = [
  "All",
  "PENDING_BARN",
  "PENDING_STALL",
  "PLACED",
  "NOT_APPLICABLE",
] as const;

export default function Horses() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const { role } = useLocalSearchParams<{ role: string }>();
  const { token } = useAuth();
  const isManager = role === "manager";
  const isTrainer = role === "trainer";
  const isGroom = role === "groom";
  const isOwner = role === "owner";
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState<HorseListFilters["healthStatus"] | "">("");
  const [filters, setFilters] = useState<Omit<HorseListFilters, "healthStatus">>(() =>
    role === "trainer" ? { myBarns: true } : role === "groom" ? { myHorses: true } : {},
  );
  const [filterDraft, setFilterDraft] = useState<Omit<HorseListFilters, "healthStatus">>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const serverSearch = /^[\da-f-]{3,36}$/i.test(search) ? "" : search;
  const appliedFilters = useMemo<HorseListFilters>(
    () => ({
      ...filters,
      ...(health ? { healthStatus: health } : {}),
    }),
    [filters, health],
  );
  const loadHorses = useCallback(
    () => horseService.list(token!, serverSearch, appliedFilters),
    [appliedFilters, serverSearch, token],
  );
  const resource = useApiResource(loadHorses, Boolean(token));
  const refreshRef = useRef(resource.revalidate);
  const focusedOnce = useRef(false);
  useEffect(() => {
    refreshRef.current = resource.revalidate;
  }, [resource.revalidate]);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) void refreshRef.current();
      else focusedOnce.current = true;
      return undefined;
    }, []),
  );
  const loadBarns = useCallback(() => stableService.listBarns(token!), [token]);
  const barnsResource = useApiResource(loadBarns, Boolean(token) && !isOwner);
  const horses = useMemo(
    () => filterHorsesBySearch(resource.data ?? [], search),
    [resource.data, search],
  );
  const filterCount = useMemo(
    () =>
      Object.values(filters).filter(
        (value) => value !== undefined && value !== false && value !== "",
      ).length + (health ? 1 : 0),
    [filters, health],
  );
  const activeFilterLabels = useMemo(
    () => [
      ...(health ? [`Health: ${health.replaceAll("_", " ")}`] : []),
      ...(filters.lifecycleStatus ? [`Lifecycle: ${filters.lifecycleStatus}`] : []),
      ...(filters.gender ? [`Gender: ${filters.gender}`] : []),
      ...(filters.raceAptitude ? [`Aptitude: ${filters.raceAptitude}`] : []),
      ...(filters.placementStatus
        ? [`Placement: ${filters.placementStatus.replaceAll("_", " ")}`]
        : []),
      ...(filters.barnId
        ? [
            `Barn: ${barnsResource.data?.find((barn) => barn.id === filters.barnId)?.name ?? filters.barnId.slice(0, 8)}`,
          ]
        : []),
      ...(filters.myBarns ? ["My barns"] : []),
      ...(filters.myHorses ? ["Assigned to me"] : []),
      ...(filters.includeDeleted ? ["Deleted profiles"] : []),
    ],
    [barnsResource.data, filters, health],
  );

  if (!isRole(role)) return <Redirect href="/" />;

  const resetFilters = () => {
    setHealth("");
    setFilters({});
    setFilterDraft({});
  };
  const openFilters = () => {
    setFilterDraft(filters);
    setFiltersOpen(true);
  };
  const applyFilterDraft = () => {
    setFilters(filterDraft);
    setFiltersOpen(false);
  };

  return (
    <Screen role={role} title={isOwner ? "My horses" : "Horses"} scrollable={false}>
      <FlatList
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
        data={resource.data ? horses : []}
        keyExtractor={(item) => item.id}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        refreshing={resource.isRefreshing || barnsResource.isRefreshing}
        onRefresh={() => void Promise.all([resource.refresh(), barnsResource.refresh()])}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        renderItem={({ item }) => {
          const summary = mapHorseSummary(item);
          const location =
            item.location.placementStatus === "PLACED"
              ? `${item.location.barn?.name ?? "Barn"} · ${item.location.stall?.code ?? "Stall"}`
              : item.location.placementStatus.replaceAll("_", " ");
          return (
            <HorseRow
              horse={mapHorseSummaryToPrototype(summary)}
              role={role}
              photoUrl={item.photoUrl}
              horseId={item.id}
              location={location}
              aptitude={item.raceAptitude}
              lifecycleStatus={item.isDeleted ? "DELETED" : item.lifecycleStatus}
            />
          );
        }}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.searchRow}>
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Search name, Horse ID or microchip"
                placeholderTextColor={colors.mutedForeground}
                style={styles.search}
                autoCapitalize="none"
                returnKeyType="search"
              />
              <Pressable
                accessibilityRole="button"
                onPress={openFilters}
                style={styles.filterButton}
              >
                <Text style={styles.filterButtonText}>
                  {filterCount ? `Filters · ${filterCount}` : "Filters"}
                </Text>
              </Pressable>
            </View>
            <Chips
              options={[...HEALTH_FILTERS]}
              value={health || "All"}
              onChange={(value) =>
                setHealth(value === "All" ? "" : (value as HorseListFilters["healthStatus"]))
              }
            />
            {filterCount > 0 ? (
              <View style={styles.activeFilters}>
                <Text style={uiStyles.muted}>
                  {activeFilterLabels.join(" · ") || `${filterCount} active filters`}
                </Text>
                <Pressable accessibilityRole="button" onPress={resetFilters}>
                  <Text style={styles.clearText}>Clear all</Text>
                </Pressable>
              </View>
            ) : null}
            {resource.data ? (
              <View style={styles.resultsHeader}>
                <Text style={uiStyles.label}>{horses.length} horses</Text>
                {isManager ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push("/manager/register-horse")}
                    style={styles.addButton}
                  >
                    <Text style={styles.addText}>+ Register</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <AsyncStateView
            isLoading={resource.isLoading}
            error={resource.error}
            onRetry={() => void resource.retry()}
            empty={Boolean(resource.data)}
            emptyLabel={
              resource.data?.length
                ? "No horses match these filters."
                : "No horses are available for this account."
            }
          />
        }
      />

      <Modal
        visible={filtersOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Advanced filters</Text>
              <Pressable accessibilityRole="button" onPress={applyFilterDraft}>
                <Text style={styles.clearText}>Done</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <FilterGroup
                title="Lifecycle"
                values={[...LIFECYCLE_FILTERS]}
                value={filterDraft.lifecycleStatus ?? "All"}
                onChange={(value) =>
                  setFilterDraft({
                    ...filterDraft,
                    lifecycleStatus:
                      value === "All" ? undefined : (value as HorseListFilters["lifecycleStatus"]),
                  })
                }
              />
              <FilterGroup
                title="Gender"
                values={[...GENDER_FILTERS]}
                value={filterDraft.gender ?? "All"}
                onChange={(value) =>
                  setFilterDraft({
                    ...filterDraft,
                    gender: value === "All" ? undefined : (value as HorseListFilters["gender"]),
                  })
                }
              />
              <FilterGroup
                title="Race aptitude"
                values={[...APTITUDE_FILTERS]}
                value={filterDraft.raceAptitude ?? "All"}
                onChange={(value) =>
                  setFilterDraft({
                    ...filterDraft,
                    raceAptitude:
                      value === "All" ? undefined : (value as HorseListFilters["raceAptitude"]),
                  })
                }
              />
              <FilterGroup
                title="Placement"
                values={[...PLACEMENT_FILTERS]}
                value={filterDraft.placementStatus ?? "All"}
                onChange={(value) =>
                  setFilterDraft({
                    ...filterDraft,
                    placementStatus:
                      value === "All" ? undefined : (value as HorseListFilters["placementStatus"]),
                  })
                }
              />
              {barnsResource.error ? (
                <AsyncStateView
                  isLoading={false}
                  error={barnsResource.error}
                  onRetry={() => void barnsResource.retry()}
                />
              ) : null}
              {!isOwner && barnsResource.data?.length ? (
                <View style={styles.filterGroup}>
                  <Text style={uiStyles.label}>Barn</Text>
                  <SelectionRow
                    label="All barns"
                    selected={!filterDraft.barnId}
                    onPress={() => setFilterDraft({ ...filterDraft, barnId: undefined })}
                  />
                  {barnsResource.data.map((barn) => (
                    <SelectionRow
                      key={barn.id}
                      label={barn.name}
                      selected={filterDraft.barnId === barn.id}
                      onPress={() => setFilterDraft({ ...filterDraft, barnId: barn.id })}
                    />
                  ))}
                </View>
              ) : null}
              {isTrainer ? (
                <FilterToggle
                  label="My barns"
                  value={filterDraft.myBarns === true}
                  onChange={(value) =>
                    setFilterDraft({ ...filterDraft, myBarns: value || undefined })
                  }
                />
              ) : null}
              {isGroom ? (
                <FilterToggle
                  label="Horses assigned to me"
                  value={filterDraft.myHorses === true}
                  onChange={(value) =>
                    setFilterDraft({ ...filterDraft, myHorses: value || undefined })
                  }
                />
              ) : null}
              {isManager ? (
                <FilterToggle
                  label="Include deleted profiles"
                  value={filterDraft.includeDeleted === true}
                  onChange={(value) =>
                    setFilterDraft({ ...filterDraft, includeDeleted: value || undefined })
                  }
                />
              ) : null}
              <View style={styles.sheetActions}>
                <SecondaryButton label="Clear all" onPress={() => setFilterDraft({})} />
                <SecondaryButton label="Show results" onPress={applyFilterDraft} icon="checkmark" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function FilterGroup({
  title,
  values,
  value,
  onChange,
}: {
  title: string;
  values: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  return (
    <View style={{ gap: space.sm }}>
      <Text style={uiStyles.label}>{title}</Text>
      <Chips options={values} value={value} onChange={onChange} />
    </View>
  );
}

function SelectionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.selectionRow, selected && styles.selectionSelected]}
    >
      <Text style={selected ? styles.selectionTextSelected : styles.selectionText}>{label}</Text>
    </Pressable>
  );
}

function FilterToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.selectionText}>{label}</Text>
      <Chips
        options={["Off", "On"]}
        value={value ? "On" : "Off"}
        onChange={(next) => onChange(next === "On")}
      />
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    searchRow: { flexDirection: "row", gap: space.sm },
    flatList: { flex: 1 },
    flatListContent: {
      paddingHorizontal: space.lg,
      paddingTop: space.lg,
      paddingBottom: 116,
    },
    listHeader: { gap: space.xl, paddingBottom: space.xl },
    itemSeparator: { height: space.sm },
    search: {
      minHeight: 50,
      flex: 1,
      color: colors.foreground,
      paddingHorizontal: space.lg,
      fontSize: 14,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterButton: {
      minHeight: 50,
      paddingHorizontal: space.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterButtonText: { color: colors.foreground, fontSize: 13, fontWeight: "700" },
    activeFilters: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    clearText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
    resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    addButton: {
      minHeight: 36,
      paddingHorizontal: space.md,
      justifyContent: "center",
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
    },
    addText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
    sheet: {
      maxHeight: "88%",
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: space.sm,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 42,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: radius.pill,
      marginBottom: space.sm,
    },
    sheetHeader: {
      minHeight: 52,
      paddingHorizontal: space.lg,
      alignItems: "center",
      justifyContent: "space-between",
      flexDirection: "row",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sheetTitle: { color: colors.foreground, fontSize: 18, fontWeight: "800" },
    sheetContent: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2 },
    filterGroup: { gap: space.sm },
    selectionRow: {
      minHeight: 44,
      paddingHorizontal: space.md,
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectionSelected: { borderColor: colors.primary, backgroundColor: colors.fitSoft },
    selectionText: { color: colors.foreground, fontSize: 14 },
    selectionTextSelected: { color: colors.primary, fontSize: 14, fontWeight: "700" },
    toggleRow: { gap: space.sm },
    sheetActions: { gap: space.sm },
  });
