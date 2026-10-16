import type {
  SupplyCategory,
  SupplyItemDto,
  SupplyRequestDto,
  SupplyRequestStatus,
} from "@/adapters/supplies.adapter";
import { apiRequest } from "@/services/api-client";

type Page<T> = { items: T[]; meta?: { totalPages?: number } };

export type CreateSupplyItemInput = {
  name: string;
  category: SupplyCategory;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
};

export type UpdateSupplyItemInput = Partial<Pick<
  CreateSupplyItemInput,
  "name" | "category" | "unit" | "reorderThreshold"
>>;

export const suppliesService = {
  listItems(token: string) {
    return listPages<SupplyItemDto>(token, "/supplies/items");
  },

  createItem(token: string, input: CreateSupplyItemInput) {
    return apiRequest<SupplyItemDto>("/supplies/items", { method: "POST", token, body: input });
  },

  updateItem(token: string, itemId: string, input: UpdateSupplyItemInput) {
    return apiRequest<SupplyItemDto>(`/supplies/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH", token, body: input,
    });
  },

  deleteItem(token: string, itemId: string) {
    return apiRequest<void>(`/supplies/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE", token,
    });
  },

  countItem(token: string, itemId: string, quantityOnHand: number) {
    return apiRequest<SupplyItemDto>(`/supplies/items/${encodeURIComponent(itemId)}/stock-counts`, {
      method: "POST", token, body: { quantityOnHand },
    });
  },

  listRequests(token: string) {
    return listPages<SupplyRequestDto>(token, "/supplies/requests");
  },

  createRequest(token: string, itemId: string, quantity: number, note?: string) {
    return apiRequest<SupplyRequestDto>("/supplies/requests", {
      method: "POST", token, body: { itemId, quantity, note },
    });
  },

  updateRequestStatus(token: string, requestId: string, status: SupplyRequestStatus, reason?: string) {
    return apiRequest<SupplyRequestDto>(`/supplies/requests/${encodeURIComponent(requestId)}/status`, {
      method: "PATCH", token, body: { status, ...(reason ? { reason } : {}) },
    });
  },
};

async function listPages<T>(token: string, path: string): Promise<T[]> {
  const items: T[] = [];
  let pageNumber = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({ page: String(pageNumber), limit: "100" });
    const page = await apiRequest<Page<T>>(`${path}?${query.toString()}`, { token });
    items.push(...(page.items ?? []));
    totalPages = page.meta?.totalPages ?? pageNumber;
    pageNumber += 1;
  } while (pageNumber <= totalPages);
  return items;
}
