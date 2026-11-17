import { useCallback } from "react";
import { stableService } from "@/services/stable.service";
import type { GroomWorkloadDto } from "@/services/stable.service";

export function useGroomAssignment(token: string | null) {
  return useCallback(
    (): Promise<GroomWorkloadDto[]> =>
      token ? stableService.listGroomWorkload(token) : Promise.resolve([]),
    [token],
  );
}
