import { useCallback, useMemo } from "react";
import type { HorseListItemDto } from "@/adapters/horse.adapter";
import type { RoleId } from "@/types/raceos";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { horseService } from "@/services/horse.service";
import {
  stableService,
  type BarnListItemDto,
  type GroomWorkloadDto,
  type StallDto,
} from "@/services/stable.service";

type StablePayload = {
  barns: BarnListItemDto[];
  stalls: StallDto[];
  horses: HorseListItemDto[];
  grooms: GroomWorkloadDto[];
};

type UseBarnStallsParams = {
  token: string | null;
  role: RoleId;
  activeBarnIndex: number;
  selectedStall: StallDto | null;
  loadGroomWorkload: () => Promise<GroomWorkloadDto[]>;
};

export function useBarnStalls({
  token,
  role,
  activeBarnIndex,
  selectedStall,
  loadGroomWorkload,
}: UseBarnStallsParams) {
  const loadStable = useCallback(async (): Promise<StablePayload> => {
    const [barns, grooms] = await Promise.all([
      stableService.listBarns(token!),
      loadGroomWorkload(),
    ]);

    const horses =
      role === "trainer"
        ? await horseService
            .list(token!, "", { myBarns: true })
            .catch(() => horseService.list(token!))
        : await horseService.list(token!);

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
  }, [loadGroomWorkload, role, token]);

  const resource = useApiResource(loadStable, Boolean(token));
  useRefreshOnFocus(resource.revalidate);
  const payload = resource.data;

  const horseMap = useMemo(() => {
    const map = new Map<string, HorseListItemDto>();
    for (const horse of payload?.horses ?? []) {
      if (horse.location.stall?.id) {
        map.set(`id:${horse.location.stall.id}`, horse);
      }
      if (horse.location.stall?.code && horse.location.barn?.id) {
        map.set(
          `code:${horse.location.barn.id}:${horse.location.stall.code.toLowerCase()}`,
          horse,
        );
      }
    }
    return map;
  }, [payload?.horses]);

  const getHorseInStall = useCallback(
    (stall: StallDto, barnId: string): HorseListItemDto | undefined =>
      horseMap.get(`id:${stall.id}`) ?? horseMap.get(`code:${barnId}:${stall.code.toLowerCase()}`),
    [horseMap],
  );

  const pendingBarnHorses = useMemo(
    () => (payload?.horses ?? []).filter((horse) => horse.location.placementStatus === "PENDING_BARN"),
    [payload?.horses],
  );
  const pendingStallHorses = useMemo(
    () => (payload?.horses ?? []).filter((horse) => horse.location.placementStatus === "PENDING_STALL"),
    [payload?.horses],
  );
  const pendingGroomHorses = useMemo(
    () => (payload?.horses ?? []).filter((horse) => horse.location.placementStatus === "PENDING_GROOM"),
    [payload?.horses],
  );

  const totalAwaitingPlacement =
    pendingBarnHorses.length + pendingStallHorses.length + pendingGroomHorses.length;
  const occupiedCount = payload?.stalls.filter((stall) => stall.status === "OCCUPIED").length ?? 0;
  const currentBarn = payload?.barns[activeBarnIndex];
  const currentBarnStalls = useMemo(
    () => (currentBarn ? (payload?.stalls ?? []).filter((stall) => stall.barnId === currentBarn.id) : []),
    [currentBarn, payload?.stalls],
  );
  const pendingInCurrentBarn = useMemo(
    () =>
      currentBarn
        ? pendingStallHorses.filter((horse) => horse.location.barn?.id === currentBarn.id)
        : [],
    [currentBarn, pendingStallHorses],
  );
  const horsesInCurrentBarn = useMemo(
    () =>
      currentBarn
        ? (payload?.horses ?? []).filter(
            (horse) => horse.location.barn?.id === currentBarn.id && Boolean(horse.location.stall),
          )
        : [],
    [currentBarn, payload?.horses],
  );
  const selectedHorseInModal = useMemo(
    () => (selectedStall && currentBarn ? getHorseInStall(selectedStall, currentBarn.id) : undefined),
    [currentBarn, getHorseInStall, selectedStall],
  );
  const barnMetrics = useMemo(() => {
    const total = currentBarnStalls.length;
    const occupied = currentBarnStalls.filter((stall) => {
      if (stall.status === "OCCUPIED") return true;
      if (!currentBarn) return false;
      return Boolean(getHorseInStall(stall, currentBarn.id));
    }).length;
    const vacant = currentBarnStalls.filter((stall) => {
      if (stall.status !== "AVAILABLE") return false;
      if (!currentBarn) return true;
      return !getHorseInStall(stall, currentBarn.id);
    }).length;
    const attention = currentBarnStalls.filter((stall) => {
      if (!currentBarn) return false;
      const horse = getHorseInStall(stall, currentBarn.id);
      return (
        horse &&
        (horse.healthStatus === "UNDER_OBSERVATION" ||
          horse.healthStatus === "INJURED" ||
          horse.healthStatus === "QUARANTINED")
      );
    }).length;
    return { total, occupied, vacant, attention };
  }, [currentBarn, currentBarnStalls, getHorseInStall]);

  return {
    resource,
    payload,
    getHorseInStall,
    pendingBarnHorses,
    pendingStallHorses,
    pendingGroomHorses,
    totalAwaitingPlacement,
    occupiedCount,
    currentBarn,
    currentBarnStalls,
    pendingInCurrentBarn,
    horsesInCurrentBarn,
    selectedHorseInModal,
    barnMetrics,
  };
}
