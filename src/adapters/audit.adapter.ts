export type AuditLogDto = {
  id: string;
  actor: { id: string; fullName: string; role: string | null } | null;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  feature: string | null;
  createdAt: string;
};
