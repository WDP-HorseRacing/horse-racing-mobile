import type { AuditLogDto } from "@/adapters/audit.adapter";
import { apiRequest } from "@/services/api-client";

export const auditService = {
  async list(
    token: string,
    limit = 20,
    filters: { entityId?: string; feature?: string; page?: number } = {},
  ): Promise<AuditLogDto[]> {
    const query = new URLSearchParams({ limit: String(limit), page: String(filters.page ?? 1) });
    if (filters.entityId) query.set("entityId", filters.entityId);
    if (filters.feature) query.set("feature", filters.feature);
    const response = await apiRequest<{ items: AuditLogDto[] } | AuditLogDto[]>(
      `/audit-logs?${query.toString()}`,
      { token },
    );
    return Array.isArray(response) ? response : (response.items ?? []);
  },
};
