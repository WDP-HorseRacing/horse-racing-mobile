import { Redirect, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  BottomSheetModal,
  DatePickerField,
  Field,
  NativeInput,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import { isRole } from "@/features/auth/roles";
import { horseService } from "@/services/horse.service";
import { medicalService, type CareTaskTypeDto } from "@/services/medical.service";
import { stableService, type GroomWorkloadDto } from "@/services/stable.service";
import type { CareScheduleDto } from "@/adapters/medical.adapter";
import type { HorseListItemDto } from "@/adapters/horse.adapter";
import {
  clubDateTimeParts,
  isNotPastDateTime,
  isValidRequiredText,
  toClubDateTime,
} from "@/features/medical/medical-validation";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/formatters";

type CareTypeConfig = {
  key: CareTaskTypeDto;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const careTypeConfigs: CareTypeConfig[] = [
  {
    key: "VACCINATION",
    label: "Tiêm phòng",
    desc: "Tiêm vaccine định kỳ phòng ngừa dịch bệnh (Chỉ giao Bác sĩ)",
    icon: "shield-checkmark-outline",
  },
  {
    key: "DEWORMING",
    label: "Tẩy giun",
    desc: "Uống thuốc tẩy ký sinh trùng đường ruột (Chỉ giao Bác sĩ)",
    icon: "medkit-outline",
  },
  {
    key: "FARRIER",
    label: "Chăm sóc móng",
    desc: "Gọt móng, kiểm tra hoặc đóng móng sắt (Giao Bác sĩ hoặc Groom)",
    icon: "cut-outline",
  },
];

type PersonnelOption = {
  id: string | null;
  name: string;
  roleTitle: string;
  assigneeType: "GROOM" | "VET" | null;
  detail?: string;
};

export default function CareSchedules() {
  const { role: roleParam, horseId: horseParam } = useLocalSearchParams<{
    role: string;
    horseId?: string;
  }>();
  const role = isRole(roleParam) ? roleParam : null;
  const initialHorseId = Array.isArray(horseParam) ? horseParam[0] : (horseParam ?? "");
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [initialDueParts] = useState(() =>
    clubDateTimeParts(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [selectedHorseId, setSelectedHorseId] = useState(initialHorseId);
  const [selectedHorse, setSelectedHorse] = useState<HorseListItemDto | null>(null);
  const [type, setType] = useState<CareTaskTypeDto>("VACCINATION");
  const [dueDate, setDueDate] = useState(initialDueParts.date);
  const [dueTime, setDueTime] = useState(initialDueParts.time);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Personnel selection state
  const [selectedPersonnel, setSelectedPersonnel] = useState<PersonnelOption>({
    id: null,
    name: "Chưa phân công",
    roleTitle: "Để trống",
    assigneeType: null,
  });
  const [editPersonnel, setEditPersonnel] = useState<PersonnelOption>({
    id: null,
    name: "Chưa phân công",
    roleTitle: "Để trống",
    assigneeType: null,
  });
  const [personnelPickerVisible, setPersonnelPickerVisible] = useState(false);
  const [editingForScheduleId, setEditingForScheduleId] = useState<string | null>(null);

  // Staff and groom lists
  const [grooms, setGrooms] = useState<GroomWorkloadDto[]>([]);

  const [notes, setNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("09:00");
  const [editReason, setEditReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingSchedule, setCancellingSchedule] = useState<CareScheduleDto | null>(null);
  const [reopeningSchedule, setReopeningSchedule] = useState<CareScheduleDto | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const nextDueTime = "09:00";
  const [saving, setSaving] = useState(false);

  // Horse picker state
  const [horsePickerVisible, setHorsePickerVisible] = useState(false);
  const [horseSearch, setHorseSearch] = useState("");
  const [allHorses, setAllHorses] = useState<HorseListItemDto[]>([]);

  const canManage = role === "vet";
  const canView = role && ["vet", "manager", "trainer", "groom", "owner"].includes(role);

  const loadSchedule = useCallback(
    () => medicalService.listCareSchedules(token!, selectedHorseId),
    [selectedHorseId, token],
  );
  const resource = useApiResource(loadSchedule, Boolean(token && selectedHorseId && canView));
  useRefreshOnFocus(resource.revalidate);

  // Load horses and grooms
  useEffect(() => {
    if (token && canView) {
      void horseService
        .list(token, "", { lifecycleStatus: "ACTIVE", includeDeleted: false })
        .then((list) => {
          setAllHorses(list);
          if (selectedHorseId) {
            const h = list.find((item) => item.id === selectedHorseId);
            if (h) setSelectedHorse(h);
          }
        });

      void stableService
        .listGroomWorkload(token)
        .then((res) => setGrooms(res))
        .catch(() => setGrooms([]));
    }
  }, [canView, selectedHorseId, token]);

  const schedules = resource.data ?? [];
  const selected = schedules.find((item) => item.id === selectedScheduleId);

  const handleSelectType = useCallback((newType: CareTaskTypeDto) => {
    setType(newType);
    if (newType === "VACCINATION" || newType === "DEWORMING") {
      setSelectedPersonnel((prev) =>
        prev.assigneeType === "GROOM"
          ? {
              id: null,
              name: "Chưa phân công",
              roleTitle: "Để trống",
              assigneeType: null,
            }
          : prev,
      );
    }
  }, []);

  // Construct available personnel options
  const getPersonnelOptions = useCallback(
    (taskType: CareTaskTypeDto): PersonnelOption[] => {
      const list: PersonnelOption[] = [
        {
          id: null,
          name: "Chưa phân công",
          roleTitle: "Để trống (Bác sĩ/Quản lý có thể gán sau)",
          assigneeType: null,
        },
      ];

      // Current user if Vet
      if (user) {
        list.push({
          id: user.userId,
          name: `${user.fullName} (Tôi)`,
          roleTitle: "Bác sĩ thú y",
          assigneeType: "VET",
          detail: "Phân công trực tiếp cho tài khoản của bạn",
        });
      }

      // Grooms are only allowed for FARRIER (Chăm sóc móng)
      if (taskType === "FARRIER") {
        list.push({
          id: null,
          name: "Groom phụ trách ngựa",
          roleTitle: "Groom chăm sóc ô chuồng của ngựa này",
          assigneeType: "GROOM",
          detail: "Tự động giao cho Groom đang phụ trách",
        });

        for (const g of grooms) {
          list.push({
            id: g.groomId,
            name: g.fullName,
            roleTitle: "Groom chăm sóc",
            assigneeType: "GROOM",
            detail: `Đang chăm sóc ${g.activeHorseCount} ngựa`,
          });
        }
      }

      return list;
    },
    [grooms, user],
  );

  const resolvePersonnelOption = useCallback(
    (
      taskType: CareTaskTypeDto,
      assigneeType: "GROOM" | "VET" | string | null | undefined,
      assignedTo: string | null | undefined,
    ): PersonnelOption => {
      const opts = getPersonnelOptions(taskType);
      if (!assigneeType) {
        return opts[0];
      }
      const found = opts.find(
        (o) => o.assigneeType === assigneeType && o.id === (assignedTo ?? null),
      );
      if (found) return found;
      if (assigneeType === "GROOM" && !assignedTo) {
        return {
          id: null,
          name: "Groom phụ trách ngựa",
          roleTitle: "Groom chăm sóc ô chuồng của ngựa này",
          assigneeType: "GROOM",
          detail: "Tự động giao cho Groom đang phụ trách",
        };
      }
      return {
        id: assignedTo ?? null,
        name: assignedTo ?? "Nhân sự được giao",
        roleTitle: assigneeType === "VET" ? "Bác sĩ thú y" : "Groom chăm sóc",
        assigneeType: assigneeType as "VET" | "GROOM",
      };
    },
    [getPersonnelOptions],
  );

  const activeModalType =
    editingForScheduleId && selected ? (selected.type as CareTaskTypeDto) : type;
  const personnelOptions: PersonnelOption[] = useMemo(() => {
    return getPersonnelOptions(activeModalType);
  }, [activeModalType, getPersonnelOptions]);

  const filteredHorses = useMemo(() => {
    const q = horseSearch.trim().toLowerCase();
    if (!q) return allHorses.slice(0, 30);
    return allHorses
      .filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.microchipId && h.microchipId.toLowerCase().includes(q)) ||
          (h.location?.barn?.name && h.location.barn.name.toLowerCase().includes(q)),
      )
      .slice(0, 30);
  }, [allHorses, horseSearch]);

  if (!role) return <Redirect href="/" />;
  if (!canView) return <Redirect href={`/${role}` as Href} />;

  const createSchedule = async () => {
    const dueAt = toClubDateTime(dueDate, dueTime);
    if (!selectedHorseId || !dueAt || !isNotPastDateTime(dueAt)) {
      Alert.alert(
        "Cần nhập thông tin lịch hẹn",
        "Vui lòng chọn ngựa và ngày đến hạn hợp lệ trong tương lai.",
      );
      return;
    }
    if (notes.trim().length > 2000) {
      Alert.alert("Ghi chú quá dài", "Ghi chú chăm sóc tối đa 2,000 ký tự.");
      return;
    }

    setSaving(true);
    try {
      await medicalService.createCareSchedule(token!, selectedHorseId, {
        type,
        dueAt,
        ...(selectedPersonnel.assigneeType ? { assigneeType: selectedPersonnel.assigneeType } : {}),
        ...(selectedPersonnel.id ? { assignedTo: selectedPersonnel.id } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      setNotes("");
      setShowCreateModal(false);
      setSelectedPersonnel({
        id: null,
        name: "Chưa phân công",
        roleTitle: "Để trống",
        assigneeType: null,
      });
      await resource.refresh();
      Alert.alert("Đã tạo lịch chăm sóc", "Lịch chăm sóc đã được lưu vào hồ sơ câu lạc bộ.");
    } catch (error) {
      Alert.alert("Không thể tạo lịch chăm sóc", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = async () => {
    if (!selected || !token) return;
    const dueAt = editDate ? toClubDateTime(editDate, editTime || "09:00") : null;
    if (editDate && (!dueAt || !isNotPastDateTime(dueAt))) {
      Alert.alert("Ngày đến hạn không hợp lệ", "Chọn ngày giờ trong tương lai.");
      return;
    }
    if (dueAt && !isValidRequiredText(editReason, 500)) {
      Alert.alert("Cần lý do dời lịch", "Vui lòng nhập lý do khi thay đổi ngày đến hạn.");
      return;
    }

    const assignmentChanged =
      editPersonnel.assigneeType !== selected.assigneeType ||
      (editPersonnel.id ?? null) !== (selected.assignedTo ?? null);

    setSaving(true);
    try {
      await medicalService.updateCareSchedule(token, selected.id, {
        ...(dueAt ? { dueAt, reason: editReason.trim() } : {}),
        ...(assignmentChanged
          ? {
              assigneeType: editPersonnel.assigneeType,
              assignedTo: editPersonnel.id ?? null,
            }
          : {}),
        ...(editNotes.trim() !== (selected.notes ?? "") ? { notes: editNotes.trim() } : {}),
      });

      setSelectedScheduleId("");
      setEditDate("");
      setEditTime("09:00");
      setEditReason("");
      setEditNotes("");
      await resource.refresh();
      Alert.alert("Đã cập nhật", "Thông tin lịch chăm sóc đã được điều chỉnh.");
    } catch (error) {
      Alert.alert("Không thể cập nhật lịch", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const completeSchedule = async (schedule: CareScheduleDto) => {
    const nextDueAt = nextDueDate ? toClubDateTime(nextDueDate, nextDueTime) : null;
    if (role === "vet" && nextDueDate && (!nextDueAt || !isNotPastDateTime(nextDueAt))) {
      Alert.alert("Ngày hẹn tiếp theo không hợp lệ", "Chọn ngày giờ hợp lệ trong tương lai.");
      return;
    }
    setSaving(true);
    try {
      await medicalService.completeCareSchedule(
        token!,
        schedule.id,
        role === "vet" ? (nextDueAt ?? undefined) : undefined,
      );
      setNextDueDate("");
      setSelectedScheduleId("");
      await resource.refresh();
      Alert.alert(
        "Đã hoàn tất lịch chăm sóc",
        role === "vet" && nextDueAt
          ? "Lần chăm sóc tiếp theo đã được tạo tự động."
          : "Lịch chăm sóc đã được đánh dấu hoàn thành.",
      );
    } catch (error) {
      Alert.alert("Không thể hoàn tất lịch", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const cancelSchedule = (schedule: CareScheduleDto) => {
    setCancellingSchedule(schedule);
    setCancelReason("");
  };

  const reopenSchedule = async () => {
    if (!reopeningSchedule || !token) return;
    if (!isValidRequiredText(reopenReason, 500)) {
      Alert.alert("Cần lý do mở lại", "Vui lòng nhập lý do (tối đa 500 ký tự).");
      return;
    }
    setSaving(true);
    try {
      await medicalService.reopenCareSchedule(
        token,
        reopeningSchedule.id,
        reopenReason.trim(),
      );
      setReopeningSchedule(null);
      setReopenReason("");
      await resource.refresh();
      Alert.alert(
        "Đã mở lại lịch chăm sóc",
        "Lịch đã chuyển về trạng thái Đã lên lịch. Lịch tiếp theo đã tạo trước đó vẫn được giữ.",
      );
    } catch (error) {
      Alert.alert("Không thể mở lại lịch", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      role={role}
      title="Lịch chăm sóc & tiêm phòng"
      subtitle={
        selectedHorse
          ? `Lịch chăm sóc của ${selectedHorse.name}`
          : "Chọn ngựa để xem và lên lịch chăm sóc"
      }
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      {/* Horse Selector Card */}
      <View style={styles.horseSelectCard}>
        <Text style={styles.inputSectionLabel}>Ngựa thực hiện chăm sóc</Text>
        {selectedHorse ? (
          <View style={styles.selectedHorseRow}>
            <View style={styles.horseAvatar}>
              <Ionicons name="paw" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedHorseName}>{selectedHorse.name}</Text>
              <Text style={styles.selectedHorseMeta}>
                {selectedHorse.location?.barn?.name ?? "Chưa xếp khu"}
                {selectedHorse.location?.stall?.code
                  ? ` · Ô ${selectedHorse.location.stall.code}`
                  : ""}
                {selectedHorse.microchipId ? ` · Chip: ${selectedHorse.microchipId}` : ""}
              </Text>
            </View>
            <Pressable onPress={() => setHorsePickerVisible(true)} style={styles.changeButton}>
              <Text style={styles.changeButtonText}>Đổi ngựa</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setHorsePickerVisible(true)} style={styles.pickHorseTrigger}>
            <Ionicons name="search-outline" size={18} color={colors.primary} />
            <Text style={styles.pickHorseTriggerText}>Nhấn để chọn ngựa cần xem lịch…</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {selectedHorseId ? (
        <>
          {/* Create Schedule Button for Vet */}
          {canManage ? (
            <PrimaryButton
              label="Tạo lịch chăm sóc mới"
              icon="add-circle-outline"
              onPress={() => setShowCreateModal(true)}
            />
          ) : null}

          {/* Modal Bottom Sheet: Tạo lịch chăm sóc mới */}
          <BottomSheetModal
            visible={showCreateModal}
            title="Tạo lịch chăm sóc mới"
            onClose={() => setShowCreateModal(false)}
            onSave={() => void createSchedule()}
            saveLoading={saving}
            saveDisabled={saving}
            saveLabel="Lưu"
            cancelLabel="Hủy"
          >
            {/* Vietnamese Care Types Selector */}
            <View>
              <Text style={styles.fieldLabel}>Loại chăm sóc *</Text>
              <View style={styles.careTypeRow}>
                {careTypeConfigs.map((cfg) => {
                  const isCurrent = type === cfg.key;
                  return (
                    <Pressable
                      key={cfg.key}
                      onPress={() => handleSelectType(cfg.key)}
                      style={[styles.careTypeCard, isCurrent && styles.careTypeCardActive]}
                    >
                      <Ionicons
                        name={cfg.icon}
                        size={20}
                        color={isCurrent ? colors.primary : colors.mutedForeground}
                      />
                      <Text
                        style={[styles.careTypeTitle, isCurrent && styles.careTypeTitleActive]}
                      >
                        {cfg.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.careTypeHint}>
                {careTypeConfigs.find((c) => c.key === type)?.desc}
              </Text>
            </View>

            {/* Due Date & Time */}
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <View style={{ flex: 1.4 }}>
                <Field label="Ngày đến hạn (YYYY-MM-DD) *">
                  <DatePickerField
                    value={dueDate}
                    onChangeText={setDueDate}
                    placeholder="YYYY-MM-DD"
                    outputFormat="YYYY-MM-DD"
                    title="Chọn ngày đến hạn"
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Giờ (HH:mm) *">
                  <NativeInput value={dueTime} onChangeText={setDueTime} placeholder="09:00" />
                </Field>
              </View>
            </View>

            {/* Interactive Personnel Picker Trigger */}
            <View>
              <Text style={styles.fieldLabel}>Nhân sự được phân công</Text>
              <Pressable
                onPress={() => {
                  setEditingForScheduleId(null);
                  setPersonnelPickerVisible(true);
                }}
                style={styles.personnelTrigger}
              >
                <View style={styles.personnelIconBox}>
                  <Ionicons
                    name={
                      selectedPersonnel.assigneeType === "VET"
                        ? "medical-outline"
                        : selectedPersonnel.assigneeType === "GROOM"
                          ? "person-outline"
                          : "help-circle-outline"
                    }
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personnelTriggerName}>{selectedPersonnel.name}</Text>
                  <Text style={styles.personnelTriggerDesc}>{selectedPersonnel.roleTitle}</Text>
                </View>
                <View style={styles.selectBadge}>
                  <Text style={styles.selectBadgeText}>Chọn</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </View>
              </Pressable>
              <Text style={styles.unassignedHint}>
                {selectedPersonnel.id === null && selectedPersonnel.assigneeType === null
                  ? "Lưu ý: Nếu để trống, lịch sẽ ở trạng thái Chưa phân công. Bác sĩ hoặc Quản lý có thể gán người thực hiện sau."
                  : (selectedPersonnel.detail ?? "")}
              </Text>
            </View>

            {/* Care Notes */}
            <Field label="Ghi chú & hướng dẫn chăm sóc">
              <NativeInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Nhập loại thuốc, liều lượng hoặc hướng dẫn đặc biệt..."
              />
            </Field>
          </BottomSheetModal>

          {/* Schedule History Section */}
          <View style={uiStyles.section}>
            <SectionTitle>Danh sách lịch chăm sóc ({schedules.length})</SectionTitle>
            {schedules.map((schedule) => {
              const isScheduled = schedule.status === "SCHEDULED";
              const isCompleted = schedule.status === "COMPLETED";
              const isCancelled = schedule.status === "CANCELLED";

              const typeConfig = careTypeConfigs.find((c) => c.key === schedule.type);
              const typeLabel = typeConfig?.label ?? schedule.type;
              const typeIcon = typeConfig?.icon ?? "medkit-outline";

              return (
                <View key={schedule.id} style={styles.scheduleCard}>
                  {/* Card Header Row */}
                  <View style={styles.scheduleHeaderRow}>
                    <View style={styles.typeBadge}>
                      <Ionicons name={typeIcon} size={15} color={colors.primary} />
                      <Text style={styles.typeBadgeText}>{typeLabel}</Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        isScheduled && styles.statusBadgeScheduled,
                        isCompleted && styles.statusBadgeCompleted,
                        isCancelled && styles.statusBadgeCancelled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isScheduled && styles.statusBadgeTextScheduled,
                          isCompleted && styles.statusBadgeTextCompleted,
                          isCancelled && styles.statusBadgeTextCancelled,
                        ]}
                      >
                        {isScheduled ? "ĐÃ LÊN LỊCH" : isCompleted ? "HOÀN THÀNH" : "ĐÃ HỦY"}
                      </Text>
                    </View>
                  </View>

                  {/* Due Date & Assignee Details */}
                  <View style={styles.scheduleDetailsBox}>
                    <View style={styles.detailItemRow}>
                      <Ionicons name="time-outline" size={15} color={colors.mutedForeground} />
                      <Text style={styles.detailItemText}>
                        Thời hạn:{" "}
                        <Text style={{ fontWeight: "700", color: colors.foreground }}>
                          {formatDateTime(schedule.dueAt)}
                        </Text>
                      </Text>
                    </View>

                    <View style={styles.detailItemRow}>
                      <Ionicons name="person-outline" size={15} color={colors.mutedForeground} />
                      <Text style={styles.detailItemText}>
                        Phân công:{" "}
                        <Text style={{ fontWeight: "700", color: colors.foreground }}>
                          {schedule.assignedTo
                            ? (grooms.find((g) => g.groomId === schedule.assignedTo)?.fullName ??
                              (user?.userId === schedule.assignedTo
                                ? `${user.fullName} (Tôi)`
                                : `Nhân sự ${schedule.assignedTo.slice(0, 8)}`))
                            : schedule.assigneeType === "GROOM"
                              ? "Groom phụ trách ngựa"
                              : "Chưa phân công"}
                        </Text>
                      </Text>
                    </View>

                    {schedule.notes ? (
                      <View style={styles.detailNotesBox}>
                        <Text style={styles.detailNotesText}>{schedule.notes}</Text>
                      </View>
                    ) : null}

                    {schedule.completedAt ? (
                      <Text style={styles.completedMetaText}>
                        Hoàn tất: {formatDateTime(schedule.completedAt)}
                      </Text>
                    ) : null}

                    {schedule.cancelReason ? (
                      <Text style={styles.cancelMetaText}>Lý do hủy: {schedule.cancelReason}</Text>
                    ) : null}
                  </View>

                  {/* Action Buttons */}
                  {isScheduled ? (
                    <View style={styles.cardActionsRow}>
                      {canManage ? (
                        <SecondaryButton
                          label="Dời ngày / Phân công lại"
                          onPress={() => {
                            setEditDate("");
                            setEditTime("09:00");
                            setEditReason("");
                            setEditNotes(schedule.notes ?? "");
                            setCancelReason("");
                            setEditPersonnel(
                              resolvePersonnelOption(
                                schedule.type as CareTaskTypeDto,
                                schedule.assigneeType as any,
                                schedule.assignedTo,
                              ),
                            );
                            setSelectedScheduleId(schedule.id);
                          }}
                        />
                      ) : null}

                      {role === "vet" ||
                      (role === "groom" &&
                        (schedule.assignedTo === user?.userId ||
                          (schedule.assigneeType === "GROOM" && !schedule.assignedTo))) ? (
                        <PrimaryButton
                          label={saving ? "Đang xử lý…" : "Đánh dấu hoàn tất"}
                          icon="checkmark-circle-outline"
                          disabled={saving}
                          onPress={() =>
                            Alert.alert(
                              "Hoàn thành lịch chăm sóc?",
                              role === "vet" && nextDueDate
                                ? "Lần chăm sóc tiếp theo sẽ được hệ thống tạo tự động."
                                : "Xác nhận lịch chăm sóc này đã được thực hiện xong.",
                              [
                                { text: "Quay lại", style: "cancel" },
                                {
                                  text: "Hoàn tất",
                                  onPress: () => void completeSchedule(schedule),
                                },
                              ],
                            )
                          }
                        />
                      ) : null}

                      {/* Cancel schedule button */}
                      {canManage ? (
                        <Pressable
                          onPress={() => cancelSchedule(schedule)}
                          style={styles.cancelButton}
                        >
                          <Ionicons name="trash-outline" size={15} color={colors.destructive} />
                          <Text style={styles.cancelButtonText}>Hủy lịch</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                  {isCompleted && role === "vet" ? (
                    <SecondaryButton
                      label="Mở lại lịch đã hoàn tất"
                      icon="refresh-outline"
                      disabled={saving}
                      onPress={() => {
                        setReopenReason("");
                        setReopeningSchedule(schedule);
                      }}
                    />
                  ) : null}
                </View>
              );
            })}

            {!schedules.length ? (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={44} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>Chưa có lịch chăm sóc</Text>
                <Text style={styles.emptySubtitle}>
                  Ngựa này chưa có lịch tiêm phòng, tẩy giun hay chăm sóc móng nào.
                </Text>
              </View>
            ) : null}
          </View>

          {/* Modal Bottom Sheet: Điều chỉnh lịch chăm sóc */}
          <BottomSheetModal
            visible={Boolean(selectedScheduleId)}
            title="Điều chỉnh lịch chăm sóc"
            onClose={() => setSelectedScheduleId("")}
            onSave={() => void updateSchedule()}
            saveLoading={saving}
            saveDisabled={saving || (Boolean(editDate) && !isValidRequiredText(editReason, 500))}
            saveLabel="Lưu"
            cancelLabel="Hủy"
          >
            <Field label="Ngày mới (bỏ trống nếu giữ nguyên)">
              <DatePickerField
                value={editDate}
                onChangeText={setEditDate}
                placeholder="YYYY-MM-DD"
                outputFormat="YYYY-MM-DD"
                title="Chọn ngày dời lịch"
              />
            </Field>
            <Field label="Giờ mới">
              <NativeInput
                value={editTime}
                onChangeText={setEditTime}
                placeholder="09:00"
              />
            </Field>
            {editDate ? (
              <Field label="Lý do dời ngày *">
                <NativeInput
                  value={editReason}
                  onChangeText={setEditReason}
                  placeholder="Nhập lý do dời ngày chăm sóc"
                  multiline
                />
              </Field>
            ) : null}
            <Field label="Phân công nhân sự">
              <Pressable
                style={styles.personnelTrigger}
                onPress={() => {
                  setEditingForScheduleId(selectedScheduleId);
                  setPersonnelPickerVisible(true);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.personnelTriggerName}>{editPersonnel.name}</Text>
                  <Text style={styles.personnelTriggerDesc}>
                    {editPersonnel.roleTitle}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </Field>
            <Field label="Cập nhật ghi chú">
              <NativeInput value={editNotes} onChangeText={setEditNotes} multiline />
            </Field>
          </BottomSheetModal>
        </>
      ) : null}

      {/* PERSONNEL PICKER MODAL */}
      <Modal visible={personnelPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Phân công nhân sự</Text>
                <Text style={styles.modalSubtitle}>
                  {activeModalType === "FARRIER"
                    ? "Chọn Groom phụ trách hoặc Bác sĩ thú y để thực hiện"
                    : "Lịch tiêm phòng / tẩy giun chỉ được thực hiện bởi Bác sĩ"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setPersonnelPickerVisible(false);
                  setEditingForScheduleId(null);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 8, paddingVertical: space.sm }}>
              {personnelOptions.map((opt, idx) => {
                const currentPersonnel = editingForScheduleId ? editPersonnel : selectedPersonnel;
                const isCurrent =
                  currentPersonnel.id === opt.id &&
                  currentPersonnel.assigneeType === opt.assigneeType;

                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      if (editingForScheduleId) {
                        setEditPersonnel(opt);
                      } else {
                        setSelectedPersonnel(opt);
                      }
                      setPersonnelPickerVisible(false);
                      setEditingForScheduleId(null);
                    }}
                    style={[styles.personnelItem, isCurrent && styles.personnelItemActive]}
                  >
                    <View
                      style={[
                        styles.personnelItemAvatar,
                        opt.assigneeType === "VET" && styles.avatarVet,
                        opt.assigneeType === "GROOM" && styles.avatarGroom,
                      ]}
                    >
                      <Ionicons
                        name={
                          opt.assigneeType === "VET"
                            ? "medical"
                            : opt.assigneeType === "GROOM"
                              ? "person"
                              : "remove"
                        }
                        size={16}
                        color={isCurrent ? colors.primary : colors.foreground}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.personnelItemName, isCurrent && { color: colors.primary }]}
                      >
                        {opt.name}
                      </Text>
                      <Text style={styles.personnelItemRole}>{opt.roleTitle}</Text>
                      {opt.detail ? (
                        <Text style={styles.personnelItemDetail}>{opt.detail}</Text>
                      ) : null}
                    </View>
                    {isCurrent ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CANCEL CARE SCHEDULE MODAL */}
      <Modal visible={Boolean(cancellingSchedule)} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { gap: space.md }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Hủy lịch chăm sóc</Text>
                <Text style={styles.modalSubtitle}>
                  Lịch đã hủy sẽ không thể khôi phục. Vui lòng nhập lý do hủy lịch.
                </Text>
              </View>
              <Pressable
                onPress={() => setCancellingSchedule(null)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <Field label="Lý do hủy (bắt buộc) *">
              <NativeInput
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="Nhập lý do hủy lịch chăm sóc"
                multiline
                numberOfLines={3}
              />
            </Field>

            <View style={{ flexDirection: "row", gap: space.sm }}>
              <SecondaryButton
                label="Đóng"
                style={{ flex: 1 }}
                onPress={() => setCancellingSchedule(null)}
              />
              <PrimaryButton
                label={saving ? "Đang hủy…" : "Xác nhận hủy"}
                style={{ flex: 1, backgroundColor: colors.destructive }}
                disabled={saving || !cancelReason.trim()}
                onPress={() => {
                  if (!cancellingSchedule || !token) return;
                  if (!isValidRequiredText(cancelReason, 500)) {
                    Alert.alert(
                      "Cần lý do hủy",
                      "Vui lòng nhập lý do hủy lịch chăm sóc (tối đa 500 ký tự).",
                    );
                    return;
                  }
                  setSaving(true);
                  void medicalService
                    .cancelCareSchedule(token, cancellingSchedule.id, cancelReason.trim())
                    .then(async () => {
                      setCancellingSchedule(null);
                      setCancelReason("");
                      await resource.refresh();
                      Alert.alert("Thành công", "Lịch chăm sóc đã được hủy.");
                    })
                    .catch((error) => Alert.alert("Không thể hủy lịch", extractErrorMessage(error)))
                    .finally(() => setSaving(false));
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(reopeningSchedule)} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { gap: space.md }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Mở lại lịch chăm sóc</Text>
                <Text style={styles.modalSubtitle}>
                  Lịch đã hoàn tất sẽ trở về Đã lên lịch; lịch lần tới đã tạo vẫn được giữ.
                </Text>
              </View>
              <Pressable
                onPress={() => setReopeningSchedule(null)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <Field label="Lý do mở lại (bắt buộc) *">
              <NativeInput
                value={reopenReason}
                onChangeText={setReopenReason}
                placeholder="Ví dụ: đánh dấu hoàn tất nhầm"
                multiline
                numberOfLines={3}
              />
            </Field>

            <View style={{ flexDirection: "row", gap: space.sm }}>
              <SecondaryButton
                label="Đóng"
                style={{ flex: 1 }}
                disabled={saving}
                onPress={() => setReopeningSchedule(null)}
              />
              <PrimaryButton
                label={saving ? "Đang mở lại…" : "Xác nhận mở lại"}
                style={{ flex: 1 }}
                disabled={saving || !reopenReason.trim()}
                onPress={() => void reopenSchedule()}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* HORSE PICKER MODAL */}
      <Modal visible={horsePickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Chọn ngựa</Text>
                <Text style={styles.modalSubtitle}>Tìm kiếm theo tên hoặc khu chuồng</Text>
              </View>
              <Pressable
                onPress={() => setHorsePickerVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <Field label="Tìm kiếm ngựa">
              <NativeInput
                value={horseSearch}
                onChangeText={setHorseSearch}
                placeholder="Nhập tên ngựa..."
                autoFocus
              />
            </Field>

            <ScrollView contentContainerStyle={{ gap: 6, paddingVertical: space.sm }}>
              {filteredHorses.map((h) => {
                const isCurrent = selectedHorseId === h.id;
                return (
                  <Pressable
                    key={h.id}
                    onPress={() => {
                      setSelectedHorseId(h.id);
                      setSelectedHorse(h);
                      setHorsePickerVisible(false);
                    }}
                    style={[styles.horseListItem, isCurrent && styles.horseListItemActive]}
                  >
                    <View style={styles.horseListAvatar}>
                      <Ionicons
                        name="paw"
                        size={16}
                        color={isCurrent ? colors.primary : colors.foreground}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.horseListName, isCurrent && { color: colors.primary }]}>
                        {h.name}
                      </Text>
                      <Text style={styles.horseListLocation}>
                        {h.location?.barn?.name ?? "Chưa xếp khu"}
                        {h.location?.stall?.code ? ` · Ô ${h.location.stall.code}` : ""}
                        {h.microchipId ? ` · Chip: ${h.microchipId}` : ""}
                      </Text>
                    </View>
                    {isCurrent ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    horseSelectCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      marginBottom: space.sm,
    },
    inputSectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
      marginBottom: 6,
    },
    selectedHorseRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.md,
      padding: space.md,
    },
    horseAvatar: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    selectedHorseName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    selectedHorseMeta: {
      fontSize: 12,
      color: colors.primary,
      marginTop: 2,
    },
    changeButton: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
    },
    changeButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    pickHorseTrigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: space.md,
    },
    pickHorseTriggerText: {
      fontSize: 14,
      color: colors.mutedForeground,
      flex: 1,
    },
    createCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.md,
      marginBottom: space.md,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
      marginBottom: 6,
    },
    careTypeRow: {
      flexDirection: "row",
      gap: space.sm,
    },
    careTypeCard: {
      flex: 1,
      paddingVertical: space.md,
      paddingHorizontal: space.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    careTypeCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.fitSoft,
      borderWidth: 2,
    },
    careTypeTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.foreground,
      textAlign: "center",
    },
    careTypeTitleActive: {
      color: colors.primary,
    },
    careTypeHint: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 4,
      lineHeight: 15,
    },
    personnelTrigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: space.md,
    },
    personnelIconBox: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    personnelTriggerName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    personnelTriggerDesc: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    selectBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      backgroundColor: colors.fitSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    selectBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    unassignedHint: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 4,
      lineHeight: 15,
    },
    scheduleCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
      marginBottom: space.sm,
    },
    scheduleHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    typeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.fitSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    typeBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    statusBadgeScheduled: {
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    statusBadgeCompleted: {
      backgroundColor: colors.fitSoft,
    },
    statusBadgeCancelled: {
      backgroundColor: colors.injuredSoft,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    statusBadgeTextScheduled: {
      color: colors.primary,
    },
    statusBadgeTextCompleted: {
      color: colors.monitor,
    },
    statusBadgeTextCancelled: {
      color: colors.destructive,
    },
    scheduleDetailsBox: {
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      gap: 4,
    },
    detailItemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    detailItemText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    detailNotesBox: {
      backgroundColor: colors.surface,
      padding: space.xs,
      borderRadius: 6,
      marginTop: 2,
    },
    detailNotesText: {
      fontSize: 12,
      color: colors.foreground,
      lineHeight: 16,
    },
    completedMetaText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: "600",
      marginTop: 2,
    },
    cancelMetaText: {
      fontSize: 11,
      color: colors.destructive,
      fontWeight: "600",
      marginTop: 2,
    },
    cardActionsRow: {
      gap: space.xs,
      marginTop: 2,
    },
    cancelButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 6,
    },
    cancelButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.destructive,
    },
    editDrawer: {
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      gap: space.xs,
      marginTop: space.xs,
    },
    editDrawerTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 2,
    },
    emptyCard: {
      alignItems: "center",
      justifyContent: "center",
      padding: space.xl,
      gap: space.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: space.sm,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      marginTop: space.xs,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
    },
    // MODAL STYLES
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: space.lg,
      maxHeight: "90%",
      gap: space.md,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingBottom: space.sm,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    modalCloseButton: {
      padding: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
    },
    personnelItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
    },
    personnelItemActive: {
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    personnelItemAvatar: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarVet: {
      backgroundColor: colors.fitSoft,
    },
    avatarGroom: {
      backgroundColor: colors.muted,
    },
    personnelItemName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    personnelItemRole: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    personnelItemDetail: {
      fontSize: 11,
      color: colors.primary,
      marginTop: 2,
    },
    horseListItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
    },
    horseListItemActive: {
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    horseListAvatar: {
      width: 30,
      height: 30,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    horseListName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    horseListLocation: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 1,
    },
  });
}
