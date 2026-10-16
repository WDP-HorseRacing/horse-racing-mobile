export type AuditLogDto = {
  id: string;
  actorId: string | null;
  actor?: { id: string; fullName?: string | null; email?: string | null } | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  reason?: string | null;
  feature?: string | null;
  createdAt: string;
};
