import type {
  SupplyCategory,
  SupplyItemDto,
  SupplyRequestDto,
  SupplyRequestStatus,
  SupplyLotDto,
  SupplyStockMovementDto,
} from "@/adapters/supplies.adapter";
import { apiRequest } from "@/services/api-client";

type Page<T> = { items: T[]; meta?: { totalPages?: number } };
export type SupplyItemFilter = { category?: SupplyCategory; search?: string; lowStock?: boolean };
export type CreateSupplyItemInput = {
  name: string;
  category: SupplyCategory;
  unit: string;
  quantityOnHand?: number;
  openingUnitPrice?: number;
  reorderThreshold: number;
};
export type UpdateSupplyItemInput = Partial<
  Pick<CreateSupplyItemInput, "name" | "category" | "unit" | "reorderThreshold">
>;
export type SupplyRequestFilter = { status?: SupplyRequestStatus };

export const suppliesService = {
  listItems(token: string, filter: SupplyItemFilter = {}) {
    if (filter.lowStock) return apiRequest<SupplyItemDto[]>("/supplies/items/low-stock", { token });
    return listPages<SupplyItemDto>(token, "/supplies/items", {
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.search?.trim() ? { search: filter.search.trim() } : {}),
    });
  },
  getItem(token: string, itemId: string) {
    return apiRequest<SupplyItemDto>(`/supplies/items/${encodeURIComponent(itemId)}`, { token });
  },
  createItem(token: string, input: CreateSupplyItemInput) {
    return apiRequest<SupplyItemDto>("/supplies/items", { method: "POST", token, body: input });
  },
  updateItem(token: string, itemId: string, input: UpdateSupplyItemInput) {
    return apiRequest<SupplyItemDto>(`/supplies/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },
  deleteItem(token: string, itemId: string) {
    return apiRequest<void>(`/supplies/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      token,
    });
  },
  receive(
    token: string,
    itemId: string,
    input: { quantity: number; unitPrice: number; note?: string },
  ) {
    return apiRequest<SupplyItemDto>(`/supplies/items/${encodeURIComponent(itemId)}/receipts`, {
      method: "POST",
      token,
      body: input,
    });
  },
  use(token: string, itemId: string, input: { quantity: number; note?: string }) {
    return apiRequest<SupplyItemDto>(`/supplies/items/${encodeURIComponent(itemId)}/usages`, {
      method: "POST",
      token,
      body: input,
    });
  },
  listLots(token: string, itemId: string) {
    return apiRequest<SupplyLotDto[]>(`/supplies/items/${encodeURIComponent(itemId)}/lots`, {
      token,
    });
  },
  listMovements(token: string, itemId: string) {
    return listPages<SupplyStockMovementDto>(
      token,
      `/supplies/items/${encodeURIComponent(itemId)}/movements`,
      {},
    );
  },
  listRequests(token: string, filter: SupplyRequestFilter = {}) {
    return listPages<SupplyRequestDto>(token, "/supplies/requests", filter);
  },
  getRequest(token: string, requestId: string) {
    return apiRequest<SupplyRequestDto>(`/supplies/requests/${encodeURIComponent(requestId)}`, {
      token,
    });
  },
  createRequest(token: string, itemId: string, quantity: number, note?: string) {
    return apiRequest<SupplyRequestDto>("/supplies/requests", {
      method: "POST",
      token,
      body: { itemId, quantity, ...(note?.trim() ? { note: note.trim() } : {}) },
    });
  },
  editRequest(token: string, requestId: string, input: { quantity?: number; note?: string }) {
    return apiRequest<SupplyRequestDto>(`/supplies/requests/${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },
  updateRequestStatus(
    token: string,
    requestId: string,
    status: SupplyRequestStatus,
    details: { reason?: string; unitPrice?: number } = {},
  ) {
    return apiRequest<SupplyRequestDto>(
      `/supplies/requests/${encodeURIComponent(requestId)}/status`,
      {
        method: "PATCH",
        token,
        body: {
          status,
          ...(details.reason ? { reason: details.reason } : {}),
          ...(details.unitPrice !== undefined ? { unitPrice: details.unitPrice } : {}),
        },
      },
    );
  },
};

async function listPages<T>(
  token: string,
  path: string,
  filters: Record<string, string | undefined>,
): Promise<T[]> {
  const items: T[] = [];
  let pageNumber = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({
      page: String(pageNumber),
      limit: "100",
      ...Object.fromEntries(
        Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
      ),
    });
    const page = await apiRequest<Page<T>>(`${path}?${query.toString()}`, { token });
    items.push(...(page.items ?? []));
    totalPages = page.meta?.totalPages ?? pageNumber;
    pageNumber += 1;
  } while (pageNumber <= totalPages);
  return items;
}
