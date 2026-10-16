import type { AuditLogDto } from "@/adapters/audit.adapter";
import { apiRequest } from "@/services/api-client";

export const auditService = {
  async list(token: string, limit = 20): Promise<AuditLogDto[]> {
    const response = await apiRequest<AuditLogDto[] | { items?: AuditLogDto[] }>(
      `/audit-logs?${new URLSearchParams({ limit: String(limit) }).toString()}`,
      { token },
    );
    return Array.isArray(response) ? response : response.items ?? [];
  },
};
