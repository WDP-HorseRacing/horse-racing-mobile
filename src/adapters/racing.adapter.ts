import { formatDateTime } from "@/utils/formatters";

export type HorseRaceResultDto = {
  registrationId: string;
  raceId: string;
  raceName: string;
  scheduledAt: string;
  raceStatus: string;
  registrationStatus: string;
  placing: number | null;
  timeSeconds: number | null;
};

export type RaceDto = {
  id: string;
  name: string;
  scheduledAt: string;
  status: string;
  conditions?: Record<string, unknown> | null;
};

export type OwnerRaceResultView = HorseRaceResultDto & {
  horseId: string;
  horseName: string;
  scheduledAtLabel: string;
};

export function mapOwnerRaceResult(
  horseId: string,
  horseName: string,
  result: HorseRaceResultDto,
): OwnerRaceResultView {
  return {
    ...result,
    horseId,
    horseName,
    scheduledAtLabel: formatDateTime(result.scheduledAt),
  };
}
