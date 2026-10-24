import type { StaffDto, StaffRole, StaffStatus } from "@/adapters/staff.adapter";
import { apiRequest } from "@/services/api-client";

type Page<T> = { items: T[]; meta?: { totalPages?: number } };

export const usersService = {
  async list(token: string): Promise<StaffDto[]> {
    const users: StaffDto[] = [];
    let pageNumber = 1;
    let totalPages = 1;
    do {
      const query = new URLSearchParams({ page: String(pageNumber), limit: "100" });
      const page = await apiRequest<Page<StaffDto>>(`/users?${query.toString()}`, { token });
      users.push(...(page.items ?? []));
      totalPages = page.meta?.totalPages ?? pageNumber;
      pageNumber += 1;
    } while (pageNumber <= totalPages);
    return users;
  },

  create(
    token: string,
    input: { fullName: string; email: string; role: StaffRole; password: string },
  ) {
    return apiRequest<StaffDto>("/users", { method: "POST", token, body: input });
  },

  update(token: string, userId: string, input: { fullName?: string; role?: StaffRole }) {
    return apiRequest<StaffDto>(`/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },

  setStatus(token: string, userId: string, status: StaffStatus) {
    return apiRequest<StaffDto>(`/users/${encodeURIComponent(userId)}/status`, {
      method: "PATCH",
      token,
      body: { status },
    });
  },

  resetPassword(token: string, userId: string, newPassword: string) {
    return apiRequest<void>(`/users/${encodeURIComponent(userId)}/reset-password`, {
      method: "POST",
      token,
      body: { newPassword },
    });
  },

  handoverHeadTrainer(token: string, userId: string, toHeadTrainerId: string) {
    return apiRequest<{ barnsMoved: number; plansMoved: number; classesMoved: number }>(
      `/users/${encodeURIComponent(userId)}/head-trainer-handover`,
      { method: "POST", token, body: { toHeadTrainerId } },
    );
  },
};
