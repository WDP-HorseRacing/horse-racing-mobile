import type { HorseRaceResultDto, RaceDto } from "@/adapters/racing.adapter";
import { apiRequest } from "@/services/api-client";

export const racingService = {
  async listRaces(token: string): Promise<RaceDto[]> {
    const response = await apiRequest<RaceDto[] | { items: RaceDto[] }>("/races", { token });
    return Array.isArray(response) ? response : response.items ?? [];
  },

  listHorseResults(token: string, horseId: string) {
    return apiRequest<HorseRaceResultDto[]>(`/horses/${encodeURIComponent(horseId)}/race-results`, {
      token,
    });
  },

  registerHorse(token: string, raceId: string, horseId: string) {
    return apiRequest<unknown>(`/races/${encodeURIComponent(raceId)}/registrations`, {
      method: "POST", token, body: { horseId },
    });
  },
};
