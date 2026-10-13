import { apiRequest } from "@/services/api-client";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
};

export type AuthUser = {
  userId: string;
  role: string | null;
  status: string;
  email: string;
  fullName: string;
  roles: string[];
};

export const authService = {
  login(email: string, password: string) {
    return apiRequest<AuthTokens>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
  },

  refresh(refreshToken: string) {
    return apiRequest<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    });
  },

  getMe(token: string) {
    return apiRequest<AuthUser>("/auth/me", { token });
  },

  logout(refreshToken: string) {
    return apiRequest<void>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
    });
  },
};
