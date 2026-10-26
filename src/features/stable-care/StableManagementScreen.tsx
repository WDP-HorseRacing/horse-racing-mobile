import { type Href, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Chips,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import {
  stableService,
  type BarnListItemDto,
  type GroomWorkloadDto,
  type StallDto,
} from "@/services/stable.service";
import { horseService, type HorseHealthStatusDto } from "@/services/horse.service";
import {
  stableCareService,
  type ChecklistStatus,
} from "@/services/stable-care.service";
import { usersService } from "@/services/users.service";
import type { StaffDto } from "@/adapters/staff.adapter";
import type { HorseListItemDto } from "@/adapters/horse.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatEnum } from "@/utils/formatters";
import { clubDate } from "@/utils/horse-validation";
import { radius, space } from "@/config/theme";
import type { RoleId } from "@/types/raceos";

function suggestNextStallCode(barnName: string, existingStalls: StallDto[]): string {
  const prefixMatch = barnName.match(/Khu\s*([A-Za-z0-9]+)/i);
  const prefix = prefixMatch
    ? `${prefixMatch[1].toUpperCase()}-`
    : `${barnName.slice(0, 1).toUpperCase()}-`;
  let maxNum = 0;
  for (const s of existingStalls) {
    if (s.code.toUpperCase().startsWith(prefix)) {
      const numPart = parseInt(s.code.slice(prefix.length), 10);
      if (!Number.isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(2, "0")}`;
}

export type HorseCareSummary = {
  horseId: string;
  groomName: string | null;
  checklistStatus: ChecklistStatus | "NOT_GENERATED";
  checklistProgress?: { done: number; total: number };
  feedingPlanStatus: "ACTIVE" | "NONE";
  feedingPlanMealsCount?: number;
  openIncidentsCount: number;
};

type StablePayload = {
  barns: BarnListItemDto[];
  stalls: StallDto[];
  horses: HorseListItemDto[];
  grooms: GroomWorkloadDto[];
};

export function StableManagementScreen({ role }: { role: RoleId }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();

  const [activeBarnIndex, setActiveBarnIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const pagerRef = useRef<ScrollViewInstance>(null);

  // Selected stall for bottom sheet / modal interaction
  const [selectedStall, setSelectedStall] = useState<StallDto | null>(null);

  // Unassigned tab (Section 4.3): 'barn' = pending barn, 'stall' = pending stall, 'groom' = pending groom
  const [unassignedTab, setUnassignedTab] = useState<"barn" | "stall" | "groom">("barn");

  // Create Barn modal state (Section 4.1)
  const [showCreateBarnModal, setShowCreateBarnModal] = useState(false);
  const [newBarnName, setNewBarnName] = useState("");
  const [newBarnCapacity, setNewBarnCapacity] = useState("9");
  const [newBarnDescription, setNewBarnDescription] = useState("");
  const [creatingBarn, setCreatingBarn] = useState(false);

  // Edit Barn modal state
  const [showEditBarnModal, setShowEditBarnModal] = useState(false);
  const [editingBarn, setEditingBarn] = useState<BarnListItemDto | null>(null);
  const [editBarnName, setEditBarnName] = useState("");
  const [editBarnCapacity, setEditBarnCapacity] = useState("9");
  const [editBarnDescription, setEditBarnDescription] = useState("");
  const [editBarnHeadTrainerId, setEditBarnHeadTrainerId] = useState<string>("");
  const [editBarnStatus, setEditBarnStatus] = useState<string>("ACTIVE");
  const [savingBarn, setSavingBarn] = useState(false);

  // Create Stall modal state (Section 4.2)
  const [showCreateStallModal, setShowCreateStallModal] = useState(false);
  const [targetBarnForStall, setTargetBarnForStall] = useState<BarnListItemDto | null>(null);
  const [newStallCode, setNewStallCode] = useState("");
  const [newStallType, setNewStallType] = useState<"STANDARD" | "ISOLATION" | "RECOVERY">(
    "STANDARD",
  );
  const [newStallDescription, setNewStallDescription] = useState("");
  const [newStallHasCamera, setNewStallHasCamera] = useState(false);
  const [creatingStall, setCreatingStall] = useState(false);

  // Edit Stall modal state
  const [showEditStallModal, setShowEditStallModal] = useState(false);
  const [editingStall, setEditingStall] = useState<StallDto | null>(null);
  const [editStallCode, setEditStallCode] = useState("");
  const [editStallType, setEditStallType] = useState<"STANDARD" | "ISOLATION" | "RECOVERY">(
    "STANDARD",
  );
  const [editStallDescription, setEditStallDescription] = useState("");
  const [editStallHasCamera, setEditStallHasCamera] = useState(false);
  const [savingStall, setSavingStall] = useState(false);
  const [releasingStall, setReleasingStall] = useState(false);

  const loadTrainers = useCallback(() => usersService.list(token!), [token]);
  const trainersResource = useApiResource(loadTrainers, Boolean(token && role === "manager"));
  const activeHeadTrainers = useMemo(
    () =>
      (trainersResource.data ?? []).filter(
        (u: StaffDto) => u.role === "HEAD_TRAINER" && u.status === "ACTIVE",
      ),
    [trainersResource.data],
  );

  const loadStable = useCallback(async (): Promise<StablePayload> => {
    const [barns, grooms] = await Promise.all([
      stableService.listBarns(token!),
      stableService.listGroomWorkload(token!),
    ]);

    const horses =
      role === "trainer"
        ? await horseService
            .list(token!, "", { myBarns: true })
            .catch(() => horseService.list(token!))
        : await horseService.list(token!);

    // Load stalls for all barns
    let stalls: StallDto[] = [];
    try {
      const stallGroups = await Promise.all(
        barns.map((barn) => stableService.listBarnStalls(token!, barn.id)),
      );
      stalls = stallGroups.flat();
    } catch {
      stalls = await stableService.listStalls(token!).catch(() => []);
    }

    return { barns, stalls, horses, grooms };
  }, [token, role]);

  const resource = useApiResource(loadStable, Boolean(token));
  useRefreshOnFocus(resource.revalidate);
  const payload = resource.data;

  // Map horses by stall ID and by barn:stallCode
  const horseMap = useMemo(() => {
    const map = new Map<string, HorseListItemDto>();
    for (const h of payload?.horses ?? []) {
      if (h.location.stall?.id) {
        map.set(`id:${h.location.stall.id}`, h);
      }
      if (h.location.stall?.code && h.location.barn?.id) {
        map.set(`code:${h.location.barn.id}:${h.location.stall.code.toLowerCase()}`, h);
      }
    }
    return map;
  }, [payload?.horses]);

  const getHorseInStall = useCallback(
    (stall: StallDto, barnId: string): HorseListItemDto | undefined => {
      return (
        horseMap.get(`id:${stall.id}`) ?? horseMap.get(`code:${barnId}:${stall.code.toLowerCase()}`)
      );
    },
    [horseMap],
  );

  // Unassigned horses (Awaiting placement)
  const pendingBarnHorses = useMemo(() => {
    return (payload?.horses ?? []).filter((h) => h.location.placementStatus === "PENDING_BARN");
  }, [payload?.horses]);

  const pendingStallHorses = useMemo(() => {
    return (payload?.horses ?? []).filter((h) => h.location.placementStatus === "PENDING_STALL");
  }, [payload?.horses]);

  const pendingGroomHorses = useMemo(() => {
    return (payload?.horses ?? []).filter(
      (h) => h.location.placementStatus === "PENDING_GROOM",
    );
  }, [payload?.horses]);

  const totalAwaitingPlacement =
    pendingBarnHorses.length + pendingStallHorses.length + pendingGroomHorses.length;
  const occupiedCount = payload?.stalls.filter((stall) => stall.status === "OCCUPIED").length ?? 0;

  const currentBarn = payload?.barns[activeBarnIndex];
  const currentBarnStalls = useMemo(() => {
    if (!currentBarn) return [];
    return (payload?.stalls ?? []).filter((s) => s.barnId === currentBarn.id);
  }, [payload?.stalls, currentBarn]);

  // Horses in current barn awaiting stall placement
  const pendingInCurrentBarn = useMemo(() => {
    if (!currentBarn) return [];
    return pendingStallHorses.filter((h) => h.location.barn?.id === currentBarn.id);
  }, [pendingStallHorses, currentBarn]);

  // All placed horses in current barn
  const horsesInCurrentBarn = useMemo(() => {
    if (!currentBarn) return [];
    return (payload?.horses ?? []).filter(
      (h) => h.location.barn?.id === currentBarn.id && Boolean(h.location.stall),
    );
  }, [payload?.horses, currentBarn]);

  const selectedHorseInModal = useMemo(() => {
    if (!selectedStall || !currentBarn) return undefined;
    return getHorseInStall(selectedStall, currentBarn.id);
  }, [selectedStall, currentBarn, getHorseInStall]);

  // Overview stats for current barn
  const barnMetrics = useMemo(() => {
    const total = currentBarnStalls.length;
    const occupied = currentBarnStalls.filter((s) => {
      if (s.status === "OCCUPIED") return true;
      if (!currentBarn) return false;
      return Boolean(getHorseInStall(s, currentBarn.id));
    }).length;
    const vacant = currentBarnStalls.filter((s) => {
      if (s.status !== "AVAILABLE") return false;
      if (!currentBarn) return true;
      return !getHorseInStall(s, currentBarn.id);
    }).length;
    const attention = currentBarnStalls.filter((s) => {
      if (!currentBarn) return false;
      const h = getHorseInStall(s, currentBarn.id);
      return (
        h &&
        (h.healthStatus === "UNDER_OBSERVATION" ||
          h.healthStatus === "INJURED" ||
          h.healthStatus === "QUARANTINED")
      );
    }).length;
    return { total, occupied, vacant, attention };
  }, [currentBarnStalls, currentBarn, getHorseInStall]);

  // Sub-view: "stalls" (Sơ đồ ô chuồng) vs "care" (Tổng quan chăm sóc theo ngựa - Step G1)
  const [barnViewMode, setBarnViewMode] = useState<"stalls" | "care">("stalls");
  const [careSummaries, setCareSummaries] = useState<Record<string, HorseCareSummary>>({});
  const [loadingCare, setLoadingCare] = useState(false);

  const loadCareOverview = useCallback(async () => {
    if (!token || !currentBarn) return;
    const targetHorses = (payload?.horses ?? []).filter(
      (h) => h.location.barn?.id === currentBarn.id,
    );
    if (targetHorses.length === 0) {
      setCareSummaries({});
      return;
    }

    setLoadingCare(true);
    const todayStr = clubDate();

    try {
      const openIncidents = await stableCareService
        .listIncidents(token, { barnId: currentBarn.id, status: "OPEN" })
        .catch(() => []);

      const incidentsByHorse: Record<string, number> = {};
      for (const inc of openIncidents) {
        incidentsByHorse[inc.horseId] = (incidentsByHorse[inc.horseId] ?? 0) + 1;
      }

      const results = await Promise.allSettled(
        targetHorses.map(async (horse) => {
          const [horseDetail, checklists, feedingPlans] = await Promise.all([
            horseService.get(token, horse.id).catch(() => null),
            stableCareService.listChecklists(token, horse.id, todayStr, todayStr).catch(() => []),
            stableCareService.listFeedingPlans(token, horse.id, "ACTIVE").catch(() => []),
          ]);

          const todayChecklist = checklists[0];
          let checklistStatus: ChecklistStatus | "NOT_GENERATED" = "NOT_GENERATED";
          let checklistProgress: { done: number; total: number } | undefined;

          if (todayChecklist) {
            checklistStatus = todayChecklist.status;
            const done = todayChecklist.items.filter((item) => item.done).length;
            checklistProgress = { done, total: todayChecklist.items.length };
          }

          const activePlan = feedingPlans[0];
          const feedingPlanStatus = activePlan ? "ACTIVE" : "NONE";
          const feedingPlanMealsCount = activePlan?.meals?.length ?? 0;

          return {
            horseId: horse.id,
            groomName: horseDetail?.groom?.fullName ?? null,
            checklistStatus,
            checklistProgress,
            feedingPlanStatus,
            feedingPlanMealsCount,
            openIncidentsCount: incidentsByHorse[horse.id] ?? 0,
          } as HorseCareSummary;
        }),
      );

      const summaries: Record<string, HorseCareSummary> = {};
      for (const res of results) {
        if (res.status === "fulfilled") {
          summaries[res.value.horseId] = res.value;
        }
      }
      setCareSummaries((prev) => ({ ...prev, ...summaries }));
    } finally {
      setLoadingCare(false);
    }
  }, [token, currentBarn, payload?.horses]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (barnViewMode === "care") {
      timer = setTimeout(() => {
        void loadCareOverview();
      }, 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [barnViewMode, activeBarnIndex, loadCareOverview]);

  const careCompletedCount = useMemo(() => {
    return horsesInCurrentBarn.filter(
      (h) => careSummaries[h.id]?.checklistStatus === "COMPLETED",
    ).length;
  }, [horsesInCurrentBarn, careSummaries]);

  const careIncidentCount = useMemo(() => {
    return horsesInCurrentBarn.reduce(
      (sum, h) => sum + (careSummaries[h.id]?.openIncidentsCount ?? 0),
      0,
    );
  }, [horsesInCurrentBarn, careSummaries]);

  const handleSelectBarn = (index: number) => {
    setActiveBarnIndex(index);
    if (containerWidth > 0) {
      pagerRef.current?.scrollTo({ x: index * containerWidth, animated: true });
    }
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (containerWidth > 0) {
      const newIndex = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
      if (newIndex >= 0 && newIndex < (payload?.barns.length ?? 0)) {
        setActiveBarnIndex(newIndex);
      }
    }
  };

  const renderHealthBadge = (status: HorseHealthStatusDto) => {
    switch (status) {
      case "INJURED":
        return (
          <View style={[styles.healthBadge, { backgroundColor: colors.injuredSoft }]}>
            <Ionicons name="warning" size={11} color={colors.destructive} />
            <Text style={[styles.healthBadgeText, { color: colors.destructive }]}>
              {t("Injured")}
            </Text>
          </View>
        );
      case "UNDER_OBSERVATION":
        return (
          <View style={[styles.healthBadge, { backgroundColor: colors.monitorSoft }]}>
            <Ionicons name="eye-outline" size={11} color={colors.monitor} />
            <Text style={[styles.healthBadgeText, { color: colors.monitor }]}>
              {t("Under observation")}
            </Text>
          </View>
        );
      case "QUARANTINED":
        return (
          <View style={[styles.healthBadge, { backgroundColor: colors.lockedSoft }]}>
            <Ionicons name="lock-closed" size={11} color={colors.locked} />
            <Text style={[styles.healthBadgeText, { color: colors.locked }]}>
              {t("Quarantined")}
            </Text>
          </View>
        );
      default:
        return (
          <View style={[styles.healthBadge, { backgroundColor: colors.fitSoft }]}>
            <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
            <Text style={[styles.healthBadgeText, { color: colors.primary }]}>{t("Eligible")}</Text>
          </View>
        );
    }
  };

  const renderChecklistCareBadge = (
    status: ChecklistStatus | "NOT_GENERATED",
    progress?: { done: number; total: number },
  ) => {
    switch (status) {
      case "COMPLETED":
        return (
          <View style={[styles.careStatusBadge, { backgroundColor: colors.fitSoft }]}>
            <Ionicons name="checkmark-circle" size={11} color={colors.primary} />
            <Text style={[styles.careStatusBadgeText, { color: colors.primary }]}>
              {t("Completed")} {progress ? `(${progress.done}/${progress.total})` : ""}
            </Text>
          </View>
        );
      case "IN_PROGRESS":
        return (
          <View style={[styles.careStatusBadge, { backgroundColor: colors.monitorSoft }]}>
            <Ionicons name="time" size={11} color={colors.monitor} />
            <Text style={[styles.careStatusBadgeText, { color: colors.monitor }]}>
              {t("In progress")} {progress ? `(${progress.done}/${progress.total})` : ""}
            </Text>
          </View>
        );
      case "INCOMPLETE":
        return (
          <View style={[styles.careStatusBadge, { backgroundColor: colors.injuredSoft }]}>
            <Ionicons name="alert-circle" size={11} color={colors.destructive} />
            <Text style={[styles.careStatusBadgeText, { color: colors.destructive }]}>
              {t("Incomplete")}
            </Text>
          </View>
        );
      case "CANCELLED":
        return (
          <View style={[styles.careStatusBadge, { backgroundColor: colors.elevated }]}>
            <Ionicons name="close-circle" size={11} color={colors.mutedForeground} />
            <Text style={[styles.careStatusBadgeText, { color: colors.mutedForeground }]}>
              {t("Cancelled")}
            </Text>
          </View>
        );
      case "PENDING":
        return (
          <View style={[styles.careStatusBadge, { backgroundColor: colors.elevated }]}>
            <Ionicons name="ellipse-outline" size={11} color={colors.mutedForeground} />
            <Text style={[styles.careStatusBadgeText, { color: colors.mutedForeground }]}>
              {t("Pending")} {progress ? `(0/${progress.total})` : ""}
            </Text>
          </View>
        );
      default:
        return (
          <Text style={[styles.careAspectValue, { color: colors.mutedForeground }]}>
            {t("Not generated")}
          </Text>
        );
    }
  };

  const openCreateBarnModal = () => {
    setNewBarnName("");
    setNewBarnCapacity("9");
    setNewBarnDescription("");
    setShowCreateBarnModal(true);
  };

  const handleCreateBarn = async () => {
    if (!token || !newBarnName.trim()) return;
    const cap = Number(newBarnCapacity);
    if (newBarnCapacity.trim() && (!Number.isInteger(cap) || cap < 1 || cap > 9)) {
      return Alert.alert(t("Capacity is 1–9 stalls"));
    }
    setCreatingBarn(true);
    try {
      const created = await stableService.createBarn(token, {
        name: newBarnName.trim(),
        capacity: newBarnCapacity.trim() ? cap : 9,
        description: newBarnDescription.trim() || undefined,
      });
      await resource.refresh();
      setShowCreateBarnModal(false);
      Alert.alert(t("Create barn"), `${t("Barn")} ${created.name} ${t("done").toLowerCase()}`);
    } catch (error) {
      Alert.alert(t("Create barn"), extractErrorMessage(error));
    } finally {
      setCreatingBarn(false);
    }
  };

  const openCreateStallModal = (barn: BarnListItemDto) => {
    setTargetBarnForStall(barn);
    const barnStalls = (payload?.stalls ?? []).filter((s) => s.barnId === barn.id);
    const suggested = suggestNextStallCode(barn.name, barnStalls);
    setNewStallCode(suggested);
    setNewStallType("STANDARD");
    setNewStallDescription("");
    setNewStallHasCamera(false);
    setShowCreateStallModal(true);
  };

  const handleCreateStall = async () => {
    if (!token || !targetBarnForStall || !newStallCode.trim()) return;
    setCreatingStall(true);
    try {
      await stableService.createStall(token, {
        barnId: targetBarnForStall.id,
        code: newStallCode.trim(),
        type: newStallType,
        description: newStallDescription.trim() || undefined,
        hasCamera: newStallHasCamera,
      });
      await resource.refresh();
      setShowCreateStallModal(false);
      Alert.alert(
        t("Create stall"),
        `${t("Stall")} ${newStallCode.trim()} ${t("done").toLowerCase()}`,
      );
    } catch (error) {
      Alert.alert(t("Create stall"), extractErrorMessage(error));
    } finally {
      setCreatingStall(false);
    }
  };

  const openEditBarn = (barn: BarnListItemDto) => {
    setEditingBarn(barn);
    setEditBarnName(barn.name);
    setEditBarnCapacity(String(barn.capacity ?? 9));
    setEditBarnDescription(barn.description ?? "");
    setEditBarnHeadTrainerId(barn.headTrainerId ?? "");
    setEditBarnStatus(barn.status);
    setShowEditBarnModal(true);
  };

  const handleSaveBarn = async () => {
    if (!token || !editingBarn || !editBarnName.trim()) return;
    const cap = Number(editBarnCapacity);
    if (editBarnCapacity.trim() && (!Number.isInteger(cap) || cap < 1 || cap > 9)) {
      return Alert.alert(t("Capacity is 1–9 stalls"));
    }
    setSavingBarn(true);
    try {
      await stableService.updateBarn(token, editingBarn.id, {
        name: editBarnName.trim(),
        capacity: editBarnCapacity.trim() ? cap : undefined,
        description: editBarnDescription.trim() || undefined,
        headTrainerId: editBarnHeadTrainerId ? editBarnHeadTrainerId : null,
        status: editBarnStatus,
      });
      await resource.refresh();
      setShowEditBarnModal(false);
      Alert.alert(
        t("Cập nhật khu"),
        `${t("Khu chuồng")} ${editBarnName.trim()} ${t("done").toLowerCase()}`,
      );
    } catch (error) {
      Alert.alert(t("Cập nhật khu"), extractErrorMessage(error));
    } finally {
      setSavingBarn(false);
    }
  };

  const confirmDeleteBarn = (barn: BarnListItemDto) => {
    Alert.alert(
      t("Xóa khu chuồng"),
      `${t("Bạn có chắc muốn xóa")} ${barn.name}? ${t("Thao tác này chỉ thực hiện được khi khu không còn ô chuồng và ngựa.")}`,
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await stableService.deleteBarn(token!, barn.id);
              await resource.refresh();
              setActiveBarnIndex(0);
              Alert.alert(t("Thành công"), t("Đã xóa khu chuồng."));
            } catch (err) {
              Alert.alert(t("Không thể xóa khu"), extractErrorMessage(err));
            }
          },
        },
      ],
    );
  };

  const openEditStallModal = (stall: StallDto) => {
    setEditingStall(stall);
    setEditStallCode(stall.code);
    setEditStallType((stall.type as "STANDARD" | "ISOLATION" | "RECOVERY") || "STANDARD");
    setEditStallDescription(stall.description ?? "");
    setEditStallHasCamera(Boolean(stall.hasCamera));
    setShowEditStallModal(true);
  };

  const handleSaveStall = async () => {
    if (!token || !editingStall || !editStallCode.trim()) return;
    setSavingStall(true);
    try {
      const updated = await stableService.updateStall(token, editingStall.id, {
        code: editStallCode.trim(),
        type: editStallType,
        description: editStallDescription.trim() || undefined,
        hasCamera: editStallHasCamera,
      });
      await resource.refresh();
      setSelectedStall(updated);
      setShowEditStallModal(false);
      Alert.alert(
        t("Cập nhật ô"),
        `${t("Ô chuồng")} ${updated.code} ${t("done").toLowerCase()}`,
      );
    } catch (error) {
      Alert.alert(t("Cập nhật ô"), extractErrorMessage(error));
    } finally {
      setSavingStall(false);
    }
  };

  return (
    <Screen
      role={role}
      title="Stable overview"
      subtitle={
        payload
          ? `${payload.barns.length} barns · ${occupiedCount}/${payload.stalls.length} occupied`
          : "Barn, stall and Groom assignments"
      }
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {payload && payload.barns.length === 0 ? (
        <View style={{ gap: space.md, alignItems: "center", paddingVertical: space.xl }}>
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => undefined}
            empty
            emptyLabel={t("No barns are available.")}
          />
          {role === "manager" ? (
            <PrimaryButton
              label={t("Tạo khu chuồng đầu tiên")}
              icon="add"
              onPress={openCreateBarnModal}
            />
          ) : null}
        </View>
      ) : null}

      {payload && payload.barns.length > 0 ? (
        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          style={{ gap: space.xl }}
        >
          {/* Quick link banner for Trainer to manage Diet & Feeding */}
          {role === "trainer" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Manage stable diet")}
              onPress={() => {
                const firstHorse = payload.horses[0];
                if (firstHorse) {
                  router.push(`/trainer/horse/${firstHorse.id}/stable-care` as Href);
                } else {
                  router.push("/trainer/horses" as Href);
                }
              }}
              style={({ pressed }) => [
                styles.trainerCareBanner,
                pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={styles.trainerCareBannerIcon}>
                <Ionicons name="nutrition" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.trainerCareBannerTitle}>{t("Diet & Feeding")}</Text>
                <Text style={uiStyles.muted} numberOfLines={1}>
                  {t("Feeding, scheduled care, daily checklists and surcharges")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </Pressable>
          ) : null}

          {/* Barn Selector Horizontal Pills */}
          <View style={styles.barnSelectorContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.barnSelectorScroll}
            >
              {payload.barns.map((barn, index) => {
                const isActive = index === activeBarnIndex;
                return (
                  <Pressable
                    key={barn.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => handleSelectBarn(index)}
                    style={[styles.barnTabChip, isActive && styles.barnTabChipActive]}
                  >
                    <Ionicons
                      name="home"
                      size={14}
                      color={isActive ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[styles.barnTabChipText, isActive && styles.barnTabChipTextActive]}
                      numberOfLines={1}
                    >
                      {barn.name}
                    </Text>
                  </Pressable>
                );
              })}
              {role === "manager" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Add barn")}
                  onPress={openCreateBarnModal}
                  style={styles.addBarnTabChip}
                >
                  <Ionicons name="add" size={15} color={colors.primary} />
                  <Text style={styles.addBarnTabChipText}>{t("Add barn")}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>

          {/* Barn View Mode Segment (Sơ đồ ô chuồng vs Tổng quan chăm sóc khu - Step G1) */}
          <View style={styles.viewModeSegment}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: barnViewMode === "stalls" }}
              onPress={() => setBarnViewMode("stalls")}
              style={[
                styles.viewModeSegmentBtn,
                barnViewMode === "stalls" && styles.viewModeSegmentBtnActive,
              ]}
            >
              <Ionicons
                name="grid-outline"
                size={15}
                color={
                  barnViewMode === "stalls" ? colors.primaryForeground : colors.mutedForeground
                }
              />
              <Text
                style={[
                  styles.viewModeSegmentText,
                  barnViewMode === "stalls" && styles.viewModeSegmentTextActive,
                ]}
              >
                {t("Sơ đồ ô chuồng")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: barnViewMode === "care" }}
              onPress={() => setBarnViewMode("care")}
              style={[
                styles.viewModeSegmentBtn,
                barnViewMode === "care" && styles.viewModeSegmentBtnActive,
              ]}
            >
              <Ionicons
                name="clipboard-outline"
                size={15}
                color={barnViewMode === "care" ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.viewModeSegmentText,
                  barnViewMode === "care" && styles.viewModeSegmentTextActive,
                ]}
              >
                {t("Care overview")}
              </Text>
            </Pressable>
          </View>

          {barnViewMode === "stalls" ? (
            <>
              {/* Swipe Hint */}
              <View style={styles.swipeHintRow}>
            <Ionicons name="swap-horizontal" size={14} color={colors.mutedForeground} />
            <Text style={styles.swipeHintText}>{t("Swipe or tap to switch barn")}</Text>
          </View>

          {/* Barn Overview Metric Cards */}
          {currentBarn ? (
            <View style={styles.metricGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{barnMetrics.total}</Text>
                <Text style={styles.metricLabel}>{t("Total stalls")}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: colors.primary }]}>
                  {barnMetrics.occupied}
                </Text>
                <Text style={styles.metricLabel}>{t("Occupied")}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{barnMetrics.vacant}</Text>
                <Text style={styles.metricLabel}>{t("Vacant")}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text
                  style={[
                    styles.metricValue,
                    barnMetrics.attention > 0 && { color: colors.destructive },
                  ]}
                >
                  {barnMetrics.attention}
                </Text>
                <Text style={styles.metricLabel}>{t("Needs attention")}</Text>
              </View>
            </View>
          ) : null}

          {/* Horizontal Paging for Barn Stalls */}
          {containerWidth > 0 ? (
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              style={{ width: containerWidth }}
              contentContainerStyle={{ paddingBottom: space.sm }}
            >
              {payload.barns.map((barn) => {
                const barnStalls = payload.stalls.filter((s) => s.barnId === barn.id);

                return (
                  <View key={barn.id} style={{ width: containerWidth }}>
                    <View style={uiStyles.section}>
                      {/* Barn Header Row */}
                      <View style={styles.barnHeaderRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.barnTitle}>{barn.name}</Text>
                          {barn.headTrainerFullName ? (
                            <Text style={styles.barnTrainerText}>
                              {t("Head Trainer")}: {barn.headTrainerFullName}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.barnAvailableBadge}>
                          <Ionicons name="home-outline" size={13} color={colors.primary} />
                          <Text style={styles.barnAvailableBadgeText}>
                            {barn.availableStallCount} {t("available")}
                          </Text>
                        </View>
                        {role === "manager" ? (
                          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t("Edit barn")}
                              onPress={() => openEditBarn(barn)}
                              style={styles.barnActionBtn}
                            >
                              <Ionicons name="create-outline" size={16} color={colors.primary} />
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t("Delete barn")}
                              onPress={() => confirmDeleteBarn(barn)}
                              style={styles.barnActionBtn}
                            >
                              <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                            </Pressable>
                          </View>
                        ) : null}
                      </View>

                      {/* Stalls 2-Column Grid */}
                      <View style={styles.stallsGrid}>
                        {barnStalls.map((stall) => {
                          const assignedHorse = getHorseInStall(stall, barn.id);
                          const isOccupied = stall.status === "OCCUPIED" || Boolean(assignedHorse);
                          const isMaintenance = stall.status === "MAINTENANCE";
                          const isAvailable = stall.status === "AVAILABLE" && !assignedHorse;

                          // Dynamic stall container styling based on occupancy and health
                          let stallBorderColor = colors.border;
                          let stallBgColor = colors.surface;
                          if (assignedHorse) {
                            if (assignedHorse.healthStatus === "INJURED") {
                              stallBorderColor = colors.destructive;
                              stallBgColor = colors.injuredSoft;
                            } else if (assignedHorse.healthStatus === "UNDER_OBSERVATION") {
                              stallBorderColor = colors.monitor;
                              stallBgColor = colors.monitorSoft;
                            } else if (assignedHorse.healthStatus === "QUARANTINED") {
                              stallBorderColor = colors.locked;
                              stallBgColor = colors.lockedSoft;
                            } else {
                              stallBorderColor = colors.primary;
                              stallBgColor = colors.fitSoft;
                            }
                          } else if (isMaintenance) {
                            stallBgColor = colors.elevated;
                          }

                          return (
                            <Pressable
                              key={stall.id}
                              accessibilityRole="button"
                              onPress={() => setSelectedStall(stall)}
                              style={[
                                styles.stallCard,
                                {
                                  borderColor: stallBorderColor,
                                  backgroundColor: stallBgColor,
                                },
                              ]}
                            >
                              {/* Top Stall Row */}
                              <View style={styles.stallTopRow}>
                                <Text style={styles.stallCodeText}>
                                  {t("Stall")} {stall.code}
                                </Text>
                                <View
                                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                                >
                                  {stall.hasCamera ? (
                                    <Ionicons
                                      name="videocam-outline"
                                      size={14}
                                      color={colors.mutedForeground}
                                    />
                                  ) : null}
                                  <Ionicons
                                    name="ellipsis-horizontal"
                                    size={14}
                                    color={colors.mutedForeground}
                                  />
                                </View>
                              </View>

                              {/* Center Content: Horse or Vacant Status */}
                              <View style={styles.stallCenterContent}>
                                {assignedHorse ? (
                                  <View style={{ gap: 2 }}>
                                    <Text style={styles.stallHorseName} numberOfLines={1}>
                                      {assignedHorse.name}
                                    </Text>
                                    {renderHealthBadge(assignedHorse.healthStatus)}
                                  </View>
                                ) : (
                                  <View style={{ gap: 2 }}>
                                    <Text
                                      style={[
                                        styles.stallEmptyTitle,
                                        isAvailable && { color: colors.primary },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {isAvailable ? t("Available") : t("Maintenance")}
                                    </Text>
                                    <Text style={uiStyles.muted} numberOfLines={1}>
                                      {formatEnum(stall.type)}
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {/* Bottom Row */}
                              <View style={styles.stallBottomRow}>
                                <View
                                  style={[
                                    styles.stallStatusBadge,
                                    isOccupied && styles.stallStatusBadgeOccupied,
                                    isAvailable && styles.stallStatusBadgeAvailable,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.stallStatusBadgeText,
                                      isOccupied && { color: colors.foreground },
                                      isAvailable && { color: colors.primary },
                                    ]}
                                  >
                                    {isOccupied
                                      ? t("Occupied")
                                      : isAvailable
                                        ? t("Available")
                                        : t("Maintenance")}
                                  </Text>
                                </View>
                                <Ionicons
                                  name="chevron-forward"
                                  size={13}
                                  color={colors.mutedForeground}
                                />
                              </View>
                            </Pressable>
                          );
                        })}

                        {role === "manager" ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("Add stall")}
                            onPress={() => openCreateStallModal(barn)}
                            style={({ pressed }) => [
                              styles.addStallCard,
                              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                            ]}
                          >
                            <View style={styles.addStallContent}>
                              <View style={styles.addStallIconCircle}>
                                <Ionicons name="add" size={22} color={colors.primary} />
                              </View>
                              <Text style={styles.addStallTitle}>{t("Add stall")}</Text>
                              <Text style={styles.addStallSubtitle} numberOfLines={1}>
                                {barn.name}
                              </Text>
                            </View>
                          </Pressable>
                        ) : null}

                        {!barnStalls.length && role !== "manager" ? (
                          <Panel style={{ width: "100%" }}>
                            <Text style={uiStyles.muted}>
                              No stalls are registered in this barn.
                            </Text>
                          </Panel>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : null}
        </>
      ) : (
        /* Care Overview for currentBarn (Step G1: Bảng tổng quan chăm sóc khu theo ngựa) */
        <View style={[uiStyles.section, { gap: space.sm }]}>
          {/* Overview Header row */}
          <View style={styles.careOverviewHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.careOverviewBarnTitle}>
                {currentBarn?.name ?? t("Barn")} · {t("Care overview")}
              </Text>
              <Text style={uiStyles.muted}>
                {t("Checklist, feeding, incidents & groom per horse in this barn")}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Refresh care overview")}
              onPress={() => void loadCareOverview()}
              style={styles.careRefreshBtn}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.primary} />
            </Pressable>
          </View>

          {/* Summary Metric Pills for the Barn's care */}
          <View style={styles.careSummaryMetricsRow}>
            <View style={styles.careSummaryMetricPill}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
              <Text style={styles.careSummaryMetricText}>
                {horsesInCurrentBarn.length} {t("horses")}
              </Text>
            </View>
            <View style={styles.careSummaryMetricPill}>
              <Ionicons name="checkbox-outline" size={14} color={colors.primary} />
              <Text style={styles.careSummaryMetricText}>
                {careCompletedCount}/{horsesInCurrentBarn.length} {t("checklists done")}
              </Text>
            </View>
            <View style={styles.careSummaryMetricPill}>
              <Ionicons
                name="warning-outline"
                size={14}
                color={careIncidentCount > 0 ? colors.destructive : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.careSummaryMetricText,
                  careIncidentCount > 0 && { color: colors.destructive },
                ]}
              >
                {careIncidentCount} {t("incidents")}
              </Text>
            </View>
          </View>

          {/* Loading or Horse List */}
          {loadingCare ? (
            <Panel style={{ paddingVertical: space.lg, alignItems: "center", gap: space.xs }}>
              <Ionicons name="reload-outline" size={24} color={colors.primary} />
              <Text style={uiStyles.muted}>{t("Loading care details...")}</Text>
            </Panel>
          ) : horsesInCurrentBarn.length === 0 ? (
            <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={colors.mutedForeground}
              />
              <Text style={[uiStyles.muted, { marginTop: 4 }]}>
                {t("No horses are currently assigned to this barn.")}
              </Text>
            </Panel>
          ) : (
            <View style={{ gap: space.sm }}>
              {horsesInCurrentBarn.map((horse) => {
                const summary = careSummaries[horse.id];
                const stallCode = horse.location.stall?.code ?? "—";
                const groomName = summary?.groomName;
                const checklistStatus = summary?.checklistStatus ?? "NOT_GENERATED";
                const progress = summary?.checklistProgress;
                const hasFeeding = summary?.feedingPlanStatus === "ACTIVE";
                const incidentsCount = summary?.openIncidentsCount ?? 0;

                return (
                  <View key={horse.id} style={styles.careHorseCard}>
                    {/* Card Header: Stall Code + Horse Name + Health */}
                    <View style={styles.careHorseCardHeader}>
                      <View style={styles.stallCodeBadge}>
                        <Text style={styles.stallCodeBadgeText}>
                          {t("Stall")} {stallCode}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, marginHorizontal: space.xs }}>
                        <Text style={styles.careHorseName} numberOfLines={1}>
                          {horse.name}
                        </Text>
                        <Text style={uiStyles.muted} numberOfLines={1}>
                          {[horse.breed, horse.gender, horse.microchipId]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                      {renderHealthBadge(horse.healthStatus)}
                    </View>

                    {/* 4 Care Aspects: Groom, Checklist, Feeding, Incidents */}
                    <View style={styles.careAspectsGrid}>
                      {/* 1. Assigned Groom */}
                      <View style={styles.careAspectItem}>
                        <View style={styles.careAspectLabelRow}>
                          <Ionicons
                            name="person-outline"
                            size={13}
                            color={colors.mutedForeground}
                          />
                          <Text style={styles.careAspectLabel}>{t("Groom")}</Text>
                        </View>
                        <Text
                          style={[
                            styles.careAspectValue,
                            !groomName && { color: colors.destructive },
                          ]}
                          numberOfLines={1}
                        >
                          {groomName ?? t("Unassigned Groom")}
                        </Text>
                      </View>

                      {/* 2. Today's Checklist */}
                      <View style={styles.careAspectItem}>
                        <View style={styles.careAspectLabelRow}>
                          <Ionicons
                            name="checkbox-outline"
                            size={13}
                            color={colors.mutedForeground}
                          />
                          <Text style={styles.careAspectLabel}>{t("Checklist")}</Text>
                        </View>
                        {renderChecklistCareBadge(checklistStatus, progress)}
                      </View>

                      {/* 3. Feeding Plan */}
                      <View style={styles.careAspectItem}>
                        <View style={styles.careAspectLabelRow}>
                          <Ionicons
                            name="restaurant-outline"
                            size={13}
                            color={colors.mutedForeground}
                          />
                          <Text style={styles.careAspectLabel}>{t("Feeding plan")}</Text>
                        </View>
                        <Text
                          style={[
                            styles.careAspectValue,
                            hasFeeding
                              ? { color: colors.primary }
                              : { color: colors.mutedForeground },
                          ]}
                          numberOfLines={1}
                        >
                          {hasFeeding
                            ? `${t("Active")} (${summary?.feedingPlanMealsCount ?? 0} ${t("meals")})`
                            : t("No plan")}
                        </Text>
                      </View>

                      {/* 4. Incidents */}
                      <View style={styles.careAspectItem}>
                        <View style={styles.careAspectLabelRow}>
                          <Ionicons
                            name="warning-outline"
                            size={13}
                            color={colors.mutedForeground}
                          />
                          <Text style={styles.careAspectLabel}>{t("Incidents")}</Text>
                        </View>
                        <Text
                          style={[
                            styles.careAspectValue,
                            incidentsCount > 0
                              ? { color: colors.destructive }
                              : { color: colors.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {incidentsCount > 0
                            ? `${incidentsCount} ${t("open incident(s)")}`
                            : t("Normal")}
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons for Horse Care */}
                    <View style={styles.careCardActionsRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push(`/${role}/horse/${horse.id}/stable-care` as Href)
                        }
                        style={styles.careActionBtnPrimary}
                      >
                        <Ionicons
                          name="restaurant-outline"
                          size={14}
                          color={colors.primaryForeground}
                        />
                        <Text style={styles.careActionBtnPrimaryText}>{t("Diet & Care")}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push(`/${role}/horse/${horse.id}/placement` as Href)
                        }
                        style={styles.careActionBtnSecondary}
                      >
                        <Ionicons name="people-outline" size={14} color={colors.foreground} />
                        <Text style={styles.careActionBtnSecondaryText}>
                          {t("Stall & Groom")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

          {/* Section: Awaiting Placement / Pending Horses */}
          <View style={[uiStyles.section, { marginTop: space.md }]}>
            <View style={uiStyles.row}>
              <SectionTitle>{t("Awaiting placement")}</SectionTitle>
              <View style={styles.pendingCountPill}>
                <Text style={styles.pendingCountPillText}>
                  {totalAwaitingPlacement} {t("horses")}
                </Text>
              </View>
            </View>

            {/* Segmented control to prevent overlap and distinguish placement tiers */}
            <View style={styles.segmentContainer}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setUnassignedTab("barn")}
                style={[styles.segmentBtn, unassignedTab === "barn" && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    unassignedTab === "barn" && styles.segmentBtnTextActive,
                  ]}
                >
                  {t("Awaiting barn")} ({pendingBarnHorses.length})
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setUnassignedTab("stall")}
                style={[styles.segmentBtn, unassignedTab === "stall" && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    unassignedTab === "stall" && styles.segmentBtnTextActive,
                  ]}
                >
                  {t("Awaiting stall")} ({pendingStallHorses.length})
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setUnassignedTab("groom")}
                style={[styles.segmentBtn, unassignedTab === "groom" && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    unassignedTab === "groom" && styles.segmentBtnTextActive,
                  ]}
                >
                  {t("Awaiting Groom")} ({pendingGroomHorses.length})
                </Text>
              </Pressable>
            </View>

            {unassignedTab === "barn" ? (
              pendingBarnHorses.length === 0 ? (
                <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
                  <Ionicons name="checkmark-circle-outline" size={28} color={colors.primary} />
                  <Text style={[uiStyles.muted, { marginTop: 4 }]}>
                    {t("All horses assigned to barns")}
                  </Text>
                </Panel>
              ) : (
                <View style={{ gap: space.xs }}>
                  {pendingBarnHorses.map((horse) => (
                    <View key={horse.id} style={styles.unassignedCard}>
                      <View style={styles.unassignedCardHeader}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.unassignedHorseName} numberOfLines={1}>
                            {horse.name}
                          </Text>
                          <Text style={uiStyles.muted} numberOfLines={1}>
                            {[horse.breed, horse.gender, horse.microchipId]
                              .filter(Boolean)
                              .join(" · ") || t("No barn assigned")}
                          </Text>
                        </View>
                        {renderHealthBadge(horse.healthStatus)}
                      </View>
                      <View style={styles.unassignedCardFooter}>
                        <View style={styles.unassignedStatusNote}>
                          <Ionicons name="alert-circle-outline" size={13} color={colors.monitor} />
                          <Text
                            style={[styles.unassignedStatusNoteText, { color: colors.monitor }]}
                          >
                            {t("waiting for barn assignment")}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            router.push(`/${role}/horse/${horse.id}/placement` as Href)
                          }
                          style={styles.unassignedActionBtn}
                        >
                          <Ionicons
                            name="business-outline"
                            size={14}
                            color={colors.primaryForeground}
                          />
                          <Text style={styles.unassignedActionBtnText}>{t("Assign barn")}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )
            ) : unassignedTab === "stall" ? (
              pendingStallHorses.length === 0 ? (
              <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
                <Ionicons name="checkmark-circle-outline" size={28} color={colors.primary} />
                <Text style={[uiStyles.muted, { marginTop: 4 }]}>
                  {t("All horses assigned to stalls")}
                </Text>
              </Panel>
            ) : (
              <View style={{ gap: space.xs }}>
                {pendingStallHorses.map((horse) => (
                  <View key={horse.id} style={styles.unassignedCard}>
                    <View style={styles.unassignedCardHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.unassignedHorseName} numberOfLines={1}>
                          {horse.name}
                        </Text>
                        <Text style={uiStyles.muted} numberOfLines={1}>
                          {horse.location.barn?.name ?? t("Barn")}:{" "}
                          {[horse.breed, horse.microchipId].filter(Boolean).join(" · ")}
                        </Text>
                      </View>
                      {renderHealthBadge(horse.healthStatus)}
                    </View>
                    <View style={styles.unassignedCardFooter}>
                      <View style={styles.unassignedStatusNote}>
                        <Ionicons name="home-outline" size={13} color={colors.primary} />
                        <Text style={[styles.unassignedStatusNoteText, { color: colors.primary }]}>
                          {horse.location.barn?.name || t("Barn")} ·{" "}
                          {t("waiting for stall placement")}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push(`/${role}/horse/${horse.id}/placement` as Href)}
                        style={styles.unassignedActionBtn}
                      >
                        <Ionicons
                          name="checkmark-outline"
                          size={14}
                          color={colors.primaryForeground}
                        />
                        <Text style={styles.unassignedActionBtnText}>{t("Assign stall")}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )) : pendingGroomHorses.length === 0 ? (
              <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
                <Ionicons name="checkmark-circle-outline" size={28} color={colors.primary} />
                <Text style={[uiStyles.muted, { marginTop: 4 }]}>
                  {t("Tất cả ngựa đã có Groom chăm sóc")}
                </Text>
              </Panel>
            ) : (
              <View style={{ gap: space.xs }}>
                {pendingGroomHorses.map((horse) => (
                  <View key={horse.id} style={styles.unassignedCard}>
                    <View style={styles.unassignedCardHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.unassignedHorseName} numberOfLines={1}>
                          {horse.name}
                        </Text>
                        <Text style={uiStyles.muted} numberOfLines={1}>
                          {horse.location.barn?.name ?? t("Barn")} · {t("Stall")}{" "}
                          {horse.location.stall?.code ?? "—"}
                        </Text>
                      </View>
                      {renderHealthBadge(horse.healthStatus)}
                    </View>
                    <View style={styles.unassignedCardFooter}>
                      <View style={styles.unassignedStatusNote}>
                        <Ionicons name="people-outline" size={13} color={colors.monitor} />
                        <Text style={[styles.unassignedStatusNoteText, { color: colors.monitor }]}>
                          {t("Đã có ô, chờ phân công Groom")}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push(`/${role}/horse/${horse.id}/placement` as Href)}
                        style={styles.unassignedActionBtn}
                      >
                        <Ionicons
                          name="person-add-outline"
                          size={14}
                          color={colors.primaryForeground}
                        />
                        <Text style={styles.unassignedActionBtnText}>{t("Giao Groom")}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Section: Groom Workload (for Trainer and Manager) */}
          <View style={[uiStyles.section, { marginTop: space.md }]}>
            <SectionTitle>Groom workload</SectionTitle>
            {payload.grooms.length ? (
              payload.grooms.map((groom) => (
                <Panel key={groom.groomId}>
                  <View style={uiStyles.row}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[uiStyles.value, { fontSize: 16 }]} numberOfLines={1}>
                        {groom.fullName}
                      </Text>
                      <Text style={uiStyles.muted} numberOfLines={1}>
                        {t("Groom workload")}
                      </Text>
                    </View>
                    <View style={styles.groomBadge}>
                      <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
                      <Text style={styles.groomBadgeText}>
                        {groom.activeHorseCount} {t("active horses")}
                      </Text>
                    </View>
                  </View>
                </Panel>
              ))
            ) : (
              <Text style={uiStyles.muted}>No active Grooms are available for assignment.</Text>
            )}
          </View>
        </View>
      ) : null}

      {/* Interactive Stall Action Modal for Trainer & Manager */}
      <Modal
        visible={Boolean(selectedStall)}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedStall(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedStall(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {selectedStall ? (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeaderRow}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.modalTitle}>
                      {t("Stall")} {selectedStall.code}
                    </Text>
                    <Text style={uiStyles.muted}>
                      {formatEnum(selectedStall.type)}
                      {selectedStall.hasCamera ? ` · ${t("Camera monitoring")}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Close")}
                    onPress={() => setSelectedStall(null)}
                    style={styles.modalCloseBtn}
                  >
                    <Ionicons name="close" size={20} color={colors.foreground} />
                  </Pressable>
                </View>

                {/* If stall is occupied by a horse */}
                {selectedHorseInModal ? (
                  <View style={{ gap: space.sm }}>
                    <View style={styles.modalHorseCard}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.modalHorseName}>{selectedHorseInModal.name}</Text>
                          <Text style={uiStyles.muted}>
                            {[
                              selectedHorseInModal.breed,
                              selectedHorseInModal.gender,
                              selectedHorseInModal.microchipId,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </View>
                        {renderHealthBadge(selectedHorseInModal.healthStatus)}
                      </View>

                      <View style={styles.modalHorseInfoRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={uiStyles.muted}>Aptitude</Text>
                          <Text style={[uiStyles.value, { fontSize: 14 }]}>
                            {selectedHorseInModal.raceAptitude
                              ? formatEnum(selectedHorseInModal.raceAptitude)
                              : "—"}
                          </Text>
                        </View>
                        {selectedHorseInModal.lifecycleStatus ? (
                          <View style={{ flex: 1 }}>
                            <Text style={uiStyles.muted}>Status</Text>
                            <Text style={[uiStyles.value, { fontSize: 14 }]}>
                              {formatEnum(selectedHorseInModal.lifecycleStatus)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Action buttons */}
                    <View style={{ gap: space.xs, marginTop: space.xs }}>
                      {role === "trainer" || role === "manager" ? (
                        <PrimaryButton
                          label="Diet & Feeding"
                          icon="restaurant-outline"
                          onPress={() => {
                            const horseId = selectedHorseInModal.id;
                            setSelectedStall(null);
                            router.push(`/${role}/horse/${horseId}/stable-care` as Href);
                          }}
                        />
                      ) : null}
                      <SecondaryButton
                        label="Manage stall and Groom"
                        icon="people-outline"
                        onPress={() => {
                          const horseId = selectedHorseInModal.id;
                          setSelectedStall(null);
                          router.push(`/${role}/horse/${horseId}/placement` as Href);
                        }}
                      />
                      <SecondaryButton
                        label="Open horse profile"
                        icon="open-outline"
                        onPress={() => {
                          const horseId = selectedHorseInModal.id;
                          setSelectedStall(null);
                          router.push(`/${role}/horse/${horseId}` as Href);
                        }}
                      />
                      {role === "trainer" || role === "manager" ? (
                        <SecondaryButton
                          label={releasingStall ? t("Đang gỡ…") : t("Gỡ khỏi ô")}
                          icon="log-out-outline"
                          disabled={releasingStall}
                          onPress={() => {
                            Alert.alert(
                              t("Gỡ ngựa khỏi ô"),
                              `${t("Bạn có chắc muốn gỡ ngựa")} ${selectedHorseInModal.name} ${t("khỏi ô")} ${selectedStall.code}? ${t("Ngựa sẽ trở về danh sách Chờ xếp ô.")}`,
                              [
                                { text: t("Cancel"), style: "cancel" },
                                {
                                  text: t("Gỡ khỏi ô"),
                                  style: "destructive",
                                  onPress: async () => {
                                    setReleasingStall(true);
                                    try {
                                      await horseService.releaseStall(token!, selectedHorseInModal.id);
                                      await resource.refresh();
                                      setSelectedStall(null);
                                      Alert.alert(t("Thành công"), t("Đã gỡ ngựa khỏi ô chuồng."));
                                    } catch (err) {
                                      Alert.alert(t("Gỡ khỏi ô"), extractErrorMessage(err));
                                    } finally {
                                      setReleasingStall(false);
                                    }
                                  },
                                },
                              ],
                            );
                          }}
                        />
                      ) : null}
                    </View>
                  </View>
                ) : (
                  /* If stall is available / vacant */
                  <View style={{ gap: space.sm }}>
                    <Panel style={{ backgroundColor: colors.fitSoft, borderColor: colors.fit }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.fit} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.fit }}>
                            {selectedStall.status === "AVAILABLE"
                              ? t("Available")
                              : t("Maintenance")}
                          </Text>
                          <Text style={uiStyles.muted}>
                            {selectedStall.status === "AVAILABLE"
                              ? "Ready for horse assignment"
                              : "This stall is unavailable during maintenance."}
                          </Text>
                        </View>
                      </View>
                    </Panel>

                    {/* Pending horses in this barn available to be placed */}
                    {pendingInCurrentBarn.length > 0 ? (
                      <View style={{ gap: space.xs }}>
                        <Text style={styles.subGroupHeader}>
                          {t("Barn assigned, waiting for stall")} ({pendingInCurrentBarn.length})
                        </Text>
                        {pendingInCurrentBarn.map((pendingHorse) => (
                          <View key={pendingHorse.id} style={styles.unassignedHorseCard}>
                            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                              <Text style={styles.unassignedHorseName}>{pendingHorse.name}</Text>
                              <Text style={uiStyles.muted} numberOfLines={1}>
                                {pendingHorse.breed ?? "Horse"}
                              </Text>
                            </View>
                            <PrimaryButton
                              label="Assign stall and Groom"
                              icon="checkmark-outline"
                              onPress={() => {
                                setSelectedStall(null);
                                router.push(`/${role}/horse/${pendingHorse.id}/placement` as Href);
                              }}
                              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
                            />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={{ paddingVertical: space.sm }}>
                        <Text
                          style={[uiStyles.muted, { textAlign: "center", marginBottom: space.sm }]}
                        >
                          No horses are currently waiting for a stall in this barn.
                        </Text>
                        <SecondaryButton
                          label="View all horses"
                          icon="grid-outline"
                          onPress={() => {
                            setSelectedStall(null);
                            router.push(`/${role}/horses` as Href);
                          }}
                        />
                      </View>
                    )}

                    {role === "manager" ? (
                      <View style={{ gap: space.xs, marginTop: space.sm }}>
                        <SecondaryButton
                          label={t("Sửa thông tin ô")}
                          icon="create-outline"
                          onPress={() => openEditStallModal(selectedStall)}
                        />
                        {selectedStall.status === "AVAILABLE" ? (
                          <SecondaryButton
                            label={t("Chuyển sang bảo trì")}
                            icon="construct-outline"
                            onPress={async () => {
                              try {
                                const updated = await stableService.updateStall(token!, selectedStall.id, {
                                  status: "MAINTENANCE",
                                });
                                await resource.refresh();
                                setSelectedStall(updated);
                                Alert.alert(t("Bảo trì ô"), t("Đã chuyển ô chuồng sang trạng thái bảo trì."));
                              } catch (err) {
                                Alert.alert(t("Bảo trì ô"), extractErrorMessage(err));
                              }
                            }}
                          />
                        ) : selectedStall.status === "MAINTENANCE" ? (
                          <SecondaryButton
                            label={t("Kết thúc bảo trì")}
                            icon="checkmark-circle-outline"
                            onPress={async () => {
                              try {
                                const updated = await stableService.updateStall(token!, selectedStall.id, {
                                  status: "AVAILABLE",
                                });
                                await resource.refresh();
                                setSelectedStall(updated);
                                Alert.alert(t("Kết thúc bảo trì"), t("Ô chuồng đã sẵn sàng đón ngựa."));
                              } catch (err) {
                                Alert.alert(t("Kết thúc bảo trì"), extractErrorMessage(err));
                              }
                            }}
                          />
                        ) : null}
                        <SecondaryButton
                          label={t("Xóa ô chuồng")}
                          icon="trash-outline"
                          onPress={() => {
                            Alert.alert(
                              t("Xóa ô chuồng"),
                              `${t("Bạn có chắc muốn xóa ô chuồng")} ${selectedStall.code}?`,
                              [
                                { text: t("Cancel"), style: "cancel" },
                                {
                                  text: t("Delete"),
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      await stableService.deleteStall(token!, selectedStall.id);
                                      await resource.refresh();
                                      setSelectedStall(null);
                                      Alert.alert(t("Xóa ô chuồng"), t("Đã xóa ô chuồng thành công."));
                                    } catch (err) {
                                      Alert.alert(t("Xóa ô chuồng"), extractErrorMessage(err));
                                    }
                                  },
                                },
                              ],
                            );
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                )}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      {/* Modal: Create Barn (Section 4.1) */}
      <Modal
        visible={showCreateBarnModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!creatingBarn) setShowCreateBarnModal(false);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !creatingBarn && setShowCreateBarnModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>{t("Create barn")}</Text>
                <Text style={uiStyles.muted}>{t("Add a new barn zone")}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                disabled={creatingBarn}
                onPress={() => setShowCreateBarnModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={{ gap: space.md }}>
              <Field label={t("Barn name")}>
                <NativeInput
                  value={newBarnName}
                  onChangeText={setNewBarnName}
                  placeholder={t("e.g. Barn D")}
                />
              </Field>

              <Field label={t("Capacity (max stalls)")}>
                <NativeInput
                  value={newBarnCapacity}
                  onChangeText={setNewBarnCapacity}
                  placeholder={t("1–9 stalls (default is 9)")}
                  keyboardType="numeric"
                />
              </Field>

              <Field label={t("Description")}>
                <NativeInput
                  value={newBarnDescription}
                  onChangeText={setNewBarnDescription}
                  placeholder={t("Location, facilities…")}
                  multiline
                />
              </Field>

              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <PrimaryButton
                  label={creatingBarn ? t("Creating…") : t("Create barn")}
                  icon="add"
                  disabled={creatingBarn || !newBarnName.trim()}
                  onPress={() => void handleCreateBarn()}
                />
                <SecondaryButton
                  label={t("Cancel")}
                  disabled={creatingBarn}
                  onPress={() => setShowCreateBarnModal(false)}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Create Stall (Section 4.2) */}
      <Modal
        visible={showCreateStallModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!creatingStall) setShowCreateStallModal(false);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !creatingStall && setShowCreateStallModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>{t("Create stall")}</Text>
                <Text style={uiStyles.muted}>
                  {t("Add stall to")} {targetBarnForStall?.name}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                disabled={creatingStall}
                onPress={() => setShowCreateStallModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={{ gap: space.md }}>
              <Field label={t("Stall code")}>
                <NativeInput
                  value={newStallCode}
                  onChangeText={setNewStallCode}
                  placeholder="A-01"
                />
              </Field>

              <Field label={t("Stall type")}>
                <Chips
                  options={["STANDARD", "ISOLATION", "RECOVERY"]}
                  value={newStallType}
                  onChange={(val) => setNewStallType(val as any)}
                />
              </Field>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.switchTitle}>{t("Stall has surveillance camera")}</Text>
                  <Text style={uiStyles.muted}>{t("New stalls are available by default")}</Text>
                </View>
                <Switch
                  value={newStallHasCamera}
                  onValueChange={setNewStallHasCamera}
                  disabled={creatingStall}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <Field label={t("Description")}>
                <NativeInput
                  value={newStallDescription}
                  onChangeText={setNewStallDescription}
                  placeholder={t("Notes, camera angle…")}
                  multiline
                />
              </Field>

              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <PrimaryButton
                  label={creatingStall ? t("Creating…") : t("Create stall")}
                  icon="add"
                  disabled={creatingStall || !newStallCode.trim()}
                  onPress={() => void handleCreateStall()}
                />
                <SecondaryButton
                  label={t("Cancel")}
                  disabled={creatingStall}
                  onPress={() => setShowCreateStallModal(false)}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Edit Barn */}
      <Modal
        visible={showEditBarnModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!savingBarn) setShowEditBarnModal(false);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !savingBarn && setShowEditBarnModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>{t("Chỉnh sửa khu chuồng")}</Text>
                <Text style={uiStyles.muted}>{editingBarn?.name}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                disabled={savingBarn}
                onPress={() => setShowEditBarnModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}>
              <Field label={t("Barn name")}>
                <NativeInput
                  value={editBarnName}
                  onChangeText={setEditBarnName}
                  placeholder={t("e.g. Barn A")}
                />
              </Field>

              <Field label={t("Capacity (1–9 stalls)")}>
                <NativeInput
                  value={editBarnCapacity}
                  onChangeText={setEditBarnCapacity}
                  keyboardType="number-pad"
                  placeholder="9"
                />
              </Field>

              <Field label={t("Trạng thái khu")}>
                <Chips
                  options={["ACTIVE", "MAINTENANCE", "CLOSED"]}
                  value={editBarnStatus}
                  onChange={(val) => setEditBarnStatus(val)}
                />
              </Field>

              <Field label={t("Head Trainer phụ trách")}>
                <View style={{ gap: space.xs }}>
                  <Chips
                    options={[
                      t("Không gán HLV"),
                      ...activeHeadTrainers.map((ht) => ht.fullName),
                    ]}
                    value={
                      activeHeadTrainers.find((ht) => ht.id === editBarnHeadTrainerId)?.fullName ??
                      t("Không gán HLV")
                    }
                    onChange={(label) => {
                      if (label === t("Không gán HLV")) {
                        setEditBarnHeadTrainerId("");
                      } else {
                        const ht = activeHeadTrainers.find((t) => t.fullName === label);
                        if (ht) setEditBarnHeadTrainerId(ht.id);
                      }
                    }}
                  />
                </View>
              </Field>

              <Field label={t("Description")}>
                <NativeInput
                  value={editBarnDescription}
                  onChangeText={setEditBarnDescription}
                  placeholder={t("Description")}
                  multiline
                />
              </Field>

              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <PrimaryButton
                  label={savingBarn ? t("Saving…") : t("Save changes")}
                  icon="checkmark"
                  disabled={savingBarn || !editBarnName.trim()}
                  onPress={() => void handleSaveBarn()}
                />
                <SecondaryButton
                  label={t("Cancel")}
                  disabled={savingBarn}
                  onPress={() => setShowEditBarnModal(false)}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Edit Stall */}
      <Modal
        visible={showEditStallModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (!savingStall) setShowEditStallModal(false);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !savingStall && setShowEditStallModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>{t("Sửa ô chuồng")}</Text>
                <Text style={uiStyles.muted}>{editingStall?.code}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                disabled={savingStall}
                onPress={() => setShowEditStallModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={{ gap: space.md }}>
              <Field label={t("Stall code")}>
                <NativeInput
                  value={editStallCode}
                  onChangeText={setEditStallCode}
                  placeholder="A-01"
                />
              </Field>

              <Field label={t("Stall type")}>
                <Chips
                  options={["STANDARD", "ISOLATION", "RECOVERY"]}
                  value={editStallType}
                  onChange={(val) => setEditStallType(val as "STANDARD" | "ISOLATION" | "RECOVERY")}
                />
              </Field>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.switchTitle}>{t("Stall has surveillance camera")}</Text>
                  <Text style={uiStyles.muted}>{t("Giám sát camera 24/7")}</Text>
                </View>
                <Switch
                  value={editStallHasCamera}
                  onValueChange={setEditStallHasCamera}
                  disabled={savingStall}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <Field label={t("Description")}>
                <NativeInput
                  value={editStallDescription}
                  onChangeText={setEditStallDescription}
                  placeholder={t("Notes, camera angle…")}
                  multiline
                />
              </Field>

              <View style={{ gap: space.xs, marginTop: space.xs }}>
                <PrimaryButton
                  label={savingStall ? t("Saving…") : t("Save changes")}
                  icon="checkmark"
                  disabled={savingStall || !editStallCode.trim()}
                  onPress={() => void handleSaveStall()}
                />
                <SecondaryButton
                  label={t("Cancel")}
                  disabled={savingStall}
                  onPress={() => setShowEditStallModal(false)}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    barnSelectorContainer: {
      marginBottom: space.xs,
    },
    barnSelectorScroll: {
      gap: space.xs,
      paddingVertical: space.xs,
    },
    barnTabChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: space.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    barnTabChipActive: {
      backgroundColor: colors.fitSoft,
      borderColor: colors.primary,
    },
    barnTabChipText: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.foreground,
    },
    barnTabChipTextActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    swipeHintRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      marginBottom: space.sm,
    },
    swipeHintText: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: "500",
    },
    metricGrid: {
      flexDirection: "row",
      gap: space.xs,
      marginBottom: space.md,
    },
    metricCard: {
      flex: 1,
      alignItems: "center",
      paddingVertical: space.sm,
      paddingHorizontal: space.xs,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 2,
    },
    metricValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
    },
    metricLabel: {
      fontSize: 10,
      color: colors.mutedForeground,
      textAlign: "center",
      fontWeight: "600",
    },
    barnHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
      marginBottom: space.xs,
    },
    barnTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.foreground,
    },
    barnTrainerText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    barnAvailableBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    barnAvailableBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    barnActionBtn: {
      padding: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stallsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.sm,
      marginTop: space.xs,
    },
    stallCard: {
      width: "48%",
      minHeight: 126,
      justifyContent: "space-between",
      padding: space.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      gap: space.xs,
    },
    stallTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    stallCodeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.mutedForeground,
    },
    stallCenterContent: {
      flex: 1,
      justifyContent: "center",
      paddingVertical: space.xs,
    },
    stallHorseName: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.foreground,
    },
    stallEmptyTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    stallBottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    stallStatusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: colors.muted,
    },
    stallStatusBadgeOccupied: {
      backgroundColor: colors.surface,
    },
    stallStatusBadgeAvailable: {
      backgroundColor: colors.fitSoft,
    },
    stallStatusBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    healthBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      alignSelf: "flex-start",
      marginTop: 2,
    },
    healthBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    pendingCountPill: {
      paddingHorizontal: space.sm,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.monitorSoft,
    },
    pendingCountPillText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.monitor,
    },
    subGroupHeader: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    unassignedHorseCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    unassignedHorseName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    groomBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
    },
    groomBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: space.lg,
      paddingBottom: space.xl,
      gap: space.md,
      maxHeight: "85%",
    },
    modalHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingBottom: space.sm,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.foreground,
    },
    modalCloseBtn: {
      padding: 4,
    },
    modalHorseCard: {
      padding: space.md,
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      gap: space.sm,
    },
    modalHorseName: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.foreground,
    },
    modalHorseInfoRow: {
      flexDirection: "row",
      gap: space.md,
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    addBarnTabChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: space.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: "dashed",
      backgroundColor: colors.surface,
    },
    addBarnTabChipText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    addStallCard: {
      width: "48%",
      minHeight: 126,
      justifyContent: "center",
      alignItems: "center",
      padding: space.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.primary,
      backgroundColor: colors.fitSoft,
    },
    addStallContent: {
      alignItems: "center",
      gap: 4,
    },
    addStallIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.primary,
      marginBottom: 2,
    },
    addStallTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
      textAlign: "center",
    },
    addStallSubtitle: {
      fontSize: 11,
      color: colors.mutedForeground,
      textAlign: "center",
    },
    segmentContainer: {
      flexDirection: "row",
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      padding: 3,
      gap: 4,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
    },
    segmentBtnActive: {
      backgroundColor: colors.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    segmentBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    segmentBtnTextActive: {
      color: colors.foreground,
      fontWeight: "700",
    },
    unassignedCard: {
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: space.sm,
    },
    unassignedCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    unassignedCardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: space.sm,
    },
    unassignedStatusNote: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    unassignedStatusNoteText: {
      fontSize: 12,
      fontWeight: "600",
    },
    unassignedActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.sm,
    },
    unassignedActionBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primaryForeground,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: space.xs,
      gap: space.md,
    },
    switchTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
    },
    trainerCareBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: -space.md,
    },
    trainerCareBannerIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    trainerCareBannerTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    viewModeSegment: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    viewModeSegmentBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: space.xs,
      paddingVertical: 8,
      borderRadius: radius.sm,
    },
    viewModeSegmentBtnActive: {
      backgroundColor: colors.primary,
    },
    viewModeSegmentText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    viewModeSegmentTextActive: {
      color: colors.primaryForeground,
    },
    careOverviewHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: space.xs,
    },
    careOverviewBarnTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.foreground,
    },
    careRefreshBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    careSummaryMetricsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.xs,
      marginBottom: space.xs,
    },
    careSummaryMetricPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: space.sm,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    careSummaryMetricText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
    careHorseCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
    },
    careHorseCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    stallCodeBadge: {
      backgroundColor: colors.elevated,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    stallCodeBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    careHorseName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    careAspectsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.sm,
      paddingVertical: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    careAspectItem: {
      flex: 1,
      minWidth: "45%",
      gap: 2,
    },
    careAspectLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    careAspectLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.mutedForeground,
      textTransform: "uppercase",
    },
    careAspectValue: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
    },
    careStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 2,
    },
    careStatusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    careCardActionsRow: {
      flexDirection: "row",
      gap: space.xs,
      marginTop: 2,
    },
    careActionBtnPrimary: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      backgroundColor: colors.primary,
      paddingVertical: 8,
      borderRadius: radius.sm,
    },
    careActionBtnPrimaryText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primaryForeground,
    },
    careActionBtnSecondary: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 8,
      borderRadius: radius.sm,
    },
    careActionBtnSecondaryText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
  });
