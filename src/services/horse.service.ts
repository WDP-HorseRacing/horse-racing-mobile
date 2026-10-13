import type { HorseDetailDto, HorseListItemDto } from "@/adapters/horse.adapter";
import { apiRequest } from "@/services/api-client";

type Page<T> = { items: T[]; meta: { totalPages: number } };

export const horseService = {
  async list(token: string, search = ""): Promise<HorseListItemDto[]> {
    const horses: HorseListItemDto[] = [];
    let pageNumber = 1;
    let totalPages = 1;
    do {
      const query = new URLSearchParams({ page: String(pageNumber), limit: "100" });
      if (search.trim()) query.set("search", search.trim());
      const page = await apiRequest<Page<HorseListItemDto>>(`/horses?${query.toString()}`, { token });
      horses.push(...(page.items ?? []));
      totalPages = page.meta?.totalPages ?? pageNumber;
      pageNumber += 1;
    } while (pageNumber <= totalPages);
    return horses;
  },

  get(token: string, horseId: string) {
    return apiRequest<HorseDetailDto>(`/horses/${encodeURIComponent(horseId)}`, { token });
  },
};
