import { type Href, router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import {
  Chips,
  DatePickerField,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { AsyncStateView, Screen } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { useApiResource } from "@/hooks/useApiResource";
import { usersService } from "@/services/users.service";
import { Ionicons } from "@expo/vector-icons";
import { radius, space } from "@/config/theme";
import { horseService } from "@/services/horse.service";
import { stableService } from "@/services/stable.service";
import { mediaService, type LocalMediaAsset } from "@/services/media.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import type { StaffDto } from "@/adapters/staff.adapter";
import type { CreateHorseInput, HorseGenderDto } from "@/adapters/horse.adapter";
import {
  clubDate,
  isValidIsoDate,
  normalizeVietnamese,
  parseToIsoDate,
  subtractYears,
  validateHorseIdentity,
} from "@/utils/horse-validation";
import { useI18n } from "@/context/I18nContext";

import { rememberRecentlyCreatedHorse } from "@/utils/recentHorses";
import * as DocumentPicker from "expo-document-picker";

type SaveMode = "open" | "another";

export default function RegisterHorse() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { t } = useI18n();
  const { token, role, isLoading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<HorseGenderDto>("MALE");
  const [microchipId, setMicrochipId] = useState("");
  const [breed, setBreed] = useState("");
  const [color, setColor] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [sireId, setSireId] = useState("");
  const [damId, setDamId] = useState("");
  const [barnId, setBarnId] = useState("");
  const [photo, setPhoto] = useState<LocalMediaAsset | null>(null);
  const [uploadedPhotoId, setUploadedPhotoId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sireSearch, setSireSearch] = useState("");
  const [damSearch, setDamSearch] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [barnSearch, setBarnSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const savingRef = useRef(false);

  const loadOwners = useCallback(() => usersService.list(token!), [token]);
  const ownersResource = useApiResource(loadOwners, Boolean(token && role === "manager"));
  const owners = useMemo(
    () =>
      (ownersResource.data ?? []).filter(
        (user: StaffDto) => user.role === "HORSE_OWNER" && user.status === "ACTIVE",
      ),
    [ownersResource.data],
  );
  const loadHorses = useCallback(() => horseService.list(token!), [token]);
  const horsesResource = useApiResource(loadHorses, Boolean(token && role === "manager"));
  const loadBarns = useCallback(() => stableService.listBarns(token!), [token]);
  const barnsResource = useApiResource(loadBarns, Boolean(token && role === "manager"));
  const candidateSires = useMemo(() => {
    let list = (horsesResource.data ?? []).filter(
      (horse) => ["MALE", "GELDING"].includes(horse.gender ?? "") && !horse.isDeleted,
    );
    const isoDob = parseToIsoDate(dateOfBirth);
    if (isoDob && isValidIsoDate(isoDob)) {
      const maxDob = subtractYears(isoDob, 2);
      list = list.filter((horse) => !horse.dateOfBirth || horse.dateOfBirth <= maxDob);
    }
    return list;
  }, [horsesResource.data, dateOfBirth]);

  const candidateDams = useMemo(() => {
    let list = (horsesResource.data ?? []).filter(
      (horse) => horse.gender === "FEMALE" && !horse.isDeleted,
    );
    const isoDob = parseToIsoDate(dateOfBirth);
    if (isoDob && isValidIsoDate(isoDob)) {
      const maxDob = subtractYears(isoDob, 2);
      list = list.filter((horse) => !horse.dateOfBirth || horse.dateOfBirth <= maxDob);
    }
    return list;
  }, [horsesResource.data, dateOfBirth]);
  const availableBarns = (barnsResource.data ?? []).filter(
    (barn) => barn.status === "ACTIVE" && barn.hasActiveHeadTrainer && barn.availableStallCount > 0,
  );
  const filterByQuery = <T extends { id: string; name?: string; fullName?: string }>(
    items: T[],
    query: string,
  ) => {
    const trimmed = query.trim();
    if (!trimmed) return items;
    const rawQuery = trimmed.toLowerCase();
    const normQuery = normalizeVietnamese(trimmed);
    return items.filter((item) => {
      const text = `${item.name ?? item.fullName ?? ""} ${item.id}`;
      const rawText = text.toLowerCase();
      if (rawText.includes(rawQuery)) return true;
      return normalizeVietnamese(text).includes(normQuery);
    });
  };

  const resetForm = () => {
    setName("");
    setGender("MALE");
    setMicrochipId("");
    setBreed("");
    setColor("");
    setDateOfBirth("");
    setOwnerId("");
    setSireId("");
    setDamId("");
    setBarnId("");
    setPhoto(null);
    setUploadedPhotoId(null);
    setSireSearch("");
    setDamSearch("");
    setOwnerSearch("");
    setBarnSearch("");
    setFormError("");
  };

  const microchipError = useMemo(() => {
    const val = microchipId.trim();
    if (!val) return "";
    if (!/^\d+$/.test(val)) return t("Mã microchip chỉ được chứa các chữ số.");
    if (val.length !== 15)
      return `${t("Mã microchip phải gồm đúng 15 chữ số")} (${val.length}/15).`;
    return "";
  }, [microchipId, t]);

  const duplicateChipHorse = useMemo(() => {
    const chip = microchipId.trim();
    if (!chip || !horsesResource.data) return null;
    return (
      horsesResource.data.find(
        (h) => h.microchipId && h.microchipId.toLowerCase() === chip.toLowerCase(),
      ) ?? null
    );
  }, [microchipId, horsesResource.data]);

  const dobError = useMemo(() => {
    const val = dateOfBirth.trim();
    if (!val) return "";
    const iso = parseToIsoDate(val);
    if (!iso || !isValidIsoDate(iso))
      return t("Date of birth must be a valid date in DD-MM-YYYY format.");
    const today = clubDate();
    const [year, month, day] = iso.split("-").map(Number);
    const birth = new Date(Date.UTC(year, month - 1, day));
    const [nowYear, nowMonth, nowDay] = today.split("-").map(Number);
    const now = new Date(Date.UTC(nowYear, nowMonth - 1, nowDay));
    const ageYears = (now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 1) return t("Ngựa phải từ 1 tuổi trở lên.");
    if (ageYears > 40) return t("Ngựa không được quá 40 tuổi.");
    return "";
  }, [dateOfBirth, t]);

  const nameError = useMemo(() => {
    const val = name.trim();
    if (!val) return "";
    if (val.length > 160) return t("Tên ngựa không được vượt quá 160 ký tự.");
    return "";
  }, [name, t]);

  const submit = async (mode: SaveMode) => {
    if (!token || role !== "manager" || savingRef.current) return;
    if (!microchipId.trim()) {
      setFormError("Enter the 15-digit microchip ID.");
      return;
    }
    if (!/^\d{15}$/.test(microchipId.trim())) {
      setFormError("Microchip must contain exactly 15 digits.");
      return;
    }
    if (!ownerId) {
      setFormError("Select an owner for the horse.");
      return;
    }
    const isoDob = parseToIsoDate(dateOfBirth);
    const validationError = validateHorseIdentity({
      name,
      breed,
      color,
      microchipId,
      dateOfBirth: isoDob,
      gender,
      sireId,
      damId,
      horses: horsesResource.data ?? [],
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError("");
    try {
      let mediaId = uploadedPhotoId;
      if (photo && !mediaId) {
        setUploadingPhoto(true);
        mediaId = await mediaService.uploadHorsePhoto(token, photo);
        setUploadedPhotoId(mediaId);
        setUploadingPhoto(false);
      }
      const input: CreateHorseInput = {
        name: name.trim(),
        gender,
        microchipId: microchipId.trim(),
        ownerId,
        ...(breed.trim() ? { breed: breed.trim() } : {}),
        ...(color.trim() ? { color: color.trim() } : {}),
        ...(isoDob ? { dateOfBirth: isoDob } : {}),
        ...(sireId ? { sireId } : {}),
        ...(damId ? { damId } : {}),
        ...(barnId ? { barnId } : {}),
        ...(mediaId ? { mediaId } : {}),
      };
      const created = await horseService.create(token, input);
      await rememberRecentlyCreatedHorse(created.id);
      if (mode === "another") {
        Alert.alert(
          "Horse registered",
          `${created.name} is saved. You can register another horse.`,
        );
        resetForm();
      } else {
        router.replace(`/manager/horse/${created.id}` as Href);
      }
    } catch (error) {
      const message = extractErrorMessage(error);
      setFormError(message);
      Alert.alert("Could not register horse", message);
    } finally {
      setUploadingPhoto(false);
      savingRef.current = false;
      setSaving(false);
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Quyền thư viện ảnh",
        "Vui lòng cấp quyền truy cập thư viện ảnh để tải ảnh ngựa.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const picked = result.assets[0];
      const name = picked.fileName || picked.uri.split("/").pop() || "horse-photo.jpg";
      setPhoto({
        name,
        uri: picked.uri,
        size: picked.fileSize,
        mimeType: picked.mimeType || "image/jpeg",
      });
      setUploadedPhotoId(null);
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Quyền máy ảnh", "Vui lòng cấp quyền truy cập máy ảnh để chụp ảnh ngựa.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const picked = result.assets[0];
      const name = picked.fileName || picked.uri.split("/").pop() || "horse-photo.jpg";
      setPhoto({
        name,
        uri: picked.uri,
        size: picked.fileSize,
        mimeType: picked.mimeType || "image/jpeg",
      });
      setUploadedPhotoId(null);
    }
  };

  const pickFromDocument = async () => {
    try {
      const docResult = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!docResult.canceled && docResult.assets[0]) {
        const picked = docResult.assets[0];
        const name = picked.name || "horse-photo.jpg";
        setPhoto({
          name,
          uri: picked.uri,
          size: picked.size,
          mimeType:
            picked.mimeType ||
            (name.toLowerCase().endsWith(".png")
              ? "image/png"
              : name.toLowerCase().endsWith(".webp")
                ? "image/webp"
                : "image/jpeg"),
        });
        setUploadedPhotoId(null);
      }
    } catch (err) {
      Alert.alert("Lỗi chọn tệp", extractErrorMessage(err));
    }
  };

  const choosePhoto = () => {
    Alert.alert("Tải ảnh ngựa", "Chọn nguồn ảnh tải lên:", [
      { text: "Thư viện ảnh", onPress: () => void pickFromLibrary() },
      { text: "Chụp ảnh mới", onPress: () => void pickFromCamera() },
      { text: "Chọn tệp (.jpg, .jpeg, .png...)", onPress: () => void pickFromDocument() },
      { text: "Hủy", style: "cancel" },
    ]);
  };

  return (
    <Screen
      role="manager"
      title="Register horse"
      subtitle="Identity, pedigree and initial barn"
      back
      fallbackHref="/manager/horses"
      refreshing={
        ownersResource.isRefreshing || horsesResource.isRefreshing || barnsResource.isRefreshing
      }
      onRefresh={() =>
        void Promise.all([
          ownersResource.refresh(),
          horsesResource.refresh(),
          barnsResource.refresh(),
        ])
      }
    >
      {authLoading ? (
        <AsyncStateView isLoading error={null} onRetry={() => undefined} />
      ) : role !== "manager" ? (
        <Panel>
          <Text>This role cannot register horse profiles.</Text>
        </Panel>
      ) : (
        <>
          {/* Group 1: Nhận dạng & Ngoại hình */}
          <Panel style={{ gap: space.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingBottom: space.sm,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.md,
                  backgroundColor: colors.fitSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="finger-print-outline" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                  1. Nhận dạng & Ngoại hình
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                  Tên ngựa, vi mạch, giới tính, màu lông và ngày sinh
                </Text>
              </View>
            </View>

            <View style={{ gap: 14 }}>
              <Field label="Tên ngựa *">
                <NativeInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ví dụ: Red Rum, Secretariat..."
                />
                {nameError ? (
                  <Text
                    style={{
                      color: colors.destructive,
                      fontSize: 12,
                      marginTop: 4,
                      fontWeight: "600",
                    }}
                  >
                    {nameError}
                  </Text>
                ) : null}
              </Field>

              <Field label="Giới tính *">
                <Chips
                  options={["MALE", "FEMALE", "GELDING"]}
                  value={gender}
                  onChange={(value) => setGender(value as HorseGenderDto)}
                />
              </Field>

              <Field label="Mã vi mạch (Microchip ID) *">
                <NativeInput
                  value={microchipId}
                  onChangeText={setMicrochipId}
                  placeholder="15 chữ số tiêu chuẩn ISO (bắt buộc)"
                  keyboardType="number-pad"
                />
                {duplicateChipHorse ? (
                  <View style={[uiStyles.alert, { marginTop: 6, gap: 4 }]}>
                    <Text style={{ color: colors.destructive, fontSize: 13, fontWeight: "600" }}>
                      {t("Microchip này đã được đăng ký cho")} {duplicateChipHorse.name} (
                      {t(duplicateChipHorse.lifecycleStatus)}).
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push(`/manager/horse/${duplicateChipHorse.id}` as Href)}
                      style={{ alignSelf: "flex-start", marginTop: 2 }}
                    >
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 13,
                          fontWeight: "700",
                          textDecorationLine: "underline",
                        }}
                      >
                        {t("Xem hồ sơ")} →
                      </Text>
                    </Pressable>
                  </View>
                ) : microchipError ? (
                  <Text
                    style={{
                      color: colors.destructive,
                      fontSize: 12,
                      marginTop: 4,
                      fontWeight: "600",
                    }}
                  >
                    {microchipError}
                  </Text>
                ) : null}
              </Field>

              <Field label="Giống ngựa">
                <NativeInput
                  value={breed}
                  onChangeText={setBreed}
                  placeholder="Ví dụ: Thoroughbred, Arabian..."
                />
              </Field>

              <Field label="Màu lông">
                <NativeInput
                  value={color}
                  onChangeText={setColor}
                  placeholder="Ví dụ: Bay, Chestnut, Grey..."
                />
              </Field>

              <Field label="Ngày sinh (DD-MM-YYYY)">
                <DatePickerField
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="DD-MM-YYYY (ví dụ: 20-05-2021)"
                />
                {dobError ? (
                  <Text
                    style={{
                      color: colors.destructive,
                      fontSize: 12,
                      marginTop: 4,
                      fontWeight: "600",
                    }}
                  >
                    {dobError}
                  </Text>
                ) : null}
              </Field>

              <View style={uiStyles.section}>
                <Text style={uiStyles.value}>Ảnh đại diện hồ sơ</Text>
                {photo ? (
                  <View style={{ gap: 8, alignItems: "flex-start" }}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={{ width: "100%", height: 160, borderRadius: radius.md }}
                      resizeMode="cover"
                    />
                    <Text style={uiStyles.muted} numberOfLines={1} ellipsizeMode="middle">
                      {photo.name}
                    </Text>
                    <SecondaryButton
                      label="Xóa ảnh"
                      icon="trash-outline"
                      onPress={() => {
                        setPhoto(null);
                        setUploadedPhotoId(null);
                      }}
                    />
                  </View>
                ) : (
                  <SecondaryButton
                    label="Tải ảnh chân dung ngựa lên"
                    icon="image-outline"
                    onPress={() => void choosePhoto()}
                    disabled={saving}
                  />
                )}
                <Text style={uiStyles.muted}>Hỗ trợ JPEG, PNG hoặc WebP · Tối đa 10 MB</Text>
              </View>
            </View>
          </Panel>

          {/* Group 2: Nguồn gốc & Phả hệ */}
          <Panel style={{ gap: space.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingBottom: space.sm,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.md,
                  backgroundColor: colors.trainingSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="git-network-outline" size={18} color={colors.training} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                  2. Nguồn gốc & Phả hệ
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                  Liên kết hồ sơ ngựa cha (Sire) và ngựa mẹ (Dam) trong câu lạc bộ
                </Text>
              </View>
            </View>

            <View style={{ gap: 14 }}>
              <Field label="Ngựa Cha - Sire (Tùy chọn)">
                <NativeInput
                  value={sireSearch}
                  onChangeText={setSireSearch}
                  placeholder="Tìm theo tên hoặc mã ngựa cha"
                />
                <SelectionChips
                  loading={horsesResource.isLoading}
                  error={horsesResource.error}
                  onRetry={() => void horsesResource.retry()}
                  options={filterByQuery(candidateSires, sireSearch).map((horse) => ({
                    id: horse.id,
                    label: `${horse.name} · ${horse.id.slice(0, 6)}`,
                  }))}
                  value={sireId}
                  onChange={(value) => {
                    if (value === sireId) {
                      setSireId("");
                      setSireSearch("");
                    } else {
                      const selected = candidateSires.find((h) => h.id === value);
                      setSireId(value);
                      setSireSearch(selected?.name ?? "");
                    }
                  }}
                  emptyLabel="Chưa có hồ sơ ngựa cha phù hợp."
                />
              </Field>

              <Field label="Ngựa Mẹ - Dam (Tùy chọn)">
                <NativeInput
                  value={damSearch}
                  onChangeText={setDamSearch}
                  placeholder="Tìm theo tên hoặc mã ngựa mẹ"
                />
                <SelectionChips
                  loading={horsesResource.isLoading}
                  error={horsesResource.error}
                  onRetry={() => void horsesResource.retry()}
                  options={filterByQuery(candidateDams, damSearch).map((horse) => ({
                    id: horse.id,
                    label: `${horse.name} · ${horse.id.slice(0, 6)}`,
                  }))}
                  value={damId}
                  onChange={(value) => {
                    if (value === damId) {
                      setDamId("");
                      setDamSearch("");
                    } else {
                      const selected = candidateDams.find((h) => h.id === value);
                      setDamId(value);
                      setDamSearch(selected?.name ?? "");
                    }
                  }}
                  emptyLabel="Chưa có hồ sơ ngựa mẹ phù hợp."
                />
              </Field>
            </View>
          </Panel>

          {/* Group 3: Chủ sở hữu */}
          <Panel style={{ gap: space.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingBottom: space.sm,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.md,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                  3. Chủ sở hữu & Hồ sơ pháp trị
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                  Chủ sở hữu hợp pháp đăng ký chịu trách nhiệm về ngựa
                </Text>
              </View>
            </View>

            <View style={{ gap: 14 }}>
              <Field label="Chủ sở hữu chính *">
                <NativeInput
                  value={ownerSearch}
                  onChangeText={setOwnerSearch}
                  placeholder="Tìm kiếm chủ sở hữu đang hoạt động"
                />
                <SelectionChips
                  loading={ownersResource.isLoading}
                  error={ownersResource.error}
                  onRetry={() => void ownersResource.retry()}
                  options={filterByQuery(owners, ownerSearch).map((owner) => ({
                    id: owner.id,
                    label: owner.fullName,
                  }))}
                  value={ownerId}
                  onChange={(value) => {
                    if (value === ownerId) {
                      setOwnerId("");
                      setOwnerSearch("");
                    } else {
                      const selected = owners.find((o) => o.id === value);
                      setOwnerId(value);
                      setOwnerSearch(selected?.fullName ?? "");
                    }
                  }}
                  emptyLabel="Không tìm thấy chủ sở hữu nào đang hoạt động."
                />
              </Field>
            </View>
          </Panel>

          {/* Group 4: Khu nuôi ban đầu */}
          <Panel style={{ gap: space.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingBottom: space.sm,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.md,
                  backgroundColor: colors.fitSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="home-outline" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                  4. Khu nuôi & Chuồng trại ban đầu
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                  Chỉ định Barn có ô chuồng trống và Head Trainer phụ trách
                </Text>
              </View>
            </View>

            <View style={{ gap: 14 }}>
              <Field label="Khu chuồng ban đầu (Tùy chọn)">
                <NativeInput
                  value={barnSearch}
                  onChangeText={setBarnSearch}
                  placeholder="Tìm chuồng đang mở và có ô trống"
                />
                <SelectionChips
                  loading={barnsResource.isLoading}
                  error={barnsResource.error}
                  onRetry={() => void barnsResource.retry()}
                  options={filterByQuery(availableBarns, barnSearch).map((barn) => ({
                    id: barn.id,
                    label: `${barn.name} · Còn ${barn.availableStallCount} ô trống`,
                  }))}
                  value={barnId}
                  onChange={(value) => {
                    setBarnId(value);
                    setBarnSearch("");
                  }}
                  emptyLabel="Không có khu chuồng nào đang mở có ô trống và HLV trưởng. Ngựa sẽ ở trạng thái chờ xếp chuồng."
                />
              </Field>
            </View>
          </Panel>

          {/* Prominent Action Bar */}
          <Panel
            style={{
              gap: space.sm,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            {formError ? (
              <View style={[uiStyles.alert, { marginBottom: 4 }]}>
                <Text style={{ color: colors.destructive, fontWeight: "700", fontSize: 13 }}>
                  ⚠️ {formError}
                </Text>
              </View>
            ) : null}

            <PrimaryButton
              label={
                uploadingPhoto ? "Đang tải ảnh lên…" : saving ? "Đang lưu…" : "Lưu và mở hồ sơ ngựa"
              }
              icon="checkmark-circle"
              disabled={saving || Boolean(nameError || microchipError || dobError)}
              onPress={() => void submit("open")}
            />

            <SecondaryButton
              label={
                uploadingPhoto ? "Đang tải ảnh lên…" : saving ? "Đang lưu…" : "Lưu và đăng ký tiếp"
              }
              icon="add-circle-outline"
              disabled={saving || Boolean(nameError || microchipError || dobError)}
              onPress={() => void submit("another")}
            />
          </Panel>
        </>
      )}
    </Screen>
  );
}

function SelectionChips({
  loading,
  error,
  onRetry,
  options,
  value,
  onChange,
  emptyLabel,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  emptyLabel: string;
}) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  if (loading || error)
    return <AsyncStateView isLoading={loading} error={error} onRetry={onRetry} />;
  if (!options.length) return <Text style={uiStyles.muted}>{emptyLabel}</Text>;
  const selected = options.find((option) => option.id === value);
  return (
    <Chips
      options={["None", ...options.map((option) => option.label)]}
      value={selected?.label ?? "None"}
      onChange={(label) =>
        onChange(
          label === "None" ? "" : (options.find((option) => option.label === label)?.id ?? ""),
        )
      }
    />
  );
}
