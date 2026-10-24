import { formatQuantity } from "@/utils/formatters";

export type SupplyCategory = "FEED" | "SUPPLEMENT" | "MEDICINE" | "EQUIPMENT";
export type SupplyRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "FULFILLED"
  | "CANCELLED";
export type SupplyItemDto = {
  id: string;
  name: string;
  category: SupplyCategory;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  lowStock: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type SupplyRequestDto = {
  id: string;
  itemId: string;
  item: SupplyItemDto;
  requestedBy: string;
  requester: { id: string; fullName: string; email: string };
  quantity: number | null;
  status: SupplyRequestStatus;
  note: string | null;
  reviewedBy: string | null;
  reviewer: { id: string; fullName: string; email: string } | null;
  reviewedAt: string | null;
  fulfilledBy: string | null;
  fulfiller: { id: string; fullName: string; email: string } | null;
  fulfilledAt: string | null;
  rejectionReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
};
export type SupplyLotDto = {
  id: string;
  quantity: number;
  remaining: number;
  unitPrice: number;
  createdAt: string;
};
export type SupplyStockMovementDto = {
  id: string;
  itemId: string;
  delta: number;
  balanceAfter: number;
  type: "OPENING" | "RESTOCK" | "USAGE" | "USAGE_REVERSAL" | "COUNT_ADJUST";
  lotId: string | null;
  unitPrice: number | null;
  amount: number | null;
  requestId: string | null;
  usageId: string | null;
  cancelled: boolean;
  note: string | null;
  creator: { id: string; fullName: string; email: string };
  createdAt: string;
};
export type SupplyItemView = SupplyItemDto & {
  categoryLabel: string;
  quantityLabel: string;
};

export function mapSupplyItem(item: SupplyItemDto): SupplyItemView {
  return {
    ...item,
    categoryLabel: supplyCategoryLabel(item.category),
    quantityLabel: formatQuantity(item.quantityOnHand, item.unit),
  };
}
export function supplyCategoryLabel(category: SupplyCategory): string {
  switch (category) {
    case "FEED":
      return "Feed";
    case "SUPPLEMENT":
      return "Supplement";
    case "MEDICINE":
      return "Medicine";
    case "EQUIPMENT":
      return "Equipment";
  }
}
export function supplyCategoryFromLabel(label: string): SupplyCategory {
  switch (label) {
    case "Supplement":
      return "SUPPLEMENT";
    case "Medicine":
      return "MEDICINE";
    case "Equipment":
      return "EQUIPMENT";
    default:
      return "FEED";
  }
}
export function supplyRequestStatusLabel(status: SupplyRequestStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "FULFILLED":
      return "Fulfilled";
    case "CANCELLED":
      return "Cancelled";
  }
}
